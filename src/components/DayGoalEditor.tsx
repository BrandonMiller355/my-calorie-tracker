import { useState, type FormEvent } from 'react';
import { formatDateKey, todayKey } from '../lib/date';
import { GOAL_FIELDS, goalsToFormValues, parseGoalsForm } from '../lib/goalFields';
import type { Goals } from '../types';

/** Lets the signed-in user override the default goal for a single day. */
export function DayGoalEditor({
  date,
  goals,
  dayGoalIsOverridden,
  onSave,
  onClear,
}: {
  date: string;
  goals: Goals;
  dayGoalIsOverridden: boolean;
  onSave: (goals: Goals) => Promise<void>;
  onClear: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<Record<keyof Goals, string>>(() => goalsToFormValues(goals));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const label = date === todayKey() ? 'today' : formatDateKey(date);

  function startEditing() {
    setValues(goalsToFormValues(goals));
    setError(null);
    setEditing(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const result = parseGoalsForm(values);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await onSave(result.goals);
      setEditing(false);
    } catch {
      setError('Couldn’t save this day’s goal — it was not stored. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleClear() {
    setError(null);
    setBusy(true);
    try {
      await onClear();
      setEditing(false);
    } catch {
      setError('Couldn’t reset this day’s goal. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <div className="day-goal-editor">
        {dayGoalIsOverridden ? (
          <p className="day-goal-note">
            Using a custom goal for {label}.{' '}
            <button type="button" className="link-button" onClick={startEditing}>
              Edit
            </button>{' '}
            <button type="button" className="link-button" onClick={handleClear} disabled={busy}>
              Use default
            </button>
          </p>
        ) : (
          <button type="button" className="link-button" onClick={startEditing}>
            Set a custom goal for {label}
          </button>
        )}
        {error && <p className="field-error">{error}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="goals-form day-goal-form">
      {GOAL_FIELDS.map(({ key, label: fieldLabel }) => (
        <label key={key}>
          {fieldLabel}
          <input
            inputMode="decimal"
            value={values[key]}
            onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
          />
        </label>
      ))}
      {error && <p className="field-error">{error}</p>}
      <div className="form-actions">
        <button type="button" className="secondary" onClick={() => setEditing(false)} disabled={busy}>
          Cancel
        </button>
        {dayGoalIsOverridden && (
          <button type="button" className="secondary" onClick={handleClear} disabled={busy}>
            Use default
          </button>
        )}
        <button type="submit" disabled={busy}>
          Save for {label}
        </button>
      </div>
    </form>
  );
}
