import { DEFAULT_SERVING_LABEL, type ServingAnchor } from '../types';
import { availableUnits, isMeasureUnit } from './units';

export interface EntryFormValues {
  name: string;
  amount: string;
  unit: string;
  calories: string;
  carbs: string;
  protein: string;
  fat: string;
}

export type EntryFormErrors = Partial<Record<keyof EntryFormValues, string>>;

export interface ParsedEntryValues {
  name: string;
  amount: number;
  unit: string;
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
}

const OPTIONAL_NUTRIENT_FIELDS = ['carbs', 'protein', 'fat'] as const;

/** Strict non-negative number parse; rejects '', '12abc', negatives, NaN. */
function parseNonNegative(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/** Like parseNonNegative, but blank input defaults to 0 instead of erroring. */
function parseOptionalNonNegative(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return 0;
  return parseNonNegative(raw);
}

/** Form fields for a serving anchor: label + optional equivalence. */
export interface ServingAnchorFormValues {
  servingLabel: string;
  servingSizeAmount: string;
  /** A MeasureUnit, or '' for no equivalence */
  servingSizeUnit: string;
}

export type ServingAnchorFormErrors = Partial<Record<keyof ServingAnchorFormValues, string>>;

/**
 * Blank label defaults to "serving". Labels must not collide with a measure
 * unit name (stored entry units couldn't be told apart). Equivalence needs
 * both amount and unit, with amount > 0; both blank means count-only.
 */
export function validateServingAnchor(
  values: ServingAnchorFormValues,
): { ok: true; parsed: ServingAnchor } | { ok: false; errors: ServingAnchorFormErrors } {
  const errors: ServingAnchorFormErrors = {};

  const servingLabel = values.servingLabel.trim() || DEFAULT_SERVING_LABEL;
  if (isMeasureUnit(servingLabel)) {
    errors.servingLabel = `"${servingLabel}" is a measurement unit — pick another name`;
  }

  const rawAmount = values.servingSizeAmount.trim();
  const unit = values.servingSizeUnit;
  let parsedSize: ServingAnchor['servingSize'];
  if (rawAmount === '' && unit === '') {
    parsedSize = undefined;
  } else if (unit === '') {
    errors.servingSizeUnit = 'Pick a unit for the serving size';
  } else if (!isMeasureUnit(unit)) {
    errors.servingSizeUnit = 'Unknown unit';
  } else {
    const amount = parseNonNegative(rawAmount);
    if (amount === null || amount <= 0) {
      errors.servingSizeAmount = 'Enter a number greater than 0';
    } else {
      parsedSize = { amount, unit };
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return { ok: true, parsed: { servingLabel, servingSize: parsedSize } };
}

export interface FoodFormValues extends ServingAnchorFormValues {
  name: string;
  description: string;
  calories: string;
  carbs: string;
  protein: string;
  fat: string;
}

export type FoodFormErrors = Partial<Record<keyof FoodFormValues, string>>;

export interface ParsedFoodValues extends ServingAnchor {
  name: string;
  description?: string;
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
}

/** Same rules as entries: name and calories required, macros default to 0. */
export function validateFoodForm(
  values: FoodFormValues,
): { ok: true; parsed: ParsedFoodValues } | { ok: false; errors: FoodFormErrors } {
  const errors: FoodFormErrors = {};

  const name = values.name.trim();
  if (!name) errors.name = 'Name is required';

  const anchor = validateServingAnchor(values);
  if (!anchor.ok) Object.assign(errors, anchor.errors);

  const calories = parseNonNegative(values.calories);
  if (calories === null) errors.calories = 'Enter a number of 0 or more';

  const nutrients: Partial<ParsedFoodValues> = {};
  for (const field of OPTIONAL_NUTRIENT_FIELDS) {
    const parsed = parseOptionalNonNegative(values[field]);
    if (parsed === null) {
      errors[field] = 'Enter a number of 0 or more';
    } else {
      nutrients[field] = parsed;
    }
  }

  if (Object.keys(errors).length > 0 || !anchor.ok) return { ok: false, errors };

  return {
    ok: true,
    parsed: {
      name,
      description: values.description.trim() || undefined,
      ...anchor.parsed,
      calories: calories as number,
      carbs: nutrients.carbs as number,
      protein: nutrients.protein as number,
      fat: nutrients.fat as number,
    },
  };
}

export function validateEntryForm(
  values: EntryFormValues,
  anchor: ServingAnchor,
): { ok: true; parsed: ParsedEntryValues } | { ok: false; errors: EntryFormErrors } {
  const errors: EntryFormErrors = {};

  const name = values.name.trim();
  if (!name) errors.name = 'Name is required';

  const amount = parseNonNegative(values.amount);
  if (amount === null || amount <= 0) {
    errors.amount = 'Amount must be a number greater than 0';
  }

  if (!availableUnits(anchor).includes(values.unit)) {
    errors.unit = 'Pick a unit';
  }

  const calories = parseNonNegative(values.calories);
  if (calories === null) errors.calories = 'Enter a number of 0 or more';

  const nutrients: Partial<ParsedEntryValues> = {};
  for (const field of OPTIONAL_NUTRIENT_FIELDS) {
    const parsed = parseOptionalNonNegative(values[field]);
    if (parsed === null) {
      errors[field] = 'Enter a number of 0 or more';
    } else {
      nutrients[field] = parsed;
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    parsed: {
      name,
      amount: amount as number,
      unit: values.unit,
      calories: calories as number,
      carbs: nutrients.carbs as number,
      protein: nutrients.protein as number,
      fat: nutrients.fat as number,
    },
  };
}
