export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snacks';

export const MEALS: readonly Meal[] = ['breakfast', 'lunch', 'dinner', 'snacks'];

export const MEAL_LABELS: Record<Meal, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snacks: 'Snacks',
};

export interface FoodEntry {
  id: string;
  /** Local calendar date, YYYY-MM-DD */
  date: string;
  meal: Meal;
  name: string;
  servingDesc?: string;
  /** Serving multiplier; nutrition fields are per single serving */
  quantity: number;
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  source: 'manual' | 'search';
}

export interface Goals {
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
}

export const DEFAULT_GOALS: Goals = {
  calories: 2000,
  carbs: 250,
  protein: 100,
  fat: 65,
};

/** A food found via external search; nutrients may be unknown (undefined, never 0). */
export interface FoodSearchResult {
  id: string;
  name: string;
  brand?: string;
  servingDesc?: string;
  calories?: number;
  carbs?: number;
  protein?: number;
  fat?: number;
}
