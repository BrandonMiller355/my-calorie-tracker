import { useState, type FormEvent } from 'react';
import { GOAL_FIELDS, goalsToFormValues, parseGoalsForm } from '../lib/goalFields';
import { useAppState } from '../state/AppState';
import { useAuth } from '../state/AuthProvider';
import { useTheme, type ThemePreference } from '../state/ThemeProvider';
import { DEFAULT_GOALS, type Goals } from '../types';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'Match device' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export function SettingsScreen() {
  const { defaultGoals, goalsAreDefault, saveDefaultGoals, weeklyDeficitGoal, saveWeeklyDeficitGoal } =
    useAppState();
  const { signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [values, setValues] = useState<Record<keyof Goals, string>>(
    goalsToFormValues(defaultGoals),
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [weeklyDeficitValue, setWeeklyDeficitValue] = useState(
    weeklyDeficitGoal === null ? '' : String(weeklyDeficitGoal),
  );
  const [weeklyDeficitError, setWeeklyDeficitError] = useState<string | null>(null);
  const [weeklyDeficitSaved, setWeeklyDeficitSaved] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const result = parseGoalsForm(values);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    try {
      await saveDefaultGoals(result.goals);
    } catch {
      setError('Couldn’t save your goals — they were not stored. Check your connection and try again.');
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleWeeklyDeficitSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = weeklyDeficitValue.trim();
    if (trimmed === '') {
      setWeeklyDeficitError('Enter a weekly deficit goal, or leave Settings to skip setting one.');
      return;
    }
    const goal = Number(trimmed);
    if (!Number.isFinite(goal) || goal <= 0) {
      setWeeklyDeficitError('Weekly deficit goal must be a number greater than 0.');
      return;
    }
    setWeeklyDeficitError(null);
    try {
      await saveWeeklyDeficitGoal(goal);
    } catch {
      setWeeklyDeficitError(
        'Couldn’t save your weekly deficit goal — it was not stored. Check your connection and try again.',
      );
      return;
    }
    setWeeklyDeficitSaved(true);
    setTimeout(() => setWeeklyDeficitSaved(false), 2000);
  }

  return (
    <div className="settings-screen">
      <section className="settings-card">
      <h1>Default daily goal</h1>
      <p className="form-note">
        This is the goal used on any day that doesn’t have its own custom goal. Adjust a single
        day’s goal from that day’s log.
      </p>
      {goalsAreDefault && (
        <p className="form-note">
          You’re using the built-in default ({DEFAULT_GOALS.calories} kcal, {DEFAULT_GOALS.fat} g
          fat, {DEFAULT_GOALS.carbs} g carbs, {DEFAULT_GOALS.protein} g protein). Save your own
          below.
        </p>
      )}
      <form onSubmit={handleSubmit} className="goals-form">
        {GOAL_FIELDS.map(({ key, label }) => (
          <label key={key}>
            {label}
            <input
              inputMode="decimal"
              value={values[key]}
              onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
            />
          </label>
        ))}
        {error && <p className="field-error">{error}</p>}
        <div className="form-save-row">
          <button type="submit">Save goals</button>
          {saved && <span className="saved-note">Saved ✓</span>}
        </div>
      </form>
      </section>

      <section className="settings-card weekly-deficit-section">
        <h2>Weekly deficit goal</h2>
        <p className="form-note">
          Optional target for your running weekly calorie deficit (e.g. 3500 kcal). Leave it blank
          if you don’t want to track one.
        </p>
        <form onSubmit={handleWeeklyDeficitSubmit} className="goals-form">
          <label>
            Weekly deficit goal (kcal)
            <input
              inputMode="decimal"
              value={weeklyDeficitValue}
              placeholder="Not set"
              onChange={(e) => setWeeklyDeficitValue(e.target.value)}
            />
          </label>
          {weeklyDeficitError && <p className="field-error">{weeklyDeficitError}</p>}
          <div className="form-save-row">
            <button type="submit">Save weekly goal</button>
            {weeklyDeficitSaved && <span className="saved-note">Saved ✓</span>}
          </div>
        </form>
      </section>

      <section className="settings-card appearance-section">
        <h2>Appearance</h2>
        <fieldset className="segmented-field" aria-label="Theme">
          <legend>Theme</legend>
          <div className="segmented">
            {THEME_OPTIONS.map(({ value, label }) => (
              <label key={value} className={`segment${theme === value ? ' segment-active' : ''}`}>
                <input
                  type="radio"
                  name="theme"
                  value={value}
                  checked={theme === value}
                  onChange={() => setTheme(value)}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <section className="settings-card signout-section">
        <button type="button" className="signout-button" onClick={() => void signOut()}>
          Sign out
        </button>
      </section>
    </div>
  );
}
