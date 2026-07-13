import { useState, type FormEvent } from 'react';
import { findFoodByName, matchFoods } from '../lib/foodMatch';
import { MEASURE_UNITS, UNIT_LABELS, unitLabel } from '../lib/units';
import {
  validateFoodForm,
  type FoodFormErrors,
  type FoodFormValues,
} from '../lib/validation';
import { useAppState } from '../state/AppState';
import { DEFAULT_SERVING_LABEL, type LibraryFood } from '../types';

type FormMode = { kind: 'create' } | { kind: 'edit'; food: LibraryFood } | null;

const NUTRIENT_FIELDS = [
  { key: 'fat', label: 'Fat (g)' },
  { key: 'carbs', label: 'Carbs (g)' },
  { key: 'protein', label: 'Protein (g)' },
] as const;

function toFormValues(food?: LibraryFood): FoodFormValues {
  return {
    name: food?.name ?? '',
    description: food?.description ?? '',
    recipe: food?.recipe ?? '',
    servingLabel: food?.servingLabel ?? '',
    servingSizeAmount: food?.servingSize ? String(food.servingSize.amount) : '',
    servingSizeUnit: food?.servingSize?.unit ?? '',
    calories: food ? String(food.calories) : '',
    carbs: food ? String(food.carbs) : '',
    protein: food ? String(food.protein) : '',
    fat: food ? String(food.fat) : '',
  };
}

/** "1 can (drained) = 120 g", "per bowl", or '' for a plain unqualified serving. */
function describeAnchor(food: LibraryFood): string {
  if (food.servingSize) {
    const { amount, unit } = food.servingSize;
    return `1 ${food.servingLabel} = ${amount} ${unitLabel(unit)}`;
  }
  return food.servingLabel === DEFAULT_SERVING_LABEL ? '' : `per ${food.servingLabel}`;
}

function FoodForm({ editing, onClose }: { editing?: LibraryFood; onClose: () => void }) {
  const { foods, addFood, updateFood } = useAppState();
  const [values, setValues] = useState<FoodFormValues>(toFormValues(editing));
  const [errors, setErrors] = useState<FoodFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  // Recipe text can be long, so it stays collapsed even when editing a food
  // that already has one, rather than expanding the form by default.
  const [recipeOpen, setRecipeOpen] = useState(false);
  // Only close on backdrop clicks that also started on the backdrop, so
  // dragging a text selection from a field past the dialog edge doesn't
  // dismiss the form on mouseup.
  const [backdropMouseDown, setBackdropMouseDown] = useState(false);

  function setField(key: keyof FoodFormValues, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const result = validateFoodForm(values);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    const duplicate = findFoodByName(foods, result.parsed.name);
    if (duplicate && duplicate.id !== editing?.id) {
      setErrors({ name: 'A food with this name is already in your library' });
      return;
    }

    setErrors({});
    setSaving(true);
    setSaveFailed(false);
    try {
      if (editing) {
        await updateFood({ ...editing, ...result.parsed });
      } else {
        await addFood({ ...result.parsed, source: 'manual' });
      }
      onClose();
    } catch {
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  }

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
        aria-label={editing ? 'Edit library food' : 'Add library food'}
      >
        <div className="sheet-handle" aria-hidden="true" />
        <h2>{editing ? 'Edit food' : 'Add food item'}</h2>

        <label>
          Name
          <input value={values.name} onChange={(e) => setField('name', e.target.value)} autoFocus />
          {errors.name && <span className="field-error">{errors.name}</span>}
        </label>

        <label>
          Description (optional)
          <input
            value={values.description}
            onChange={(e) => setField('description', e.target.value)}
            placeholder="Brand, prep, weights"
          />
        </label>

        {recipeOpen ? (
          <label>
            Recipe (optional)
            <textarea
              value={values.recipe}
              onChange={(e) => setField('recipe', e.target.value)}
              placeholder="Prep steps — e.g. Boil water in the kettle. Add 53g powdered mash..."
              rows={4}
            />
          </label>
        ) : (
          <button type="button" className="link-button" onClick={() => setRecipeOpen(true)}>
            {values.recipe ? 'View recipe' : '+ Add recipe'}
          </button>
        )}

        <div className="serving-def">
          <div className="serving-def-row">
            <label>
              Serving name
              <input
                value={values.servingLabel}
                onChange={(e) => setField('servingLabel', e.target.value)}
                placeholder={DEFAULT_SERVING_LABEL}
              />
            </label>
            <label>
              Equals
              <input
                inputMode="decimal"
                value={values.servingSizeAmount}
                onChange={(e) => setField('servingSizeAmount', e.target.value)}
                placeholder="e.g. 120"
              />
            </label>
            <label>
              Serving unit
              <select
                value={values.servingSizeUnit}
                onChange={(e) => setField('servingSizeUnit', e.target.value)}
              >
                <option value="">—</option>
                {MEASURE_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {UNIT_LABELS[u]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {(errors.servingLabel || errors.servingSizeAmount || errors.servingSizeUnit) && (
            <span className="field-error">
              {errors.servingLabel ?? errors.servingSizeAmount ?? errors.servingSizeUnit}
            </span>
          )}
        </div>

        <label>
          Calories (kcal)
          <input
            inputMode="decimal"
            value={values.calories}
            onChange={(e) => setField('calories', e.target.value)}
          />
          {errors.calories && <span className="field-error">{errors.calories}</span>}
        </label>

        <div className="nutrient-grid">
          {NUTRIENT_FIELDS.map(({ key, label }) => (
            <label key={key}>
              {label}
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
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Add to library'}
          </button>
        </div>
      </form>
    </div>
  );
}

export function FoodsScreen() {
  const { foods, archiveFood } = useAppState();
  const [form, setForm] = useState<FormMode>(null);
  const [archiveFailed, setArchiveFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [expandedRecipes, setExpandedRecipes] = useState<Set<string>>(new Set());

  function toggleRecipe(id: string) {
    setExpandedRecipes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const visible =
    query.trim() === ''
      ? [...foods].sort((a, b) => a.name.localeCompare(b.name))
      : matchFoods(foods, query);

  function handleArchive(food: LibraryFood) {
    if (
      !window.confirm(
        `Archive “${food.name}”? It disappears from suggestions and search, but entries you’ve already logged keep their values.`,
      )
    ) {
      return;
    }
    setArchiveFailed(false);
    archiveFood(food.id).catch(() => setArchiveFailed(true));
  }

  return (
    <div className="foods-screen">
      <h1>Food library</h1>
      <p className="form-note">
        Foods you log are saved here automatically. Edits change future logs only — entries
        already in your history keep the values they were logged with.
      </p>

      <button type="button" className="add-food-button" onClick={() => setForm({ kind: 'create' })}>
        + Add food item
      </button>

      {archiveFailed && (
        <p className="error-banner" role="alert">
          Couldn’t archive the food — it was not removed. Check your connection and try again.
        </p>
      )}

      {foods.length > 0 && (
        <input
          className="search-input"
          type="search"
          placeholder="Filter your library"
          aria-label="Filter your library"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}

      {foods.length === 0 ? (
        <p className="search-hint">Nothing here yet — foods appear as you log them.</p>
      ) : visible.length === 0 ? (
        <p className="search-hint">No foods match “{query.trim()}”.</p>
      ) : (
        <ul className="food-list">
          {visible.map((food) => (
            <li key={food.id} className="food-row">
              <div className="food-row-main">
                <span className="result-name">{food.name}</span>
                {food.description && <span className="result-brand">{food.description}</span>}
                <span className="result-macros">
                  {food.calories} kcal · F {food.fat} g · C {food.carbs} g · P {food.protein} g
                  {describeAnchor(food) ? ` · ${describeAnchor(food)}` : ''}
                </span>
                {food.recipe && (
                  <>
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => toggleRecipe(food.id)}
                    >
                      {expandedRecipes.has(food.id) ? 'Hide recipe' : 'View recipe'}
                    </button>
                    {expandedRecipes.has(food.id) && (
                      <p className="food-recipe">{food.recipe}</p>
                    )}
                  </>
                )}
              </div>
              <div className="food-row-actions">
                <button type="button" onClick={() => setForm({ kind: 'edit', food })}>
                  Edit
                </button>
                <button
                  type="button"
                  aria-label={`Archive ${food.name}`}
                  onClick={() => handleArchive(food)}
                >
                  Archive
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {form && (
        <FoodForm
          editing={form.kind === 'edit' ? form.food : undefined}
          onClose={() => setForm(null)}
        />
      )}
    </div>
  );
}
