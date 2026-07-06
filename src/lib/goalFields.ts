import type { Goals } from '../types';

export const GOAL_FIELDS: readonly { key: keyof Goals; label: string }[] = [
  { key: 'calories', label: 'Calorie burn (kcal)' },
  { key: 'fat', label: 'Fat (g)' },
  { key: 'carbs', label: 'Carbs (g)' },
  { key: 'protein', label: 'Protein (g)' },
];

export function goalsToFormValues(goals: Goals): Record<keyof Goals, string> {
  return {
    calories: String(goals.calories),
    carbs: String(goals.carbs),
    protein: String(goals.protein),
    fat: String(goals.fat),
  };
}

/** Parses goal form input; all fields must be numbers greater than 0. */
export function parseGoalsForm(
  values: Record<keyof Goals, string>,
): { ok: true; goals: Goals } | { ok: false; error: string } {
  const parsed = {} as Goals;
  for (const { key } of GOAL_FIELDS) {
    const n = Number(values[key].trim());
    if (values[key].trim() === '' || !Number.isFinite(n) || n <= 0) {
      return { ok: false, error: 'All goals must be numbers greater than 0.' };
    }
    parsed[key] = n;
  }
  return { ok: true, goals: parsed };
}
