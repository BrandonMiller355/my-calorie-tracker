import type { LibraryFood, MealComponent, SavedMeal } from '../types';
import { availableUnits, deriveQuantity } from './units';

/** A meal component paired with its resolved library food and contribution. */
export interface ResolvedComponent {
  component: MealComponent;
  food: LibraryFood;
  /** The component's stored amount scaled by the portion being logged */
  amount: number;
  /** Servings multiplier derived from the scaled amount + the component's unit */
  quantity: number;
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
}

export interface MealTotals {
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
}

/** A saved meal resolved against the current library. */
export interface ResolvedMeal {
  /** Components whose food resolves and whose portion is loggable */
  resolved: ResolvedComponent[];
  /**
   * Components skipped at log time: the referenced food is archived/removed, or
   * its serving anchor no longer offers the component's unit.
   */
  unavailable: MealComponent[];
  /** Live totals summed over the resolved components only */
  totals: MealTotals;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Scaled amounts round to 2dp so what's shown is exactly what gets logged. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Resolve a saved meal's components against the current library foods, computing
 * each contribution live (reusing the serving-units multiplier) and summing the
 * totals. A component whose food is missing, or whose stored unit the food's
 * current anchor no longer offers, is reported as unavailable and excluded from
 * the totals rather than throwing.
 *
 * `portion` scales every component's amount by the same factor — half a meal is
 * half of each of its foods. Contributions are derived from the rounded scaled
 * amount, so the shown portion and its calories always agree.
 */
export function resolveMeal(meal: SavedMeal, foods: LibraryFood[], portion = 1): ResolvedMeal {
  const byId = new Map(foods.map((f) => [f.id, f]));
  const resolved: ResolvedComponent[] = [];
  const unavailable: MealComponent[] = [];

  for (const component of meal.items) {
    const food = byId.get(component.foodId);
    const anchor = food && { servingLabel: food.servingLabel, servingSize: food.servingSize };
    if (!food || !anchor || !availableUnits(anchor).includes(component.unit)) {
      unavailable.push(component);
      continue;
    }
    const amount = round2(component.amount * portion);
    const quantity = deriveQuantity(amount, component.unit, anchor);
    resolved.push({
      component,
      food,
      amount,
      quantity,
      calories: food.calories * quantity,
      carbs: food.carbs * quantity,
      protein: food.protein * quantity,
      fat: food.fat * quantity,
    });
  }

  const totals = resolved.reduce<MealTotals>(
    (acc, r) => ({
      calories: acc.calories + r.calories,
      carbs: acc.carbs + r.carbs,
      protein: acc.protein + r.protein,
      fat: acc.fat + r.fat,
    }),
    { calories: 0, carbs: 0, protein: 0, fat: 0 },
  );

  return {
    resolved,
    unavailable,
    totals: {
      calories: Math.round(totals.calories),
      carbs: round1(totals.carbs),
      protein: round1(totals.protein),
      fat: round1(totals.fat),
    },
  };
}
