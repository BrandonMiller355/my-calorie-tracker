import { useMemo, useState, type FormEvent } from 'react';
import { findMealByName, matchFoods, normalizeFoodName } from '../lib/foodMatch';
import { availableUnits, deriveQuantity, unitLabel } from '../lib/units';
import {
  validateMealForm,
  type MealComponentFormValue,
  type MealFormErrors,
} from '../lib/validation';
import { useAppState } from '../state/AppState';
import type { LibraryFood, SavedMeal } from '../types';

/** Create a new meal from seed foods, or edit an existing saved meal. */
export type MealBuilderMode =
  | { kind: 'create'; seed: LibraryFood[] }
  | { kind: 'edit'; meal: SavedMeal };

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** A seed food (or an edited meal's component) as an editable builder row. */
function seedComponent(food: LibraryFood): MealComponentFormValue {
  return { food, amount: '1', unit: food.servingLabel };
}

/** Reconstitute an edited meal's rows from the current library; components whose
 *  food no longer resolves (archived/removed) are dropped from the builder. */
function editComponents(meal: SavedMeal, foods: LibraryFood[]): MealComponentFormValue[] {
  return meal.items.flatMap((item) => {
    const food = foods.find((f) => f.id === item.foodId);
    return food ? [{ food, amount: String(item.amount), unit: item.unit }] : [];
  });
}

/** Live contribution of one builder row, or null when its portion isn't valid yet. */
function rowCalories(component: MealComponentFormValue): number | null {
  const amount = Number(component.amount.trim());
  const anchor = { servingLabel: component.food.servingLabel, servingSize: component.food.servingSize };
  if (
    component.amount.trim() === '' ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    !availableUnits(anchor).includes(component.unit)
  ) {
    return null;
  }
  return component.food.calories * deriveQuantity(amount, component.unit, anchor);
}

export function MealBuilder({ mode, onClose }: { mode: MealBuilderMode; onClose: () => void }) {
  const { foods, meals, addMeal, updateMeal } = useAppState();
  const editing = mode.kind === 'edit' ? mode.meal : undefined;
  const [name, setName] = useState(editing?.name ?? '');
  const [components, setComponents] = useState<MealComponentFormValue[]>(() =>
    mode.kind === 'edit' ? editComponents(mode.meal, foods) : mode.seed.map(seedComponent),
  );
  const [errors, setErrors] = useState<MealFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addQuery, setAddQuery] = useState('');
  const [backdropMouseDown, setBackdropMouseDown] = useState(false);

  const chosenIds = new Set(components.map((c) => c.food.id));
  const addableMatches = useMemo(
    () => matchFoods(foods.filter((f) => !chosenIds.has(f.id)), addQuery),
    // chosenIds derives from components; addQuery and foods drive the match
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [foods, addQuery, components],
  );

  const total = round1(
    components.reduce((sum, c) => sum + (rowCalories(c) ?? 0), 0),
  );

  function setRow(index: number, patch: Partial<MealComponentFormValue>) {
    setComponents((cs) => cs.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  function removeRow(index: number) {
    setComponents((cs) => cs.filter((_, i) => i !== index));
  }

  function addFood(food: LibraryFood) {
    setComponents((cs) => [...cs, seedComponent(food)]);
    setAddQuery('');
    setAdding(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const result = validateMealForm({ name, components });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    // A meal name is unique per user, the same rule the library uses for foods;
    // an in-place edit keeps its own name.
    const duplicate = findMealByName(meals, result.parsed.name);
    if (duplicate && duplicate.id !== editing?.id) {
      setErrors({ name: 'A meal with this name already exists' });
      return;
    }
    setErrors({});
    setSaving(true);
    setSaveFailed(false);
    try {
      if (editing) {
        await updateMeal({ ...editing, name: result.parsed.name, items: result.parsed.items });
      } else {
        await addMeal({ name: result.parsed.name, items: result.parsed.items });
      }
      onClose();
    } catch {
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  }

  const nameNormalized = normalizeFoodName(name);
  const nameCollides =
    nameNormalized !== '' &&
    meals.some((m) => m.id !== editing?.id && normalizeFoodName(m.name) === nameNormalized);

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => setBackdropMouseDown(e.target === e.currentTarget)}
      onClick={(e) => {
        if (e.target === e.currentTarget && backdropMouseDown) onClose();
      }}
    >
      <form
        className="entry-form"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        aria-label={editing ? 'Edit meal' : 'Create meal'}
      >
        <div className="sheet-handle" aria-hidden="true" />
        <h2>{editing ? 'Edit meal' : 'New meal'}</h2>

        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="e.g. Taco salad" />
          {errors.name && <span className="field-error">{errors.name}</span>}
          {!errors.name && nameCollides && (
            <span className="field-error">A meal with this name already exists</span>
          )}
        </label>

        {errors.components && <p className="field-error">{errors.components}</p>}

        <ul className="meal-component-list">
          {components.map((component, index) => {
            const anchor = {
              servingLabel: component.food.servingLabel,
              servingSize: component.food.servingSize,
            };
            const units = availableUnits(anchor);
            const cals = rowCalories(component);
            const rowError = errors.componentErrors?.[index];
            return (
              <li key={component.food.id} className="meal-component-row">
                <div className="meal-component-main">
                  <span className="result-name">{component.food.name}</span>
                  <div className="amount-unit">
                    <input
                      inputMode="decimal"
                      aria-label={`Amount of ${component.food.name}`}
                      value={component.amount}
                      onChange={(e) => setRow(index, { amount: e.target.value })}
                    />
                    <select
                      aria-label={`Unit for ${component.food.name}`}
                      value={units.includes(component.unit) ? component.unit : units[0]}
                      onChange={(e) => setRow(index, { unit: e.target.value })}
                    >
                      {units.map((u) => (
                        <option key={u} value={u}>
                          {unitLabel(u)}
                        </option>
                      ))}
                    </select>
                  </div>
                  {cals !== null && <span className="meal-component-cal">{round1(cals)} kcal</span>}
                  {(rowError?.amount || rowError?.unit) && (
                    <span className="field-error">{rowError.amount ?? rowError.unit}</span>
                  )}
                </div>
                <button
                  type="button"
                  className="meal-component-remove"
                  aria-label={`Remove ${component.food.name}`}
                  onClick={() => removeRow(index)}
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>

        {adding ? (
          <div className="meal-add-food">
            <input
              className="search-input"
              type="search"
              autoFocus
              placeholder="Add a food from your library"
              aria-label="Add a food from your library"
              value={addQuery}
              onChange={(e) => setAddQuery(e.target.value)}
            />
            {addQuery.trim() !== '' && (
              <ul className="meal-add-results">
                {addableMatches.length === 0 ? (
                  <li className="search-hint">No foods match “{addQuery.trim()}”.</li>
                ) : (
                  addableMatches.map((food) => (
                    <li key={food.id}>
                      <button type="button" className="meal-add-result" onClick={() => addFood(food)}>
                        {food.name}
                        <span className="combobox-option-kcal"> · {food.calories} kcal</span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        ) : (
          <button type="button" className="link-button" onClick={() => setAdding(true)}>
            + Add food
          </button>
        )}

        <p className="meal-total">Total: {total} kcal</p>

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
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Save meal'}
          </button>
        </div>
      </form>
    </div>
  );
}
