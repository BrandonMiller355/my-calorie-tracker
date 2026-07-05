import { useState, type FormEvent } from 'react';
import { useAppState } from '../state/AppState';
import { useAuth } from '../state/AuthProvider';
import { useTheme, type ThemePreference } from '../state/ThemeProvider';
import { DEFAULT_GOALS, type Goals } from '../types';

const FIELDS = [
  { key: 'calories', label: 'Calories (kcal)' },
  { key: 'fat', label: 'Fat (g)' },
  { key: 'carbs', label: 'Carbs (g)' },
  { key: 'protein', label: 'Protein (g)' },
] as const;

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'Match device' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export function SettingsScreen() {
  const { goals, goalsAreDefault, saveGoals } = useAppState();
  const { signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [values, setValues] = useState<Record<keyof Goals, string>>({
    calories: String(goals.calories),
    carbs: String(goals.carbs),
    protein: String(goals.protein),
    fat: String(goals.fat),
  });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = {} as Goals;
    for (const { key } of FIELDS) {
      const n = Number(values[key].trim());
      if (values[key].trim() === '' || !Number.isFinite(n) || n <= 0) {
        setError('All goals must be numbers greater than 0.');
        return;
      }
      parsed[key] = n;
    }
    setError(null);
    try {
      await saveGoals(parsed);
    } catch {
      setError('Couldn’t save your goals — they were not stored. Check your connection and try again.');
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="settings-screen">
      <h1>Daily goals</h1>
      {goalsAreDefault && (
        <p className="form-note">
          You’re using the default goals ({DEFAULT_GOALS.calories} kcal, {DEFAULT_GOALS.fat} g
          fat, {DEFAULT_GOALS.carbs} g carbs, {DEFAULT_GOALS.protein} g protein). Save your own
          below.
        </p>
      )}
      <form onSubmit={handleSubmit} className="goals-form">
        {FIELDS.map(({ key, label }) => (
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
