export interface EntryFormValues {
  name: string;
  quantity: string;
  calories: string;
  carbs: string;
  protein: string;
  fat: string;
}

export type EntryFormErrors = Partial<Record<keyof EntryFormValues, string>>;

export interface ParsedEntryValues {
  name: string;
  quantity: number;
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

export interface FoodFormValues {
  name: string;
  description: string;
  servingDesc: string;
  calories: string;
  carbs: string;
  protein: string;
  fat: string;
}

export type FoodFormErrors = Partial<Record<keyof FoodFormValues, string>>;

export interface ParsedFoodValues {
  name: string;
  description?: string;
  servingDesc?: string;
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

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    parsed: {
      name,
      description: values.description.trim() || undefined,
      servingDesc: values.servingDesc.trim() || undefined,
      calories: calories as number,
      carbs: nutrients.carbs as number,
      protein: nutrients.protein as number,
      fat: nutrients.fat as number,
    },
  };
}

export function validateEntryForm(
  values: EntryFormValues,
): { ok: true; parsed: ParsedEntryValues } | { ok: false; errors: EntryFormErrors } {
  const errors: EntryFormErrors = {};

  const name = values.name.trim();
  if (!name) errors.name = 'Name is required';

  const quantity = parseNonNegative(values.quantity);
  if (quantity === null || quantity <= 0) {
    errors.quantity = 'Quantity must be a number greater than 0';
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
      quantity: quantity as number,
      calories: calories as number,
      carbs: nutrients.carbs as number,
      protein: nutrients.protein as number,
      fat: nutrients.fat as number,
    },
  };
}
