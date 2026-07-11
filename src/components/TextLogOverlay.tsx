import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  buildRequestFoods,
  logFromText,
  resolveTextLogItems,
  type ResolvedTextLogItem,
} from '../api/logFromText';
import { round1 } from '../lib/totals';
import { availableUnits, deriveQuantity, unitLabel } from '../lib/units';
import { useAppState } from '../state/AppState';
import { MEALS, MEAL_LABELS, type LibraryFood, type Meal } from '../types';

// Everything here — text, parsed items, edits — lives in this component's
// state and dies with it. Nothing is persisted until "Add N entries".
type Phase = 'entering' | 'parsing' | 'review';

/** A resolved item plus its editable amount field (string, like the entry form's). */
type ReviewRow = ResolvedTextLogItem & { amountText: string };

interface TextLogOverlayProps {
  /** The user's library; archived foods are filtered out of the request. */
  foods: LibraryFood[];
  /** The dialog's date; reviewed items are logged to it. */
  date: string;
  /** The dialog's selected meal: sent as context, and the fallback for unstated meals. */
  meal: Meal;
  /** Parsing yielded exactly one item; the parent fills the entry form with it. */
  onSingleItem: (item: ResolvedTextLogItem) => void;
  /** All reviewed items were logged; the parent closes the dialog. */
  onLogged: () => void;
  onCancel: () => void;
}

function parseAmount(text: string): number | null {
  const n = Number(text.trim());
  return text.trim() !== '' && Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Full flow for "log from text": describe a meal in free text (the keyboard's
 * dictation key makes this the voice path), parse it into items via the
 * log-from-text Edge Function, review multi-item results, and bulk-log them.
 * Single-item results skip review and are handed to the entry form instead.
 */
export function TextLogOverlay({
  foods,
  date,
  meal,
  onSingleItem,
  onLogged,
  onCancel,
}: TextLogOverlayProps) {
  const { addEntry } = useAppState();
  const [phase, setPhase] = useState<Phase>('entering');
  const [text, setText] = useState('');
  /** Parse failure shown above the input; the text stays for edit/resend. */
  const [parseError, setParseError] = useState<string | null>(null);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function parse(e: FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (trimmed === '') return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase('parsing');
    setParseError(null);
    try {
      const items = await logFromText(
        { text: trimmed, meal, foods: buildRequestFoods(foods) },
        { signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      const resolved = resolveTextLogItems(items, foods, meal);
      if (resolved.length === 0) {
        // Every item was a match that no longer resolves locally; treat it
        // like an incomprehensible description rather than a silent no-op.
        setParseError("That description couldn't be matched to anything — try rephrasing it.");
        setPhase('entering');
      } else if (resolved.length === 1) {
        onSingleItem(resolved[0]);
      } else {
        setRows(resolved.map((item) => ({ ...item, amountText: String(item.amount) })));
        setPhase('review');
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      setParseError(err instanceof Error ? err.message : 'The description couldn’t be parsed');
      setPhase('entering');
    }
  }

  function setRow(key: string, patch: Partial<ReviewRow>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  /**
   * Logs rows one at a time, dropping each from the list as it lands. On a
   * failure the already-added entries stay added and the confirm button
   * retries only what's left in the list.
   */
  async function handleAddAll() {
    setSaving(true);
    setSaveFailed(false);
    let remaining = rows;
    try {
      while (remaining.length > 0) {
        const row = remaining[0];
        const amount = parseAmount(row.amountText);
        if (amount === null) return; // confirm is disabled while invalid; belt-and-braces
        await addEntry({
          name: row.name,
          amount,
          unit: row.unit,
          quantity: deriveQuantity(amount, row.unit, row.anchor),
          servingLabel: row.anchor.servingLabel,
          servingSize: row.anchor.servingSize,
          calories: row.calories,
          carbs: row.carbs,
          protein: row.protein,
          fat: row.fat,
          date,
          meal: row.meal,
          source: row.source,
          foodId: row.foodId,
        });
        remaining = remaining.slice(1);
        setRows(remaining);
      }
      onLogged();
    } catch {
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  }

  if (phase !== 'review') {
    const parsing = phase === 'parsing';
    return (
      <div className="scanner-overlay" role="dialog" aria-label="Log food from text">
        <form className="ai-review text-log-form" onSubmit={parse}>
          <label htmlFor="text-log-input" className="text-log-label">
            What did you eat?
          </label>
          <textarea
            id="text-log-input"
            className="text-log-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. 2 slices of sara lee bread with 1 serving of pbfit"
            rows={3}
            disabled={parsing}
            // The keyboard (and its dictation key) should pop without an extra tap
            autoFocus
          />
          {parseError && (
            <div className="scanner-error" role="alert">
              <p>{parseError}</p>
            </div>
          )}
          {parsing && <p className="loading">Working out what you ate…</p>}
          <button type="submit" className="ai-accept" disabled={parsing || text.trim() === ''}>
            Log it
          </button>
        </form>
        <button type="button" className="scanner-cancel secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    );
  }

  const amountsValid = rows.every((row) => parseAmount(row.amountText) !== null);

  return (
    <div className="scanner-overlay" role="dialog" aria-label="Review foods to log">
      <div className="ai-review">
        <p className="identify-message">Check these before logging</p>
        <ul className="identify-candidates">
          {rows.map((row) => {
            const amount = parseAmount(row.amountText);
            const calories =
              amount !== null
                ? round1(deriveQuantity(amount, row.unit, row.anchor) * row.calories)
                : null;
            return (
              <li key={row.key} className="text-log-item">
                <div className="text-log-item-head">
                  <span className="identify-candidate-name">{row.name}</span>
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => setRows((rs) => rs.filter((r) => r.key !== row.key))}
                    disabled={saving}
                    aria-label={`Remove ${row.name}`}
                  >
                    Remove
                  </button>
                </div>
                {row.description && (
                  <span className="identify-candidate-desc">{row.description}</span>
                )}
                {row.confidenceNote && (
                  <span className="identify-candidate-desc">
                    AI estimate — {row.confidenceNote}
                  </span>
                )}
                <div className="text-log-item-fields">
                  <input
                    inputMode="decimal"
                    value={row.amountText}
                    onChange={(e) => setRow(row.key, { amountText: e.target.value })}
                    disabled={saving}
                    aria-label={`Amount of ${row.name}`}
                  />
                  <select
                    value={row.unit}
                    onChange={(e) => setRow(row.key, { unit: e.target.value })}
                    disabled={saving}
                    aria-label={`Unit of ${row.name}`}
                  >
                    {availableUnits(row.anchor).map((u) => (
                      <option key={u} value={u}>
                        {unitLabel(u)}
                      </option>
                    ))}
                  </select>
                  <select
                    value={row.meal}
                    onChange={(e) => setRow(row.key, { meal: e.target.value as Meal })}
                    disabled={saving}
                    aria-label={`Meal for ${row.name}`}
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
              </li>
            );
          })}
        </ul>

        {saveFailed && (
          <div className="scanner-error" role="alert">
            <p>Couldn’t save — the items above were not logged. Try again.</p>
          </div>
        )}

        <button
          type="button"
          className="ai-accept"
          disabled={saving || rows.length === 0 || !amountsValid}
          onClick={() => void handleAddAll()}
        >
          {saving
            ? 'Adding…'
            : `Add ${rows.length} ${rows.length === 1 ? 'entry' : 'entries'}`}
        </button>
      </div>
      <button type="button" className="scanner-cancel secondary" onClick={onCancel} disabled={saving}>
        Cancel
      </button>
    </div>
  );
}
