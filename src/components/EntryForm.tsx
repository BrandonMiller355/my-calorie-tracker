import { useEffect, useId, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { IdentifiedAmount } from '../api/identifyFood';
import { checkMacroCalories } from '../lib/macroCheck';
import { findFoodByName, matchFoods } from '../lib/foodMatch';
import { availableUnits, deriveQuantity, MEASURE_UNITS, UNIT_LABELS, unitLabel } from '../lib/units';
import {
  validateEntryForm,
  validateServingAnchor,
  type EntryFormErrors,
  type EntryFormValues,
  type ServingAnchorFormErrors,
  type ServingAnchorFormValues,
} from '../lib/validation';
import { useAppState } from '../state/AppState';
import {
  DEFAULT_SERVING_LABEL,
  MEALS,
  MEAL_LABELS,
  type FoodEntry,
  type FoodSearchResult,
  type LibraryFood,
  type Meal,
  type MealSuggestions,
  type ServingAnchor,
} from '../types';
import type { ResolvedTextLogItem } from '../api/logFromText';
import { AiAnalyzeOverlay } from './AiAnalyzeOverlay';
import { FoodNameCombobox, type ComboboxAction, type ComboboxGroup } from './FoodNameCombobox';
import { IdentifyOverlay } from './IdentifyOverlay';
import { TextLogOverlay } from './TextLogOverlay';

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

function anchorToFields(anchor: ServingAnchor | undefined): ServingAnchorFormValues {
  return {
    servingLabel: anchor?.servingLabel ?? '',
    servingSizeAmount: numToField(anchor?.servingSize?.amount),
    servingSizeUnit: anchor?.servingSize?.unit ?? '',
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

const CALORIE_FIELD = { key: 'calories', label: 'Calories (kcal)' } as const;

const NUTRIENT_FIELDS = [
  { key: 'fat', label: 'Fat (g)' },
  { key: 'carbs', label: 'Carbs (g)' },
  { key: 'protein', label: 'Protein (g)' },
] as const;

function ServingAnchorFields({
  values,
  errors,
  onChange,
  note,
}: {
  values: ServingAnchorFormValues;
  errors: ServingAnchorFormErrors;
  onChange: (key: keyof ServingAnchorFormValues, value: string) => void;
  note?: string;
}) {
  return (
    <div className="serving-def">
      <div className="serving-def-row">
        <label>
          Serving name
          <input
            value={values.servingLabel}
            onChange={(e) => onChange('servingLabel', e.target.value)}
            placeholder={DEFAULT_SERVING_LABEL}
          />
        </label>
        <label>
          Equals
          <input
            inputMode="decimal"
            value={values.servingSizeAmount}
            onChange={(e) => onChange('servingSizeAmount', e.target.value)}
            placeholder="e.g. 120"
          />
        </label>
        <label>
          Serving unit
          <select
            value={values.servingSizeUnit}
            onChange={(e) => onChange('servingSizeUnit', e.target.value)}
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
      {note && <p className="form-note">{note}</p>}
    </div>
  );
}

export function EntryForm({ date, editing, prefill, defaultMeal, onClose }: EntryFormProps) {
  const { addEntry, updateEntry, updateFood, foods, getMealSuggestions } = useAppState();
  const navigate = useNavigate();
  const nameInputId = useId();
  const amountInputId = useId();

  const [meal, setMeal] = useState<Meal>(editing?.meal ?? defaultMeal ?? 'snacks');
  const [values, setValues] = useState<EntryFormValues>({
    name: editing?.name ?? prefill?.name ?? '',
    amount: editing ? String(editing.amount) : '1',
    unit: editing ? editing.unit : (prefill?.servingLabel ?? DEFAULT_SERVING_LABEL),
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
  /** Serving definition for a not-yet-captured food; seeded from a search prefill */
  const [anchorFields, setAnchorFields] = useState<ServingAnchorFormValues>(
    anchorToFields(prefill),
  );
  const [anchorErrors, setAnchorErrors] = useState<ServingAnchorFormErrors>({});
  /** Seeds the library food when this entry is captured as a new food */
  const [description, setDescription] = useState('');
  const [recipe, setRecipe] = useState('');
  const [recipeOpen, setRecipeOpen] = useState(false);
  /** Collapsed disclosure for a matched food's existing recipe */
  const [viewingRecipe, setViewingRecipe] = useState(false);
  const [suggestions, setSuggestions] = useState<MealSuggestions | null>(null);
  // Per-serving inputs are hidden for known foods until deliberately revealed
  // ("Edit nutrition"); search prefills missing nutrients start revealed so
  // the flagged fields can be confirmed. Edits apply to this entry only.
  const [nutritionOpen, setNutritionOpen] = useState<boolean>(
    !(editing || prefill) ||
      (!editing && !!prefill && NUTRIENT_FIELDS.some(({ key }) => prefill[key] === undefined)),
  );
  // Only close on backdrop clicks that also started on the backdrop, so
  // dragging a text selection from the name field past the dialog edge
  // doesn't dismiss the form on mouseup.
  const [backdropMouseDown, setBackdropMouseDown] = useState(false);
  /** Identify-from-photo overlay is open */
  const [identifying, setIdentifying] = useState(false);
  /** Log-from-text overlay is open */
  const [textLogging, setTextLogging] = useState(false);
  /** Photo + note handed from identify's no-match to the AI estimate flow */
  const [estimateHandoff, setEstimateHandoff] = useState<{ image: string; note: string } | null>(
    null,
  );
  /** The prefilled amount is the model's visual judgment, not a scale read */
  const [aiEstimatedWeight, setAiEstimatedWeight] = useState(false);
  /** Filled by an accepted AI estimate; classifies the entry like a search prefill */
  const [aiPrefilled, setAiPrefilled] = useState(false);

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
    // Once the user touches the amount, the AI-estimated-weight caveat is stale
    if (key === 'amount' || key === 'unit') setAiEstimatedWeight(false);
    setValues((v) => ({ ...v, [key]: value }));
  }

  function setAnchorField(key: keyof ServingAnchorFormValues, value: string) {
    setAnchorFields((v) => ({ ...v, [key]: value }));
  }

  const query = values.name.trim();

  /** The library food this entry would link to on save */
  const matchedFood = foodId
    ? foods.find((f) => f.id === foodId)
    : findFoodByName(foods, values.name);

  // The serving definition is editable only for a food the library doesn't
  // know yet; edited entries use their own snapshot, matched foods their own
  // definition.
  const showAnchorEditor = !editing && !matchedFood;
  // Revealing nutrition for a food linked to the library also reveals its
  // anchor fields; saving pushes both back to that library food.
  const showLibraryAnchorEditor = nutritionOpen && !!matchedFood;

  // Best-effort live parse so the unit picker follows the in-form definition;
  // invalid equivalence fields degrade to count-only until submit validation.
  const liveInlineParse = validateServingAnchor(anchorFields);
  const inlineAnchor: ServingAnchor = liveInlineParse.ok
    ? liveInlineParse.parsed
    : { servingLabel: anchorFields.servingLabel.trim() || DEFAULT_SERVING_LABEL };

  const anchorFieldsActive = showAnchorEditor || showLibraryAnchorEditor;
  const activeAnchor: ServingAnchor = anchorFieldsActive
    ? inlineAnchor
    : editing
      ? { servingLabel: editing.servingLabel, servingSize: editing.servingSize }
      : matchedFood
        ? { servingLabel: matchedFood.servingLabel, servingSize: matchedFood.servingSize }
        : inlineAnchor;

  const unitOptions = availableUnits(activeAnchor);
  // When the anchor changes under the form (food selected, definition edited),
  // a unit it no longer offers falls back to the count label.
  const optionsKey = unitOptions.join('\0');
  useEffect(() => {
    setValues((v) => (unitOptions.includes(v.unit) ? v : { ...v, unit: unitOptions[0] }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optionsKey]);

  // Defining a new food means typing its nutrition, so the inputs must show
  // (covers clearing a selected food's name and starting a fresh one).
  useEffect(() => {
    if (showAnchorEditor) setNutritionOpen(true);
  }, [showAnchorEditor]);

  // Each time the library-anchor editor opens, reseed it from the matched
  // food's current definition rather than carrying over a stale value.
  useEffect(() => {
    if (showLibraryAnchorEditor && matchedFood) {
      setAnchorFields(anchorToFields(matchedFood));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLibraryAnchorEditor, matchedFood]);

  // Live preview of what this entry will contribute, tracking amount + unit
  const previewAmount = Number(values.amount.trim());
  const previewQuantity =
    values.amount.trim() !== '' &&
    Number.isFinite(previewAmount) &&
    previewAmount > 0 &&
    unitOptions.includes(values.unit)
      ? deriveQuantity(previewAmount, values.unit, activeAnchor)
      : null;
  const previewCalories = Number(values.calories.trim());
  const preview =
    previewQuantity !== null && values.calories.trim() !== '' && Number.isFinite(previewCalories)
      ? {
          calories: round1(previewCalories * previewQuantity),
          fat: round1((Number(values.fat.trim()) || 0) * previewQuantity),
          carbs: round1((Number(values.carbs.trim()) || 0) * previewQuantity),
          protein: round1((Number(values.protein.trim()) || 0) * previewQuantity),
        }
      : null;

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
    setDescription('');
    setRecipe('');
    setRecipeOpen(false);
    setViewingRecipe(false);
    setNutritionOpen(false);
    setValues((v) => ({
      ...v,
      name: food.name,
      unit: food.servingLabel,
      calories: String(food.calories),
      carbs: String(food.carbs),
      protein: String(food.protein),
      fat: String(food.fat),
    }));
  }

  /** An identify match fills the form like a combobox pick, plus the weight when usable. */
  function handleIdentified(food: LibraryFood, amount?: IdentifiedAmount) {
    selectFood(food);
    // Grams only drive the amount when the food's anchor can convert them
    const units = availableUnits({ servingLabel: food.servingLabel, servingSize: food.servingSize });
    if (amount && units.includes('g')) {
      setValues((v) => ({ ...v, amount: String(round1(amount.grams)), unit: 'g' }));
      setAiEstimatedWeight(amount.source === 'estimate');
    } else {
      setAiEstimatedWeight(false);
    }
    setIdentifying(false);
  }

  /**
   * A single text-log item fills the form in place: a match exactly like an
   * identify match (with the amount the user's words stated), an estimate
   * exactly like an accepted photo estimate. Multi-item results never reach
   * here — they bulk-log from the overlay's review list instead.
   */
  function handleTextItem(item: ResolvedTextLogItem) {
    if (item.foodId) {
      const food = foods.find((f) => f.id === item.foodId);
      if (food) {
        selectFood(food);
        setValues((v) => ({ ...v, amount: String(item.amount), unit: item.unit }));
        setAiEstimatedWeight(false);
      }
    } else {
      applyEstimate({
        id: crypto.randomUUID(),
        name: item.name,
        servingLabel: item.anchor.servingLabel,
        calories: item.calories,
        fat: item.fat,
        carbs: item.carbs,
        protein: item.protein,
      });
    }
    setMeal(item.meal);
    setTextLogging(false);
  }

  /**
   * An accepted AI estimate fills the form in place as a new one-serving food,
   * mirroring what a search prefill seeds at mount.
   */
  function applyEstimate(result: FoodSearchResult) {
    setFoodId(undefined);
    setDescription('');
    setRecipe('');
    setRecipeOpen(false);
    setViewingRecipe(false);
    setAnchorFields(anchorToFields(result));
    setAiEstimatedWeight(false);
    setAiPrefilled(true);
    setValues((v) => ({
      ...v,
      name: result.name,
      amount: '1',
      unit: result.servingLabel,
      calories: numToField(result.calories),
      carbs: numToField(result.carbs),
      protein: numToField(result.protein),
      fat: numToField(result.fat),
    }));
    setEstimateHandoff(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const anchorResult = anchorFieldsActive ? validateServingAnchor(anchorFields) : null;
    const anchor: ServingAnchor | null =
      anchorResult !== null ? (anchorResult.ok ? anchorResult.parsed : null) : activeAnchor;
    const result = validateEntryForm(values, anchor ?? inlineAnchor);
    if (!result.ok || anchor === null) {
      setErrors(result.ok ? {} : result.errors);
      setAnchorErrors(anchorResult && !anchorResult.ok ? anchorResult.errors : {});
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
    setAnchorErrors({});
    setSaving(true);
    setSaveFailed(false);
    const quantity = deriveQuantity(result.parsed.amount, result.parsed.unit, anchor);
    try {
      if (editing) {
        await updateEntry({ ...editing, ...result.parsed, quantity, meal, foodId });
      } else {
        await addEntry({
          ...result.parsed,
          ...anchor,
          quantity,
          date,
          meal,
          source: prefill || aiPrefilled ? 'search' : 'manual',
          foodId,
          description: description.trim() || undefined,
          recipe: recipe.trim() || undefined,
        });
      }
      if (showLibraryAnchorEditor && matchedFood) {
        await updateFood({
          ...matchedFood,
          servingLabel: anchor.servingLabel,
          servingSize: anchor.servingSize,
          calories: result.parsed.calories,
          carbs: result.parsed.carbs,
          protein: result.parsed.protein,
          fat: result.parsed.fat,
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
        aria-label={editing ? 'Edit food entry' : 'Log food entry'}
      >
        <div className="sheet-handle" aria-hidden="true" />
        <div className="entry-form-header">
          <h2>{editing ? 'Edit food' : 'Log food'}</h2>
          {!editing && (
            <div className="entry-form-header-chips">
              <button
                type="button"
                className="ghost-chip"
                onClick={() => setTextLogging(true)}
                aria-label="Log foods from a text description"
                title="Log foods from a text description"
              >
                ✦ Describe
              </button>
              <button
                type="button"
                className="ghost-chip"
                onClick={() => setIdentifying(true)}
                aria-label="Identify food from a photo"
                title="Identify food from a photo"
              >
                ✦ Photo
              </button>
            </div>
          )}
        </div>

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
            // A prefilled or edited name is settled; don't pop the dropdown
            // and mobile keyboard until the user taps the field themselves
            autoFocus={!editing && !prefill}
          />
          {errors.name && <span className="field-error">{errors.name}</span>}
          {matchedFood?.description && (
            <span className="combobox-selected-desc">{matchedFood.description}</span>
          )}
          {matchedFood?.recipe && (
            <>
              <button
                type="button"
                className="link-button"
                onClick={() => setViewingRecipe((v) => !v)}
              >
                {viewingRecipe ? 'Hide recipe' : 'View recipe'}
              </button>
              {viewingRecipe && <p className="food-recipe">{matchedFood.recipe}</p>}
            </>
          )}
        </div>

        {showAnchorEditor && (
          <>
            <label>
              Description (optional)
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brand, prep, weights — saved to your food library"
              />
            </label>

            {recipeOpen ? (
              <label>
                Recipe (optional)
                <textarea
                  value={recipe}
                  onChange={(e) => setRecipe(e.target.value)}
                  placeholder="Prep steps — saved to your food library"
                  rows={4}
                />
              </label>
            ) : (
              <button type="button" className="link-button" onClick={() => setRecipeOpen(true)}>
                + Add recipe
              </button>
            )}
          </>
        )}

        <fieldset className="segmented-field" aria-label="Meal">
          <legend>Meal</legend>
          <div className="segmented">
            {MEALS.map((m) => (
              <label key={m} className={`segment${meal === m ? ' segment-active' : ''}`}>
                <input
                  type="radio"
                  name={`${nameInputId}-meal`}
                  value={m}
                  checked={meal === m}
                  onChange={() => setMeal(m)}
                />
                {MEAL_LABELS[m]}
              </label>
            ))}
          </div>
        </fieldset>

        {showAnchorEditor && (
          <ServingAnchorFields values={anchorFields} errors={anchorErrors} onChange={setAnchorField} />
        )}

        <div className="field">
          <label htmlFor={amountInputId}>Amount</label>
          <div className="amount-unit">
            <input
              id={amountInputId}
              inputMode="decimal"
              value={values.amount}
              onChange={(e) => setField('amount', e.target.value)}
            />
            <select
              aria-label="Unit"
              value={unitOptions.includes(values.unit) ? values.unit : unitOptions[0]}
              onChange={(e) => setField('unit', e.target.value)}
            >
              {unitOptions.map((u) => (
                <option key={u} value={u}>
                  {unitLabel(u)}
                </option>
              ))}
            </select>
          </div>
          {(errors.amount || errors.unit) && (
            <span className="field-error">{errors.amount ?? errors.unit}</span>
          )}
          {aiEstimatedWeight && (
            <p className="form-note">Weight estimated by AI from the photo — check it.</p>
          )}
        </div>

        {(preview || !nutritionOpen) && (
          <div className="entry-nutrition-summary">
            {preview && (
              <p className="entry-computed" data-testid="entry-preview">
                {preview.calories} kcal · F {preview.fat} g · C {preview.carbs} g · P{' '}
                {preview.protein} g
              </p>
            )}
            <p className="entry-per-serving">
              per 1 {activeAnchor.servingLabel}
              {activeAnchor.servingSize
                ? ` (= ${activeAnchor.servingSize.amount} ${unitLabel(activeAnchor.servingSize.unit)})`
                : ''}
              : {values.calories.trim() || '—'} kcal
              {!nutritionOpen && (
                <>
                  {' · '}
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => {
                      if (matchedFood) setAnchorFields(anchorToFields(matchedFood));
                      setNutritionOpen(true);
                    }}
                  >
                    Edit nutrition
                  </button>
                </>
              )}
            </p>
          </div>
        )}

        {nutritionOpen && (
          <>
            {showLibraryAnchorEditor && (
              <ServingAnchorFields
                values={anchorFields}
                errors={anchorErrors}
                onChange={setAnchorField}
                note="Updates your food library"
              />
            )}

            <label>
              {CALORIE_FIELD.label}
              <span className="per-serving-hint"> — per 1 {activeAnchor.servingLabel}</span>
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
                  {missingFromSearch.has(key) && (
                    <span className="flag-hint"> — missing, confirm</span>
                  )}
                  <input
                    inputMode="decimal"
                    value={values[key]}
                    onChange={(e) => setField(key, e.target.value)}
                  />
                  {errors[key] && <span className="field-error">{errors[key]}</span>}
                </label>
              ))}
            </div>
          </>
        )}

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

      {textLogging && (
        <TextLogOverlay
          foods={foods}
          date={date}
          meal={meal}
          onSingleItem={handleTextItem}
          onLogged={onClose}
          onCancel={() => setTextLogging(false)}
        />
      )}

      {identifying && (
        <IdentifyOverlay
          foods={foods}
          onMatch={handleIdentified}
          onEstimateFallback={(image, note) => {
            setIdentifying(false);
            setEstimateHandoff({ image, note });
          }}
          onCancel={() => setIdentifying(false)}
        />
      )}

      {estimateHandoff && (
        <AiAnalyzeOverlay
          initialImage={estimateHandoff.image}
          initialNote={estimateHandoff.note}
          onAccept={applyEstimate}
          onCancel={() => setEstimateHandoff(null)}
        />
      )}
    </div>
  );
}
