/** Energy per gram, by macro (Atwater general factors). */
const KCAL_PER_GRAM = { carbs: 4, protein: 4, fat: 9 } as const;

export interface MacroMismatch {
  expected: number;
  entered: number;
}

/**
 * Flags entries where the entered calories don't roughly match what the
 * macros add up to. Skipped when all three macros are 0 (nothing to check
 * against — e.g. macros were left blank), and allows generous slack
 * otherwise since food labels round each value independently.
 */
export function checkMacroCalories(
  calories: number,
  carbs: number,
  protein: number,
  fat: number,
): MacroMismatch | null {
  if (carbs === 0 && protein === 0 && fat === 0) return null;

  const expected = carbs * KCAL_PER_GRAM.carbs + protein * KCAL_PER_GRAM.protein + fat * KCAL_PER_GRAM.fat;
  const tolerance = Math.max(50, expected * 0.2);
  if (Math.abs(expected - calories) <= tolerance) return null;

  return { expected: Math.round(expected), entered: calories };
}
