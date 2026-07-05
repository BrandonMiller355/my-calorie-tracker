import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import type { FoodEntry } from '../types';
import { IndexedDbRepository, openCalTrackerDb } from './IndexedDbRepository';

function entry(overrides: Partial<FoodEntry> = {}): FoodEntry {
  return {
    id: crypto.randomUUID(),
    date: '2026-07-04',
    meal: 'lunch',
    name: 'Apple',
    quantity: 1,
    calories: 95,
    carbs: 25,
    protein: 0.5,
    fat: 0.3,
    source: 'manual',
    ...overrides,
  };
}

async function freshRepo(): Promise<IndexedDbRepository> {
  // Reset the fake IndexedDB between tests so state never leaks
  globalThis.indexedDB = new IDBFactory();
  return new IndexedDbRepository(await openCalTrackerDb());
}

describe('IndexedDbRepository', () => {
  it('adds and retrieves entries by date only', async () => {
    const repo = await freshRepo();
    const a = entry({ date: '2026-07-04', name: 'Toast' });
    const b = entry({ date: '2026-07-04', name: 'Eggs' });
    const other = entry({ date: '2026-07-05', name: 'Pasta' });
    await repo.addEntry(a);
    await repo.addEntry(b);
    await repo.addEntry(other);

    const day = await repo.getEntriesByDate('2026-07-04');
    expect(day.map((e) => e.name).sort()).toEqual(['Eggs', 'Toast']);
    expect(await repo.getEntriesByDate('2026-07-06')).toEqual([]);
  });

  it('updates an entry in place', async () => {
    const repo = await freshRepo();
    const e = entry({ calories: 100 });
    await repo.addEntry(e);
    await repo.updateEntry({ ...e, calories: 150, meal: 'dinner' });

    const [stored] = await repo.getEntriesByDate(e.date);
    expect(stored.calories).toBe(150);
    expect(stored.meal).toBe('dinner');
  });

  it('deletes an entry', async () => {
    const repo = await freshRepo();
    const e = entry();
    await repo.addEntry(e);
    await repo.deleteEntry(e.id);
    expect(await repo.getEntriesByDate(e.date)).toEqual([]);
  });

  it('returns null goals before any save, then round-trips goals', async () => {
    const repo = await freshRepo();
    expect(await repo.getGoals()).toBeNull();

    const goals = { calories: 1800, carbs: 200, protein: 140, fat: 60 };
    await repo.saveGoals(goals);
    expect(await repo.getGoals()).toEqual(goals);

    await repo.saveGoals({ ...goals, calories: 1900 });
    expect((await repo.getGoals())?.calories).toBe(1900);
  });
});
