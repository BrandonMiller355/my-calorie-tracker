import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { buildRequestFoods, identifyFood, type IdentifiedAmount, type IdentifyResult } from '../api/identifyFood';
import { buildChainNote, type ChainItem } from '../lib/bulkPhotoChain';
import { loadImageFile } from '../lib/photo';
import { round1 } from '../lib/totals';
import { availableUnits, deriveQuantity, unitLabel } from '../lib/units';
import { useAppState } from '../state/AppState';
import { MEALS, MEAL_LABELS, type LibraryFood, type Meal } from '../types';

/** Bound on photos per batch; keeps memory and sequential request count sane. */
export const MAX_BATCH_PHOTOS = 10;

// Everything here — photos, chaining notes, rows — lives in this component's
// state and dies with it. Nothing is persisted until "Add N entries".
type Phase =
  | { kind: 'selecting' }
  | { kind: 'identifying'; current: number; total: number }
  /** Identification failed at failedIndex; retry resumes there, keeping earlier rows. */
  | { kind: 'identify-error'; message: string; failedIndex: number }
  | { kind: 'review' };

/** One photo's result plus its editable review fields. */
interface BulkRow {
  /** Client-generated key for list rendering and removal */
  key: string;
  /** JPEG data URL; the row's thumbnail */
  image: string;
  /** 1–3 ranked candidates; empty = not recognized in the library */
  candidates: LibraryFood[];
  /** Picked candidate id; undefined for a not-recognized row */
  foodId?: string;
  /** The weight the model returned, kept so re-picking a candidate can re-prefill */
  amount?: IdentifiedAmount;
  amountText: string;
  /** A unit from availableUnits of the picked food's anchor */
  unit: string;
  meal: Meal;
  /** The prefilled amount is the model's visual judgment, not a scale read */
  estimatedWeight: boolean;
}

interface BulkPhotoOverlayProps {
  /** The user's library; archived foods are filtered out of the requests. */
  foods: LibraryFood[];
  /** The dialog's date; reviewed rows are logged to it. */
  date: string;
  /** The dialog's selected meal; every row defaults to it. */
  meal: Meal;
  /** All reviewed rows were logged; the parent closes the dialog. */
  onLogged: () => void;
  onCancel: () => void;
}

function parseAmount(text: string): number | null {
  const n = Number(text.trim());
  return text.trim() !== '' && Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Amount/unit prefill per the single-photo rules: the returned grams when the
 * food's anchor offers grams as a logging unit, otherwise 1 of its serving
 * label with the grams ignored.
 */
function prefillFields(
  food: LibraryFood,
  amount: IdentifiedAmount | undefined,
): Pick<BulkRow, 'amountText' | 'unit' | 'estimatedWeight'> {
  const units = availableUnits({ servingLabel: food.servingLabel, servingSize: food.servingSize });
  if (amount && units.includes('g')) {
    return {
      amountText: String(round1(amount.grams)),
      unit: 'g',
      estimatedWeight: amount.source === 'estimate',
    };
  }
  return { amountText: '1', unit: food.servingLabel, estimatedWeight: false };
}

/**
 * Full flow for "bulk photos": select several gallery photos of a meal that
 * was assembled incrementally on a tared scale, identify each photo's newly
 * added food via sequential chained identify-food requests, and bulk-log all
 * of them from one review list.
 */
export function BulkPhotoOverlay({ foods, date, meal, onLogged, onCancel }: BulkPhotoOverlayProps) {
  const { addEntry } = useAppState();
  const [phase, setPhase] = useState<Phase>({ kind: 'selecting' });
  const [photos, setPhotos] = useState<string[]>([]);
  const [rows, setRows] = useState<BulkRow[]>([]);
  /** Bad selection (over the cap, nothing decodable); shown on the picker panel. */
  const [selectError, setSelectError] = useState<string | null>(null);
  /** Some selected files were skipped as undecodable; non-blocking. */
  const [skippedNote, setSkippedNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  // The header action's tap is the user gesture; open the gallery right away.
  // The visible button below covers browsers that swallow the synthetic click
  // and reselection after a dismissed picker or a bad selection.
  useEffect(() => {
    fileInputRef.current?.click();
  }, []);

  /** What the earlier photos turned out to contain, for the chaining note. */
  function chainHistory(prior: BulkRow[]): ChainItem[] {
    return prior.map((row) => {
      const top = row.candidates[0];
      if (!top) return { kind: 'unidentified' };
      return {
        kind: 'identified',
        name: top.name,
        grams: row.amount ? round1(row.amount.grams) : undefined,
      };
    });
  }

  function rowFromResult(image: string, result: IdentifyResult): BulkRow {
    // parseResult guarantees every candidate id came from the request, so
    // each one resolves; the filter is belt-and-braces.
    const candidates = result.candidates
      .map((c) => foods.find((f) => f.id === c.id))
      .filter((f): f is LibraryFood => f !== undefined);
    const top = candidates[0];
    if (!top) {
      return {
        key: crypto.randomUUID(),
        image,
        candidates: [],
        amountText: '',
        unit: '',
        meal,
        estimatedWeight: false,
      };
    }
    return {
      key: crypto.randomUUID(),
      image,
      candidates,
      foodId: top.id,
      amount: result.amount,
      meal,
      ...prefillFields(top, result.amount),
    };
  }

  /**
   * Identifies photos one at a time from startIndex, chaining each request's
   * note off the earlier results. Sequential by design: photo N's note needs
   * photos 1..N-1, and serial calls keep clear of the provider rate limit.
   */
  async function runIdentification(images: string[], startIndex: number, prior: BulkRow[]) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestFoods = buildRequestFoods(foods);
    const built = [...prior];
    for (let i = startIndex; i < images.length; i++) {
      setPhase({ kind: 'identifying', current: i + 1, total: images.length });
      // An empty library can't match anything; skip the round trips.
      if (requestFoods.length === 0) {
        built.push(rowFromResult(images[i], { candidates: [] }));
        setRows([...built]);
        continue;
      }
      try {
        const result = await identifyFood(
          { image: images[i], note: buildChainNote(chainHistory(built)), foods: requestFoods },
          { signal: controller.signal },
        );
        if (controller.signal.aborted) return;
        built.push(rowFromResult(images[i], result));
        setRows([...built]);
      } catch (err) {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : 'Identification failed';
        setPhase({ kind: 'identify-error', message, failedIndex: i });
        return;
      }
    }
    setPhase({ kind: 'review' });
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = ''; // allow re-selecting after an error or a dismissed picker
    if (files.length === 0) return; // user dismissed the picker
    setSelectError(null);
    setSkippedNote(null);
    if (files.length > MAX_BATCH_PHOTOS) {
      setSelectError(
        `That's ${files.length} photos — the limit is ${MAX_BATCH_PHOTOS} per batch. Pick fewer and try again.`,
      );
      return;
    }
    // lastModified is the capture time for gallery photos, so ascending order
    // recovers the photographed sequence however the photos were tapped.
    const ordered = [...files].sort((a, b) => a.lastModified - b.lastModified);
    const images: string[] = [];
    let skipped = 0;
    for (const file of ordered) {
      try {
        const image = await loadImageFile(file);
        if (image) images.push(image);
        else skipped += 1;
      } catch {
        skipped += 1;
      }
    }
    if (images.length === 0) {
      setSelectError("Those files couldn't be used as photos.");
      return;
    }
    if (skipped > 0) {
      setSkippedNote(
        `${skipped} ${skipped === 1 ? 'file' : 'files'} couldn't be used as a photo and ${skipped === 1 ? 'was' : 'were'} skipped.`,
      );
    }
    setPhotos(images);
    void runIdentification(images, 0, []);
  }

  function setRow(key: string, patch: Partial<BulkRow>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  /** Re-picking a candidate re-prefills the row's amount and unit from that food. */
  function pickCandidate(key: string, id: string) {
    setRows((rs) =>
      rs.map((r) => {
        if (r.key !== key) return r;
        const food = r.candidates.find((f) => f.id === id);
        if (!food) return r;
        return { ...r, foodId: id, ...prefillFields(food, r.amount) };
      }),
    );
  }

  const pickedFood = (row: BulkRow): LibraryFood | undefined =>
    row.foodId ? foods.find((f) => f.id === row.foodId) : undefined;

  const loggable = rows.filter((r) => pickedFood(r) !== undefined);
  const amountsValid = loggable.every((r) => parseAmount(r.amountText) !== null);

  /**
   * Logs loggable rows one at a time, dropping each from the list as it
   * lands. On a failure the already-added entries stay added and the confirm
   * button retries only what's left. Not-recognized rows are never logged.
   */
  async function handleAddAll() {
    setSaving(true);
    setSaveFailed(false);
    let remaining = rows;
    try {
      for (;;) {
        const next = remaining.find((r) => pickedFood(r) !== undefined);
        if (!next) break;
        const food = pickedFood(next);
        const amount = parseAmount(next.amountText);
        if (!food || amount === null) return; // confirm is disabled while invalid; belt-and-braces
        const anchor = { servingLabel: food.servingLabel, servingSize: food.servingSize };
        await addEntry({
          name: food.name,
          amount,
          unit: next.unit,
          quantity: deriveQuantity(amount, next.unit, anchor),
          servingLabel: anchor.servingLabel,
          servingSize: anchor.servingSize,
          calories: food.calories,
          carbs: food.carbs,
          protein: food.protein,
          fat: food.fat,
          date,
          meal: next.meal,
          source: 'manual',
          foodId: food.id,
        });
        remaining = remaining.filter((r) => r.key !== next.key);
        setRows(remaining);
      }
      onLogged();
    } catch {
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  }

  if (phase.kind === 'selecting') {
    return (
      <div className="scanner-overlay" role="dialog" aria-label="Log foods from photos">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden-file-input"
          aria-label="Choose photos from your device"
          onChange={(e) => void handleFileChange(e)}
        />
        <div className="photo-picker-panel">
          <p className="scanner-hint">
            Pick the photos of one meal, in any order — oldest is logged first.
          </p>
          {selectError && (
            <div className="scanner-error" role="alert">
              <p>{selectError}</p>
            </div>
          )}
          <button
            type="button"
            className="library-button"
            onClick={() => fileInputRef.current?.click()}
          >
            🖼️ Choose photos
          </button>
        </div>
        <button type="button" className="scanner-cancel secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="scanner-overlay" role="dialog" aria-label="Review foods from photos">
      <div className="ai-review">
        {skippedNote && <p className="form-note">{skippedNote}</p>}

        {phase.kind === 'identifying' && (
          <p className="loading">
            Analyzing photo {phase.current} of {phase.total}…
          </p>
        )}

        {phase.kind === 'identify-error' && (
          <div className="scanner-error" role="alert">
            <p>A photo couldn’t be identified ({phase.message}).</p>
            <p>
              <button
                type="button"
                className="link-button"
                onClick={() => void runIdentification(photos, phase.failedIndex, rows)}
              >
                Retry
              </button>
            </p>
          </div>
        )}

        {phase.kind === 'review' && <p className="identify-message">Check these before logging</p>}

        {rows.length > 0 && (
          <ul className="identify-candidates">
            {rows.map((row, index) => {
              const food = pickedFood(row);
              const photoLabel = `photo ${index + 1}`;
              if (!food) {
                return (
                  <li key={row.key} className="text-log-item bulk-photo-row">
                    <img src={row.image} alt={`Photo ${index + 1}`} className="bulk-photo-thumb" />
                    <div className="bulk-photo-fields">
                      <div className="text-log-item-head">
                        <span className="identify-candidate-name">Not recognized</span>
                        <button
                          type="button"
                          className="link-button"
                          onClick={() => setRows((rs) => rs.filter((r) => r.key !== row.key))}
                          disabled={saving}
                          aria-label={`Remove ${photoLabel}`}
                        >
                          Remove
                        </button>
                      </div>
                      <span className="identify-candidate-desc">
                        This doesn’t look like anything in your food library — it won’t be logged.
                      </span>
                    </div>
                  </li>
                );
              }

              const anchor = { servingLabel: food.servingLabel, servingSize: food.servingSize };
              const amount = parseAmount(row.amountText);
              const calories =
                amount !== null
                  ? round1(deriveQuantity(amount, row.unit, anchor) * food.calories)
                  : null;
              return (
                <li key={row.key} className="text-log-item bulk-photo-row">
                  <img src={row.image} alt={`Photo ${index + 1}`} className="bulk-photo-thumb" />
                  <div className="bulk-photo-fields">
                    <div className="text-log-item-head">
                      {row.candidates.length > 1 ? (
                        <select
                          className="bulk-photo-candidate"
                          value={food.id}
                          onChange={(e) => pickCandidate(row.key, e.target.value)}
                          disabled={saving}
                          aria-label={`Food for ${photoLabel}`}
                        >
                          {row.candidates.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="identify-candidate-name">{food.name}</span>
                      )}
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => setRows((rs) => rs.filter((r) => r.key !== row.key))}
                        disabled={saving}
                        aria-label={`Remove ${photoLabel}`}
                      >
                        Remove
                      </button>
                    </div>
                    {row.candidates.length > 1 && (
                      <span className="identify-candidate-desc">AI unsure — check the match</span>
                    )}
                    {food.description && (
                      <span className="identify-candidate-desc">{food.description}</span>
                    )}
                    {row.estimatedWeight && (
                      <span className="identify-candidate-desc">
                        Weight estimated by AI from the photo — check it.
                      </span>
                    )}
                    <div className="text-log-item-fields">
                      <input
                        inputMode="decimal"
                        value={row.amountText}
                        onChange={(e) =>
                          setRow(row.key, { amountText: e.target.value, estimatedWeight: false })
                        }
                        disabled={saving}
                        aria-label={`Amount for ${photoLabel}`}
                      />
                      <select
                        value={row.unit}
                        onChange={(e) => setRow(row.key, { unit: e.target.value, estimatedWeight: false })}
                        disabled={saving}
                        aria-label={`Unit for ${photoLabel}`}
                      >
                        {availableUnits(anchor).map((u) => (
                          <option key={u} value={u}>
                            {unitLabel(u)}
                          </option>
                        ))}
                      </select>
                      <select
                        value={row.meal}
                        onChange={(e) => setRow(row.key, { meal: e.target.value as Meal })}
                        disabled={saving}
                        aria-label={`Meal for ${photoLabel}`}
                      >
                        {MEALS.map((m) => (
                          <option key={m} value={m}>
                            {MEAL_LABELS[m]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <span className="identify-candidate-cal">
                      {calories !== null ? `${calories} kcal` : 'Enter a valid amount'}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {saveFailed && (
          <div className="scanner-error" role="alert">
            <p>Couldn’t save — the items above were not logged. Try again.</p>
          </div>
        )}

        {phase.kind === 'review' && (
          <button
            type="button"
            className="ai-accept"
            disabled={saving || loggable.length === 0 || !amountsValid}
            onClick={() => void handleAddAll()}
          >
            {saving
              ? 'Adding…'
              : `Add ${loggable.length} ${loggable.length === 1 ? 'entry' : 'entries'}`}
          </button>
        )}
      </div>
      <button
        type="button"
        className="scanner-cancel secondary"
        onClick={onCancel}
        disabled={saving}
      >
        Cancel
      </button>
    </div>
  );
}
