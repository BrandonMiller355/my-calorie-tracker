import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseRepository } from './SupabaseRepository';
import type { FoodEntry, Goals } from '../types';

interface Call {
  method: string;
  args: unknown[];
}

interface FakeResult {
  data?: unknown;
  error?: { message: string } | null;
}

/**
 * Chainable stand-in for the PostgREST query builder: every method records
 * the call and returns the builder; awaiting it resolves to the given result.
 */
function fakeClient(result: FakeResult = {}) {
  const calls: Call[] = [];
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'insert', 'update', 'delete', 'upsert', 'eq', 'maybeSingle']) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  }
  builder.then = (
    onFulfilled: (v: unknown) => unknown,
    onRejected?: (e: unknown) => unknown,
  ) => Promise.resolve({ data: null, error: null, ...result }).then(onFulfilled, onRejected);

  const client = {
    from: (table: string) => {
      calls.push({ method: 'from', args: [table] });
      return builder;
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

const entry: FoodEntry = {
  id: 'id-1',
  date: '2026-07-05',
  meal: 'breakfast',
  name: 'Oatmeal',
  servingDesc: '1 cup',
  quantity: 1.5,
  calories: 300,
  carbs: 54,
  protein: 10,
  fat: 5,
  source: 'search',
};

const entryRow = {
  id: 'id-1',
  date: '2026-07-05',
  meal: 'breakfast',
  name: 'Oatmeal',
  serving_desc: '1 cup',
  quantity: 1.5,
  calories: 300,
  carbs: 54,
  protein: 10,
  fat: 5,
  source: 'search',
};

describe('SupabaseRepository', () => {
  it('getEntriesByDate queries food_entries by date and maps snake_case rows', async () => {
    const { client, calls } = fakeClient({ data: [entryRow] });
    const entries = await new SupabaseRepository(client).getEntriesByDate('2026-07-05');

    expect(calls).toEqual([
      { method: 'from', args: ['food_entries'] },
      { method: 'select', args: ['*'] },
      { method: 'eq', args: ['date', '2026-07-05'] },
    ]);
    expect(entries).toEqual([entry]);
  });

  it('maps a null serving_desc to an absent servingDesc', async () => {
    const { client } = fakeClient({ data: [{ ...entryRow, serving_desc: null }] });
    const [mapped] = await new SupabaseRepository(client).getEntriesByDate('2026-07-05');
    expect(mapped.servingDesc).toBeUndefined();
  });

  it('addEntry inserts a snake_case row, mapping missing servingDesc to null', async () => {
    const { client, calls } = fakeClient();
    const { servingDesc: _omitted, ...withoutServing } = entry;
    await new SupabaseRepository(client).addEntry(withoutServing);

    expect(calls[0]).toEqual({ method: 'from', args: ['food_entries'] });
    expect(calls[1]).toEqual({
      method: 'insert',
      args: [{ ...entryRow, serving_desc: null }],
    });
  });

  it('updateEntry updates by id without repeating id in the payload', async () => {
    const { client, calls } = fakeClient();
    await new SupabaseRepository(client).updateEntry(entry);

    const { id: _id, ...rowWithoutId } = entryRow;
    expect(calls).toEqual([
      { method: 'from', args: ['food_entries'] },
      { method: 'update', args: [rowWithoutId] },
      { method: 'eq', args: ['id', 'id-1'] },
    ]);
  });

  it('deleteEntry deletes by id', async () => {
    const { client, calls } = fakeClient();
    await new SupabaseRepository(client).deleteEntry('id-1');

    expect(calls).toEqual([
      { method: 'from', args: ['food_entries'] },
      { method: 'delete', args: [] },
      { method: 'eq', args: ['id', 'id-1'] },
    ]);
  });

  it('getGoals reads the single goals row and returns null when absent', async () => {
    const goals: Goals = { calories: 2200, carbs: 250, protein: 140, fat: 70 };
    const withRow = fakeClient({ data: goals });
    await expect(new SupabaseRepository(withRow.client).getGoals()).resolves.toEqual(goals);
    expect(withRow.calls.map((c) => c.method)).toEqual(['from', 'select', 'maybeSingle']);

    const withoutRow = fakeClient({ data: null });
    await expect(new SupabaseRepository(withoutRow.client).getGoals()).resolves.toBeNull();
  });

  it('saveGoals upserts the goals payload', async () => {
    const goals: Goals = { calories: 2200, carbs: 250, protein: 140, fat: 70 };
    const { client, calls } = fakeClient();
    await new SupabaseRepository(client).saveGoals(goals);

    expect(calls).toEqual([
      { method: 'from', args: ['goals'] },
      { method: 'upsert', args: [goals] },
    ]);
  });

  it.each([
    ['getEntriesByDate', (r: SupabaseRepository) => r.getEntriesByDate('2026-07-05')],
    ['addEntry', (r: SupabaseRepository) => r.addEntry(entry)],
    ['updateEntry', (r: SupabaseRepository) => r.updateEntry(entry)],
    ['deleteEntry', (r: SupabaseRepository) => r.deleteEntry('id-1')],
    ['getGoals', (r: SupabaseRepository) => r.getGoals()],
    [
      'saveGoals',
      (r: SupabaseRepository) => r.saveGoals({ calories: 1, carbs: 1, protein: 1, fat: 1 }),
    ],
  ])('%s throws when Supabase returns an error', async (_name, run) => {
    const { client } = fakeClient({ error: { message: 'permission denied' } });
    await expect(run(new SupabaseRepository(client))).rejects.toThrow(/permission denied/);
  });
});
