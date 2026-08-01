import { useId, useState } from 'react';
import { resolveMeal } from '../lib/meal';
import { unitLabel } from '../lib/units';
import { useAppState } from '../state/AppState';
import { MEALS, MEAL_LABELS, type Meal, type SavedMeal } from '../types';

export interface LogMealSheetProps {
  meal: SavedMeal;
  date: string;
  /** Slot the entry form had selected; pre-selects the sheet's slot */
  defaultSlot: Meal;
  onLogged: () => void;
  onCancel: () => void;
}

/**
 * Confirm sheet for logging a saved meal. Shows the resolved components, the
 * live total, and the target slot, then fans the meal out into ordinary entries
 * on confirm. Components whose food no longer resolves are listed as skipped;
 * when none resolve, logging is disabled.
 */
export function LogMealSheet({ meal, date, defaultSlot, onLogged, onCancel }: LogMealSheetProps) {
  const { foods, logMeal } = useAppState();
  const [slot, setSlot] = useState<Meal>(defaultSlot);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const slotName = useId();

  const { resolved, unavailable, totals } = resolveMeal(meal, foods);
  const nothingToLog = resolved.length === 0;

  async function handleLog() {
    setSaving(true);
    setSaveFailed(false);
    try {
      await logMeal(meal.id, slot, date);
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
      <div className="entry-form" role="dialog" aria-label={`Log ${meal.name}`}>
        <div className="sheet-handle" aria-hidden="true" />
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

        {nothingToLog ? (
          <p className="form-note" role="alert">
            None of this meal’s foods are available anymore, so there’s nothing to log.
          </p>
        ) : (
          <ul className="meal-breakdown log-meal-list">
            {resolved.map((r) => (
              <li key={r.food.id} className="log-meal-item">
                <span>
                  {r.food.name} · {r.component.amount} {unitLabel(r.component.unit)}
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
          <button type="button" onClick={handleLog} disabled={saving || nothingToLog}>
            {saving ? 'Logging…' : 'Log all'}
          </button>
        </div>
      </div>
    </div>
  );
}
