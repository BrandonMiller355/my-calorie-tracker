import { useState, type FormEvent } from 'react';
import { findFoodByName, matchFoods, normalizeFoodName } from '../lib/foodMatch';
import { resolveMeal } from '../lib/meal';
import { MEASURE_UNITS, UNIT_LABELS, unitLabel } from '../lib/units';
import {
  validateFoodForm,
  type FoodFormErrors,
  type FoodFormValues,
} from '../lib/validation';
import { MealBuilder, type MealBuilderMode } from '../components/MealBuilder';
import { PhotoCapture } from '../components/PhotoCapture';
import { FoodThumbnail } from '../components/FoodThumbnail';
import { useAppState } from '../state/AppState';
import { DEFAULT_SERVING_LABEL, type LibraryFood, type SavedMeal } from '../types';

type FormMode = { kind: 'create' } | { kind: 'edit'; food: LibraryFood } | null;

/** Which save the user asked for, rather than which one the form was opened in. */
type SaveMode = 'update' | 'create';

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
  const { foods, addFood, updateFood, setFoodImage, removeFoodImage } = useAppState();
  const [values, setValues] = useState<FoodFormValues>(toFormValues(editing));
  const [errors, setErrors] = useState<FoodFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  // Attaching/replacing a photo goes through the camera/file overlay.
  const [capturingPhoto, setCapturingPhoto] = useState(false);
  // The live food reflects image changes (which persist immediately, apart from
  // the text/nutrition save) so the preview updates without closing the form.
  const liveFood = editing ? (foods.find((f) => f.id === editing.id) ?? editing) : undefined;
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

  // Compared on the library's dedup key, so a case or whitespace tweak doesn't
  // offer a fork that validation would then reject as a duplicate.
  const nameDiverged =
    editing !== undefined && normalizeFoodName(values.name) !== normalizeFoodName(editing.name);

  async function save(mode: SaveMode) {
    const result = validateFoodForm(values);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    // A fork is checked against the whole library, the food it started from
    // included — only an in-place save gets to keep its own name.
    const exemptId = mode === 'update' ? editing?.id : undefined;
    const duplicate = findFoodByName(foods, result.parsed.name);
    if (duplicate && duplicate.id !== exemptId) {
      setErrors({ name: 'A food with this name is already in your library' });
      return;
    }

    setErrors({});
    setSaving(true);
    setSaveFailed(false);
    try {
      if (mode === 'update' && editing) {
        // Base the update on the live food, not the stale `editing` snapshot, so
        // an image attached out-of-band (setFoodImage) isn't clobbered back to
        // null by a text/nutrition save.
        await updateFood({ ...(liveFood ?? editing), ...result.parsed });
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

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void save(editing ? 'update' : 'create');
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

        <div className="food-edit-head">
          {editing && liveFood && (
            <div className="food-photo-col">
            <div className="food-photo-block">
              {liveFood.imagePath ? (
                <FoodThumbnail
                  food={liveFood}
                  className="food-photo-preview"
                  enlargeable
                  renderActions={(close) => (
                    <>
                      <button
                        type="button"
                        className="food-photo-icon"
                        aria-label="Replace photo"
                        title="Replace photo"
                        onClick={() => {
                          close();
                          setCapturingPhoto(true);
                        }}
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        className="food-photo-icon"
                        aria-label="Remove photo"
                        title="Remove photo"
                        onClick={() => {
                          close();
                          void removeFoodImage(editing.id);
                        }}
                      >
                        🗑️
                      </button>
                    </>
                  )}
                />
              ) : (
                <button
                  type="button"
                  className="food-photo-add"
                  aria-label="Add photo"
                  title="Add photo"
                  onClick={() => setCapturingPhoto(true)}
                >
                  📷
                </button>
              )}
            </div>
              {!recipeOpen && (
                <button
                  type="button"
                  className="link-button food-recipe-toggle"
                  onClick={() => setRecipeOpen(true)}
                >
                  {values.recipe ? 'View recipe' : '+ Add recipe'}
                </button>
              )}
            </div>
          )}
          <div className="food-edit-fields">
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
              Description (optional)
              <input
                value={values.description}
                onChange={(e) => setField('description', e.target.value)}
                placeholder="Brand, prep, weights"
              />
            </label>
          </div>
        </div>

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
          // In edit mode the toggle lives under the thumbnail; here it's only
          // for the create form (which has no photo section).
          !editing && (
            <button type="button" className="link-button" onClick={() => setRecipeOpen(true)}>
              {values.recipe ? 'View recipe' : '+ Add recipe'}
            </button>
          )
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
          {nameDiverged && (
            <button
              type="button"
              className="secondary"
              disabled={saving}
              onClick={() => void save('create')}
            >
              Save as new food
            </button>
          )}
          <button type="submit" disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Add to library'}
          </button>
        </div>
      </form>
      {capturingPhoto && editing && (
        <PhotoCapture
          onCapture={(dataUrl) => {
            setCapturingPhoto(false);
            // Fire-and-forget: applying the photo is independent of the text save.
            void setFoodImage(editing.id, dataUrl);
          }}
          onCancel={() => setCapturingPhoto(false)}
        />
      )}
    </div>
  );
}

function MealsTab({
  onEdit,
}: {
  onEdit: (meal: SavedMeal) => void;
}) {
  const { meals, foods, archiveMeal } = useAppState();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [archiveFailed, setArchiveFailed] = useState(false);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleArchive(meal: SavedMeal) {
    if (!window.confirm(`Archive “${meal.name}”? It disappears from the log search.`)) return;
    setArchiveFailed(false);
    archiveMeal(meal.id).catch(() => setArchiveFailed(true));
  }

  if (meals.length === 0) {
    return (
      <p className="search-hint">
        No meals yet — pick “Select” under Foods to combine foods into a meal.
      </p>
    );
  }

  const sorted = [...meals].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      {archiveFailed && (
        <p className="error-banner" role="alert">
          Couldn’t archive the meal — it was not removed. Check your connection and try again.
        </p>
      )}
      <ul className="food-list">
        {sorted.map((meal) => {
          const { resolved, unavailable, totals } = resolveMeal(meal, foods);
          const open = expanded.has(meal.id);
          return (
            <li key={meal.id} className="food-row">
              <div className="food-row-main">
                <span className="result-name">{meal.name}</span>
                <span className="result-macros">
                  {totals.calories} kcal · F {totals.fat} g · C {totals.carbs} g · P {totals.protein} g
                </span>
                <button type="button" className="link-button" onClick={() => toggle(meal.id)}>
                  {open ? 'Hide items' : `${resolved.length + unavailable.length} items`}
                </button>
                {open && (
                  <ul className="meal-breakdown">
                    {resolved.map((r) => (
                      <li key={r.food.id}>
                        {r.food.name} · {r.component.amount} {unitLabel(r.component.unit)}
                      </li>
                    ))}
                    {unavailable.length > 0 && (
                      <li className="meal-breakdown-missing">
                        {unavailable.length === 1 ? '1 item unavailable' : `${unavailable.length} items unavailable`}
                      </li>
                    )}
                  </ul>
                )}
              </div>
              <div className="food-row-actions">
                <button type="button" onClick={() => onEdit(meal)}>
                  Edit
                </button>
                <button
                  type="button"
                  aria-label={`Archive ${meal.name}`}
                  onClick={() => handleArchive(meal)}
                >
                  Archive
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export function FoodsScreen() {
  const { foods, archiveFood } = useAppState();
  const [tab, setTab] = useState<'foods' | 'meals'>('foods');
  const [form, setForm] = useState<FormMode>(null);
  const [mealForm, setMealForm] = useState<MealBuilderMode | null>(null);
  const [archiveFailed, setArchiveFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [expandedRecipes, setExpandedRecipes] = useState<Set<string>>(new Set());
  /** Multi-select mode for combining foods into a meal */
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggleRecipe(id: string) {
    setExpandedRecipes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exitSelecting() {
    setSelecting(false);
    setSelected(new Set());
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

  function createMealFromSelection() {
    const seed = foods.filter((f) => selected.has(f.id));
    if (seed.length < 2) return;
    setMealForm({ kind: 'create', seed });
    exitSelecting();
  }

  return (
    <div className="foods-screen">
      <h1>Food library</h1>

      <div className="library-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'foods'}
          className={`library-tab${tab === 'foods' ? ' active' : ''}`}
          onClick={() => {
            setTab('foods');
          }}
        >
          Foods
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'meals'}
          className={`library-tab${tab === 'meals' ? ' active' : ''}`}
          onClick={() => {
            setTab('meals');
            exitSelecting();
          }}
        >
          Meals
        </button>
      </div>

      {tab === 'foods' ? (
        <>
          <p className="form-note">
            Foods you log are saved here automatically. Edits change future logs only — entries
            already in your history keep the values they were logged with.
          </p>

          <div className="foods-actions">
            <button type="button" className="add-food-button" onClick={() => setForm({ kind: 'create' })}>
              + Add food item
            </button>
            {foods.length >= 2 && !selecting && (
              <button
                type="button"
                className="new-meal-button"
                onClick={() => setSelecting(true)}
              >
                + New meal
              </button>
            )}
          </div>

          {selecting && (
            <div className="select-banner">
              <p>Tick the foods to combine, then tap “Create meal”.</p>
              <button type="button" className="link-button" onClick={exitSelecting}>
                Cancel
              </button>
            </div>
          )}

          {archiveFailed && (
            <p className="error-banner" role="alert">
              Couldn’t archive the food — it was not removed. Check your connection and try again.
            </p>
          )}

          {foods.length > 0 && (
            <input
              className="search-input"
              type="search"
              placeholder={selecting ? 'Filter foods to combine' : 'Filter your library'}
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
                <li key={food.id} className={`food-row${selecting ? ' selectable' : ''}`}>
                  {selecting && (
                    <input
                      type="checkbox"
                      className="food-select"
                      aria-label={`Select ${food.name}`}
                      checked={selected.has(food.id)}
                      onChange={() => toggleSelected(food.id)}
                    />
                  )}
                  <FoodThumbnail food={food} enlargeable />
                  <div className="food-row-main">
                    <span className="result-name">{food.name}</span>
                    {food.description && <span className="result-brand">{food.description}</span>}
                    <span className="result-macros">
                      {food.calories} kcal · F {food.fat} g · C {food.carbs} g · P {food.protein} g
                      {describeAnchor(food) ? ` · ${describeAnchor(food)}` : ''}
                    </span>
                    {!selecting && food.recipe && (
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
                  {!selecting && (
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
                  )}
                </li>
              ))}
            </ul>
          )}

          {selecting && (
            <div className="select-footer">
              <button
                type="button"
                className="add-food-button"
                disabled={selected.size < 2}
                onClick={createMealFromSelection}
              >
                Create meal from {selected.size} {selected.size === 1 ? 'food' : 'foods'}
              </button>
            </div>
          )}
        </>
      ) : (
        <MealsTab onEdit={(meal) => setMealForm({ kind: 'edit', meal })} />
      )}

      {form && (
        <FoodForm
          editing={form.kind === 'edit' ? form.food : undefined}
          onClose={() => setForm(null)}
        />
      )}

      {mealForm && <MealBuilder mode={mealForm} onClose={() => setMealForm(null)} />}
    </div>
  );
}
