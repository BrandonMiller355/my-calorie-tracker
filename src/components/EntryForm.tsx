import { useState, type FormEvent } from 'react';
import { validateEntryForm, type EntryFormErrors, type EntryFormValues } from '../lib/validation';
import { useAppState } from '../state/AppState';
import { MEALS, MEAL_LABELS, type FoodEntry, type FoodSearchResult, type Meal } from '../types';

export interface EntryFormProps {
  date: string;
  /** Present when editing an existing entry */
  editing?: FoodEntry;
  /** Present when pre-filled from a search result */
  prefill?: FoodSearchResult;
  defaultMeal?: Meal;
  onClose: () => void;
}

function numToField(n: number | undefined): string {
  return n === undefined ? '' : String(n);
}

const NUTRIENT_FIELDS = [
  { key: 'calories', label: 'Calories (kcal)' },
  { key: 'carbs', label: 'Carbs (g)' },
  { key: 'protein', label: 'Protein (g)' },
  { key: 'fat', label: 'Fat (g)' },
] as const;

export function EntryForm({ date, editing, prefill, defaultMeal, onClose }: EntryFormProps) {
  const { addEntry, updateEntry } = useAppState();

  const [meal, setMeal] = useState<Meal>(editing?.meal ?? defaultMeal ?? 'snacks');
  const [values, setValues] = useState<EntryFormValues>({
    name: editing?.name ?? prefill?.name ?? '',
    quantity: editing ? String(editing.quantity) : '1',
    calories: editing ? String(editing.calories) : numToField(prefill?.calories),
    carbs: editing ? String(editing.carbs) : numToField(prefill?.carbs),
    protein: editing ? String(editing.protein) : numToField(prefill?.protein),
    fat: editing ? String(editing.fat) : numToField(prefill?.fat),
  });
  const [errors, setErrors] = useState<EntryFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  const servingDesc = editing?.servingDesc ?? prefill?.servingDesc;

  // Search results can lack nutrients; those fields start blank and are flagged
  const missingFromSearch = new Set(
    prefill && !editing
      ? NUTRIENT_FIELDS.filter(({ key }) => prefill[key] === undefined).map(({ key }) => key)
      : [],
  );

  function setField(key: keyof EntryFormValues, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const result = validateEntryForm(values);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setSaving(true);
    setSaveFailed(false);
    try {
      if (editing) {
        await updateEntry({ ...editing, ...result.parsed, meal });
      } else {
        await addEntry({
          ...result.parsed,
          date,
          meal,
          servingDesc,
          source: prefill ? 'search' : 'manual',
        });
      }
      onClose();
    } catch {
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="entry-form"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        aria-label={editing ? 'Edit food entry' : 'Add food entry'}
      >
        <h2>{editing ? 'Edit food' : 'Add food'}</h2>

        {missingFromSearch.size > 0 && (
          <p className="form-note" role="alert">
            Some nutrition values were missing from the search result. Please fill in the
            highlighted fields before saving.
          </p>
        )}

        <label>
          Name
          <input
            value={values.name}
            onChange={(e) => setField('name', e.target.value)}
            autoFocus
          />
          {errors.name && <span className="field-error">{errors.name}</span>}
        </label>

        <label>
          Meal
          <select value={meal} onChange={(e) => setMeal(e.target.value as Meal)}>
            {MEALS.map((m) => (
              <option key={m} value={m}>
                {MEAL_LABELS[m]}
              </option>
            ))}
          </select>
        </label>

        <label>
          Servings{servingDesc ? ` (1 = ${servingDesc})` : ''}
          <input
            inputMode="decimal"
            value={values.quantity}
            onChange={(e) => setField('quantity', e.target.value)}
          />
          {errors.quantity && <span className="field-error">{errors.quantity}</span>}
        </label>

        <div className="nutrient-grid">
          {NUTRIENT_FIELDS.map(({ key, label }) => (
            <label key={key} className={missingFromSearch.has(key) ? 'flagged' : undefined}>
              {label}
              {missingFromSearch.has(key) && <span className="flag-hint"> — missing, confirm</span>}
              <input
                inputMode="decimal"
                value={values[key]}
                onChange={(e) => setField(key, e.target.value)}
              />
              {errors[key] && <span className="field-error">{errors[key]}</span>}
            </label>
          ))}
        </div>

        {saveFailed && (
          <p className="field-error" role="alert">
            Couldn’t save — your change was not stored. Check your connection and try again.
          </p>
        )}

        <div className="form-actions">
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Add to log'}
          </button>
        </div>
      </form>
    </div>
  );
}
