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

const NUTRIENT_FIELDS = ['calories', 'carbs', 'protein', 'fat'] as const;

/** Strict non-negative number parse; rejects '', '12abc', negatives, NaN. */
function parseNonNegative(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
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

  const nutrients: Partial<ParsedEntryValues> = {};
  for (const field of NUTRIENT_FIELDS) {
    const parsed = parseNonNegative(values[field]);
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
      calories: nutrients.calories as number,
      carbs: nutrients.carbs as number,
      protein: nutrients.protein as number,
      fat: nutrients.fat as number,
    },
  };
}
