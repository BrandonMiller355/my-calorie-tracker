import type { FoodEntry } from '../types';

export interface Totals {
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
}

export const ZERO_TOTALS: Totals = { calories: 0, carbs: 0, protein: 0, fat: 0 };

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Nutrition for one entry, scaled by its serving quantity. */
export function entryTotals(entry: FoodEntry): Totals {
  return {
    calories: round1(entry.calories * entry.quantity),
    carbs: round1(entry.carbs * entry.quantity),
    protein: round1(entry.protein * entry.quantity),
    fat: round1(entry.fat * entry.quantity),
  };
}

/** Sum of scaled nutrition across entries; zeros for an empty list. */
export function sumTotals(entries: FoodEntry[]): Totals {
  return entries.reduce<Totals>((acc, e) => {
    const t = entryTotals(e);
    return {
      calories: round1(acc.calories + t.calories),
      carbs: round1(acc.carbs + t.carbs),
      protein: round1(acc.protein + t.protein),
      fat: round1(acc.fat + t.fat),
    };
  }, ZERO_TOTALS);
}
