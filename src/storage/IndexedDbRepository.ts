import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { FoodEntry, Goals } from '../types';
import type { StorageRepository } from './StorageRepository';

interface CalTrackerDB extends DBSchema {
  entries: {
    key: string;
    value: FoodEntry;
    indexes: { 'by-date': string };
  };
  goals: {
    key: string;
    value: Goals;
  };
}

const DB_NAME = 'cal-tracker';
const DB_VERSION = 1;
const GOALS_KEY = 'goals';

export async function openCalTrackerDb(): Promise<IDBPDatabase<CalTrackerDB>> {
  return openDB<CalTrackerDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const entries = db.createObjectStore('entries', { keyPath: 'id' });
      entries.createIndex('by-date', 'date');
      db.createObjectStore('goals');
    },
  });
}

export class IndexedDbRepository implements StorageRepository {
  constructor(private db: IDBPDatabase<CalTrackerDB>) {}

  async getEntriesByDate(date: string): Promise<FoodEntry[]> {
    return this.db.getAllFromIndex('entries', 'by-date', date);
  }

  async addEntry(entry: FoodEntry): Promise<void> {
    await this.db.add('entries', entry);
  }

  async updateEntry(entry: FoodEntry): Promise<void> {
    await this.db.put('entries', entry);
  }

  async deleteEntry(id: string): Promise<void> {
    await this.db.delete('entries', id);
  }

  async getGoals(): Promise<Goals | null> {
    return (await this.db.get('goals', GOALS_KEY)) ?? null;
  }

  async saveGoals(goals: Goals): Promise<void> {
    await this.db.put('goals', goals, GOALS_KEY);
  }
}
