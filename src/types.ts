export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snacks';

export const MEALS: readonly Meal[] = ['breakfast', 'lunch', 'dinner', 'snacks'];

export const MEAL_LABELS: Record<Meal, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snacks: 'Snacks',
};

export type WeightUnit = 'g' | 'oz' | 'lb' | 'kg';
export type VolumeUnit = 'ml' | 'floz' | 'cup' | 'tbsp' | 'tsp';
export type MeasureUnit = WeightUnit | VolumeUnit;

/** What one count of a food equals in a single dimension (weight or volume). */
export interface ServingSize {
  amount: number;
  unit: MeasureUnit;
}

/**
 * Serving anchor: nutrition values are per one `servingLabel` (e.g. "serving",
 * "can (drained)"); `servingSize` optionally states what that count equals,
 * unlocking same-dimension measure units for logging.
 */
export interface ServingAnchor {
  servingLabel: string;
  servingSize?: ServingSize;
}

export const DEFAULT_SERVING_LABEL = 'serving';

export interface FoodEntry extends ServingAnchor {
  id: string;
  /** Local calendar date, YYYY-MM-DD */
  date: string;
  meal: Meal;
  name: string;
  /** What the user logged, e.g. 45 */
  amount: number;
  /** A MeasureUnit or the entry's own servingLabel */
  unit: string;
  /** Serving multiplier derived from amount+unit at save; nutrition fields are per single serving */
  quantity: number;
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  /** 'quick' entries are calories-only estimates that never touch the library */
  source: 'manual' | 'search' | 'quick';
  /** Library food this entry came from; nutrition and anchor are still snapshots */
  foodId?: string;
  /** Free-text context for quick entries; stored on the entry, not a library food */
  description?: string;
}

/** A saved food in the user's personal library; nutrition is per serving. */
export interface LibraryFood extends ServingAnchor {
  id: string;
  name: string;
  /** Brand, prep notes, weights — shown as the secondary line in the picker */
  description?: string;
  /** Free-text prep instructions, shown collapsed wherever the food appears */
  recipe?: string;
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  source: 'manual' | 'search';
  /** ISO timestamp; archived foods are hidden from suggestions and search */
  archivedAt?: string;
}

/** Per-meal picker suggestions; groups never repeat a food. */
export interface MealSuggestions {
  recent: LibraryFood[];
  mostUsed: LibraryFood[];
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

/** One date's contribution to a weekly deficit calculation. */
export interface WeekDeficitDay {
  /** Local calendar date, YYYY-MM-DD */
  date: string;
  consumedCalories: number;
  /** The day's calorie-burn goal: its own override, else the default. */
  effectiveGoalCalories: number;
  hasEntries: boolean;
}

/** A food found via external search; nutrients may be unknown (undefined, never 0). */
export interface FoodSearchResult extends ServingAnchor {
  id: string;
  name: string;
  brand?: string;
  calories?: number;
  carbs?: number;
  protein?: number;
  fat?: number;
}
