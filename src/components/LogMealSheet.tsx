import { useId, useState } from 'react';
import { resolveMeal } from '../lib/meal';
import { unitLabel } from '../lib/units';
import { useAppState } from '../state/AppState';
import { useBackHandler } from '../state/BackNavigation';
import { useSwipeToDismiss } from '../lib/useSwipeToDismiss';
import { MEALS, MEAL_LABELS, type Meal, type SavedMeal } from '../types';
import { NumberInput } from './NumberInput';

export interface LogMealSheetProps {
  meal: SavedMeal;
  date: string;
  /** Slot the entry form had selected; pre-selects the sheet's slot */
  defaultSlot: Meal;
  onLogged: () => void;
  onCancel: () => void;
}

/** Common portions, offered as one tap next to the free-entry field. */
const PORTION_PRESETS = [
  { label: '¼', value: 0.25 },
  { label: '½', value: 0.5 },
  { label: '1', value: 1 },
  { label: '2', value: 2 },
];

/** Strict portion parse: a finite number greater than 0, else null. */
function parsePortion(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/**
 * Confirm sheet for logging a saved meal. Shows the resolved components, the
 * live total, and the target slot, then fans the meal out into ordinary entries
 * on confirm. A portion multiplier scales every component at once — logging
 * half a meal logs half of each of its foods — and the listed amounts and total
 * follow it live. Components whose food no longer resolves are listed as
 * skipped; when none resolve, logging is disabled.
 */
export function LogMealSheet({ meal, date, defaultSlot, onLogged, onCancel }: LogMealSheetProps) {
  useBackHandler(true, onCancel);
  const { sheetStyle, handleProps } = useSwipeToDismiss(onCancel);
  const { foods, logMeal } = useAppState();
  const [slot, setSlot] = useState<Meal>(defaultSlot);
  const [portionText, setPortionText] = useState('1');
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const slotName = useId();
  const portionId = useId();

  const portion = parsePortion(portionText);
  // An unparseable portion previews the whole meal; the error blocks logging.
  const { resolved, unavailable, totals } = resolveMeal(meal, foods, portion ?? 1);
  const nothingToLog = resolved.length === 0;

  async function handleLog() {
    if (portion === null) return;
    setSaving(true);
    setSaveFailed(false);
    try {
      await logMeal(meal.id, slot, date, portion);
      onLogged();
    } catch {
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="entry-form" role="dialog" aria-label={`Log ${meal.name}`} style={sheetStyle}>
        <div className="sheet-handle" aria-hidden="true" {...handleProps} />
        <h2>Log {meal.name}</h2>

        <fieldset className="segmented-field" aria-label="Meal slot">
          <legend>Add to</legend>
          <div className="segmented">
            {MEALS.map((m) => (
              <label key={m} className={`segment${slot === m ? ' segment-active' : ''}`}>
                <input
                  type="radio"
                  name={slotName}
                  value={m}
                  checked={slot === m}
                  onChange={() => setSlot(m)}
                />
                {MEAL_LABELS[m]}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="field portion-field">
          <label htmlFor={portionId}>Portion</label>
          <div className="portion-row">
            <NumberInput
              id={portionId}
              className="portion-input"
              value={portionText}
              onChange={(e) => setPortionText(e.target.value)}
              aria-invalid={portion === null}
            />
            <span className="portion-suffix" aria-hidden="true">
              ×
            </span>
            <div className="portion-presets">
              {PORTION_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  className={`ghost-chip portion-chip${portion === preset.value ? ' portion-chip-active' : ''}`}
                  aria-pressed={portion === preset.value}
                  onClick={() => setPortionText(String(preset.value))}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
          {portion === null && (
            <p className="field-error" role="alert">
              Enter a portion greater than 0
            </p>
          )}
        </div>

        {nothingToLog ? (
          <p className="form-note" role="alert">
            None of this meal’s foods are available anymore, so there’s nothing to log.
          </p>
        ) : (
          <ul className="meal-breakdown log-meal-list">
            {resolved.map((r) => (
              <li key={r.food.id} className="log-meal-item">
                <span>
                  {r.food.name} · {r.amount} {unitLabel(r.component.unit)}
                </span>
                <span className="log-meal-item-cal">{Math.round(r.calories)} kcal</span>
              </li>
            ))}
          </ul>
        )}

        {unavailable.length > 0 && !nothingToLog && (
          <p className="meal-breakdown-missing">
            {unavailable.length === 1
              ? '1 item unavailable and will be skipped'
              : `${unavailable.length} items unavailable and will be skipped`}
          </p>
        )}

        {!nothingToLog && <p className="meal-total">Total: {totals.calories} kcal</p>}

        {saveFailed && (
          <p className="field-error" role="alert">
            Couldn’t log the meal — nothing was saved. Check your connection and try again.
          </p>
        )}

        <div className="form-actions">
          <button type="button" className="secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleLog}
            disabled={saving || nothingToLog || portion === null}
          >
            {saving ? 'Logging…' : 'Log all'}
          </button>
        </div>
      </div>
    </div>
  );
}
