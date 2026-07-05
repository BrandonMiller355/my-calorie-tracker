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
  const { defaultGoals, goalsAreDefault, saveDefaultGoals } = useAppState();
  const { signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [values, setValues] = useState<Record<keyof Goals, string>>(
    goalsToFormValues(defaultGoals),
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

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

  return (
    <div className="settings-screen">
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
        <button type="submit">Save goals</button>
        {saved && <span className="saved-note">Saved ✓</span>}
      </form>

      <div className="appearance-section">
        <h2>Appearance</h2>
        <label>
          Theme
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value as ThemePreference)}
          >
            {THEME_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="signout-section">
        <button type="button" className="secondary" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>
    </div>
  );
}
