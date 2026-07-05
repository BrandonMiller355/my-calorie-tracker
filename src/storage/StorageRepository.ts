import type { FoodEntry, Goals } from '../types';

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
  /** Per-day override; null when that date has none (app should use the default). */
  getGoalsForDate(date: string): Promise<Goals | null>;
  saveGoalsForDate(date: string, goals: Goals): Promise<void>;
  /** Removes the override so the date falls back to the default. */
  clearGoalsForDate(date: string): Promise<void>;
}
