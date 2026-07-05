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
  /** null when the user has never saved goals (app should use defaults). */
  getGoals(): Promise<Goals | null>;
  saveGoals(goals: Goals): Promise<void>;
}
