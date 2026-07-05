import { useEffect, useId, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { checkMacroCalories } from '../lib/macroCheck';
import { findFoodByName, matchFoods } from '../lib/foodMatch';
import { validateEntryForm, type EntryFormErrors, type EntryFormValues } from '../lib/validation';
import { useAppState } from '../state/AppState';
import {
  MEALS,
  MEAL_LABELS,
  type FoodEntry,
  type FoodSearchResult,
  type LibraryFood,
  type Meal,
  type MealSuggestions,
} from '../types';
import { FoodNameCombobox, type ComboboxAction, type ComboboxGroup } from './FoodNameCombobox';

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

const CALORIE_FIELD = { key: 'calories', label: 'Calories (kcal)' } as const;

const NUTRIENT_FIELDS = [
  { key: 'fat', label: 'Fat (g)' },
  { key: 'carbs', label: 'Carbs (g)' },
  { key: 'protein', label: 'Protein (g)' },
] as const;

export function EntryForm({ date, editing, prefill, defaultMeal, onClose }: EntryFormProps) {
  const { addEntry, updateEntry, foods, getMealSuggestions } = useAppState();
  const navigate = useNavigate();
  const nameInputId = useId();

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
  /** Library food this entry is linked to (selected or carried from the edited entry) */
  const [foodId, setFoodId] = useState<string | undefined>(editing?.foodId);
  const [servingDesc, setServingDesc] = useState<string | undefined>(
    editing?.servingDesc ?? prefill?.servingDesc,
  );
  /** Seeds the library food when this entry is captured as a new food */
  const [description, setDescription] = useState('');
  const [suggestions, setSuggestions] = useState<MealSuggestions | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMealSuggestions(meal).then(
      (s) => {
        if (!cancelled) setSuggestions(s);
      },
      // Suggestions are a convenience; the form works fine without them
      () => {
        if (!cancelled) setSuggestions(null);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [meal, getMealSuggestions]);

  // Search results can lack nutrients; those fields start blank and are flagged
  const missingFromSearch = new Set(
    prefill && !editing
      ? NUTRIENT_FIELDS.filter(({ key }) => prefill[key] === undefined).map(({ key }) => key)
      : [],
  );

  function setField(key: keyof EntryFormValues, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  const query = values.name.trim();

  /** The library food this entry would link to on save */
  const matchedFood = foodId
    ? foods.find((f) => f.id === foodId)
    : findFoodByName(foods, values.name);

  // While saving, keep the dropdown empty so the just-captured food doesn't
  // flash in as a new option under the closing form.
  let groups: ComboboxGroup[] = [];
  if (!saving && query === '' && suggestions) {
    groups = [
      { label: `Recent · ${MEAL_LABELS[meal]}`, foods: suggestions.recent },
      { label: `Most used · ${MEAL_LABELS[meal]}`, foods: suggestions.mostUsed },
    ];
  } else if (!saving && query !== '') {
    groups = [{ label: 'My foods', foods: matchFoods(foods, query) }];
  }

  const actions: ComboboxAction[] =
    saving || query === ''
      ? []
      : [
          {
            id: 'search-online',
            label: `Search online for “${query}”`,
            onSelect: () =>
              navigate('/search', { state: { fromForm: { meal, date, query } } }),
          },
          {
            id: 'use-as-new',
            // Closing the dropdown is all this needs: free text already is the manual path
            label: `Use “${query}” as a new food`,
            onSelect: () => {},
          },
        ];

  function selectFood(food: LibraryFood) {
    setFoodId(food.id);
    setServingDesc(food.servingDesc);
    setDescription('');
    setValues((v) => ({
      ...v,
      name: food.name,
      calories: String(food.calories),
      carbs: String(food.carbs),
      protein: String(food.protein),
      fat: String(food.fat),
    }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const result = validateEntryForm(values);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    const mismatch = checkMacroCalories(
      result.parsed.calories,
      result.parsed.carbs,
      result.parsed.protein,
      result.parsed.fat,
    );
    if (
      mismatch &&
      !window.confirm(
        `The carbs, protein, and fat add up to about ${mismatch.expected} kcal, but you entered ` +
          `${mismatch.entered} kcal. Save anyway?`,
      )
    ) {
      return;
    }

    setErrors({});
    setSaving(true);
    setSaveFailed(false);
    try {
      if (editing) {
        await updateEntry({ ...editing, ...result.parsed, meal, servingDesc, foodId });
      } else {
        await addEntry({
          ...result.parsed,
          date,
          meal,
          servingDesc,
          source: prefill ? 'search' : 'manual',
          foodId,
          description: description.trim() || undefined,
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
            Some nutrition values were missing from the search result. They’ll be saved as 0
            unless you fill in the highlighted fields.
          </p>
        )}

        {/* label references the input by id: the popup listbox must not sit
            inside the <label>, or its options become part of the field's name */}
        <div className="field">
          <label htmlFor={nameInputId}>Name</label>
          <FoodNameCombobox
            inputId={nameInputId}
            value={values.name}
            onChange={(name) => {
              setField('name', name);
              setFoodId(undefined);
            }}
            groups={groups}
            actions={actions}
            onSelectFood={selectFood}
          />
          {errors.name && <span className="field-error">{errors.name}</span>}
          {matchedFood?.description && (
            <span className="combobox-selected-desc">{matchedFood.description}</span>
          )}
        </div>

        {!editing && !matchedFood && (
          <label>
            Description (optional)
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brand, prep, weights — saved to your food library"
            />
          </label>
        )}

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

        <label>
          {CALORIE_FIELD.label}
          <input
            inputMode="decimal"
            value={values[CALORIE_FIELD.key]}
            onChange={(e) => setField(CALORIE_FIELD.key, e.target.value)}
          />
          {errors[CALORIE_FIELD.key] && (
            <span className="field-error">{errors[CALORIE_FIELD.key]}</span>
          )}
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
