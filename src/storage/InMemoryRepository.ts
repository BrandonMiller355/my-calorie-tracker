import type { FoodEntry, Goals } from '../types';
import type { StorageRepository } from './StorageRepository';

/** Fallback used when IndexedDB is unavailable; data lives only for the session. */
export class InMemoryRepository implements StorageRepository {
  private entries = new Map<string, FoodEntry>();
  private goals: Goals | null = null;

  async getEntriesByDate(date: string): Promise<FoodEntry[]> {
    return [...this.entries.values()].filter((e) => e.date === date);
  }

  async addEntry(entry: FoodEntry): Promise<void> {
    this.entries.set(entry.id, { ...entry });
  }

  async updateEntry(entry: FoodEntry): Promise<void> {
    this.entries.set(entry.id, { ...entry });
  }

  async deleteEntry(id: string): Promise<void> {
    this.entries.delete(id);
  }

  async getGoals(): Promise<Goals | null> {
    return this.goals ? { ...this.goals } : null;
  }

  async saveGoals(goals: Goals): Promise<void> {
    this.goals = { ...goals };
  }
}
