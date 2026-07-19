import type {
  DayGoalOverride,
  FoodEntry,
  Goals,
  LibraryFood,
  Meal,
  MealSuggestions,
  WeekDeficitDay,
} from '../types';

/**
 * All persistence goes through this interface. UI code must never touch
 * IndexedDB directly, so a remote (hosted DB) implementation can be
 * substituted later without UI changes.
 */
export interface StorageRepository {
  /** Entries whose local date key (YYYY-MM-DD) matches exactly. */
  getEntriesByDate(date: string): Promise<FoodEntry[]>;
  addEntry(entry: FoodEntry): Promise<void>;
  updateEntry(entry: FoodEntry): Promise<void>;
  deleteEntry(id: string): Promise<void>;
  /** null when the user has never saved default goals (app should use DEFAULT_GOALS). */
  getDefaultGoals(): Promise<Goals | null>;
  saveDefaultGoals(goals: Goals): Promise<void>;
  /**
   * Per-day override; null when that date has none (app should use the
   * default). Calories is always present, but macros may be null — a
   * calories-only row written by the external burn sync — in which case the
   * app must fall back to the default goals per field.
   */
  getGoalsForDate(date: string): Promise<DayGoalOverride | null>;
  /** Saving from the app always persists all four values (macros become concrete). */
  saveGoalsForDate(date: string, goals: Goals): Promise<void>;
  /** Removes the override so the date falls back to the default. */
  clearGoalsForDate(date: string): Promise<void>;
  /** The user's full food library, excluding archived foods. */
  getFoods(): Promise<LibraryFood[]>;
  addFood(food: LibraryFood): Promise<void>;
  updateFood(food: LibraryFood): Promise<void>;
  /** Hides the food from suggestions and search; never deletes the row. */
  archiveFood(id: string): Promise<void>;
  /** Recent and most-used foods for a meal, computed server-side. */
  getMealSuggestions(meal: Meal): Promise<MealSuggestions>;
  /**
   * Per-date consumed calories, effective calorie-burn goal (day override
   * falling back to the default), and whether any entries exist, for every
   * date in `[from, through]` inclusive, computed server-side in one request.
   */
  getWeekDeficitSummary(from: string, through: string): Promise<WeekDeficitDay[]>;
  /** null when the user has never set a weekly deficit goal. */
  getWeeklyDeficitGoal(): Promise<number | null>;
  saveWeeklyDeficitGoal(goal: number): Promise<void>;
}
