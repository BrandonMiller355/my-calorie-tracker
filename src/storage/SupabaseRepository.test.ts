import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseRepository } from './SupabaseRepository';
import type { FoodEntry, Goals, LibraryFood } from '../types';

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
  for (const method of ['select', 'insert', 'update', 'delete', 'upsert', 'eq', 'is', 'maybeSingle']) {
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
    rpc: (fn: string, params: unknown) => {
      calls.push({ method: 'rpc', args: [fn, params] });
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
  food_id: null,
};

const food: LibraryFood = {
  id: 'food-1',
  name: 'PB&J',
  description: '15g jelly, 16g pbfit, 2 sara lee slices',
  servingDesc: '1 sandwich',
  calories: 380,
  carbs: 45,
  protein: 14,
  fat: 12,
  source: 'manual',
};

const foodRow = {
  id: 'food-1',
  name: 'PB&J',
  description: '15g jelly, 16g pbfit, 2 sara lee slices',
  serving_desc: '1 sandwich',
  calories: 380,
  carbs: 45,
  protein: 14,
  fat: 12,
  source: 'manual',
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

  it('getDefaultGoals reads the single goals row and returns null when absent', async () => {
    const goals: Goals = { calories: 2200, carbs: 250, protein: 140, fat: 70 };
    const withRow = fakeClient({ data: goals });
    await expect(new SupabaseRepository(withRow.client).getDefaultGoals()).resolves.toEqual(goals);
    expect(withRow.calls.map((c) => c.method)).toEqual(['from', 'select', 'maybeSingle']);

    const withoutRow = fakeClient({ data: null });
    await expect(new SupabaseRepository(withoutRow.client).getDefaultGoals()).resolves.toBeNull();
  });

  it('saveDefaultGoals upserts the goals payload', async () => {
    const goals: Goals = { calories: 2200, carbs: 250, protein: 140, fat: 70 };
    const { client, calls } = fakeClient();
    await new SupabaseRepository(client).saveDefaultGoals(goals);

    expect(calls).toEqual([
      { method: 'from', args: ['goals'] },
      { method: 'upsert', args: [goals] },
    ]);
  });

  it('getGoalsForDate reads the daily_goals row for that date and returns null when absent', async () => {
    const goals: Goals = { calories: 1800, carbs: 200, protein: 120, fat: 60 };
    const withRow = fakeClient({ data: goals });
    await expect(
      new SupabaseRepository(withRow.client).getGoalsForDate('2026-07-05'),
    ).resolves.toEqual(goals);
    expect(withRow.calls).toEqual([
      { method: 'from', args: ['daily_goals'] },
      { method: 'select', args: ['calories, carbs, protein, fat'] },
      { method: 'eq', args: ['date', '2026-07-05'] },
      { method: 'maybeSingle', args: [] },
    ]);

    const withoutRow = fakeClient({ data: null });
    await expect(
      new SupabaseRepository(withoutRow.client).getGoalsForDate('2026-07-05'),
    ).resolves.toBeNull();
  });

  it('saveGoalsForDate upserts the goals payload with the date', async () => {
    const goals: Goals = { calories: 1800, carbs: 200, protein: 120, fat: 60 };
    const { client, calls } = fakeClient();
    await new SupabaseRepository(client).saveGoalsForDate('2026-07-05', goals);

    expect(calls).toEqual([
      { method: 'from', args: ['daily_goals'] },
      { method: 'upsert', args: [{ ...goals, date: '2026-07-05' }] },
    ]);
  });

  it('clearGoalsForDate deletes the daily_goals row for that date', async () => {
    const { client, calls } = fakeClient();
    await new SupabaseRepository(client).clearGoalsForDate('2026-07-05');

    expect(calls).toEqual([
      { method: 'from', args: ['daily_goals'] },
      { method: 'delete', args: [] },
      { method: 'eq', args: ['date', '2026-07-05'] },
    ]);
  });

  it('getFoods selects non-archived foods and maps snake_case rows', async () => {
    const { client, calls } = fakeClient({ data: [foodRow] });
    const foods = await new SupabaseRepository(client).getFoods();

    expect(calls).toEqual([
      { method: 'from', args: ['foods'] },
      { method: 'select', args: ['*'] },
      { method: 'is', args: ['archived_at', null] },
    ]);
    expect(foods).toEqual([food]);
  });

  it('addFood inserts a snake_case row, mapping missing optionals to null', async () => {
    const { client, calls } = fakeClient();
    const { description: _d, servingDesc: _s, ...bare } = food;
    await new SupabaseRepository(client).addFood(bare);

    expect(calls).toEqual([
      { method: 'from', args: ['foods'] },
      { method: 'insert', args: [{ ...foodRow, description: null, serving_desc: null }] },
    ]);
  });

  it('updateFood updates by id without repeating id in the payload', async () => {
    const { client, calls } = fakeClient();
    await new SupabaseRepository(client).updateFood(food);

    const { id: _id, ...rowWithoutId } = foodRow;
    expect(calls).toEqual([
      { method: 'from', args: ['foods'] },
      { method: 'update', args: [rowWithoutId] },
      { method: 'eq', args: ['id', 'food-1'] },
    ]);
  });

  it('archiveFood stamps archived_at instead of deleting', async () => {
    const { client, calls } = fakeClient();
    await new SupabaseRepository(client).archiveFood('food-1');

    expect(calls).toEqual([
      { method: 'from', args: ['foods'] },
      { method: 'update', args: [{ archived_at: expect.any(String) }] },
      { method: 'eq', args: ['id', 'food-1'] },
    ]);
  });

  it('getMealSuggestions calls the meal_suggestions function and splits the groups', async () => {
    const other = { ...foodRow, id: 'food-2', name: 'Oatmeal' };
    const { client, calls } = fakeClient({
      data: [
        { ...foodRow, suggestion_group: 'recent' },
        { ...other, suggestion_group: 'most_used' },
      ],
    });
    const suggestions = await new SupabaseRepository(client).getMealSuggestions('breakfast');

    expect(calls).toEqual([{ method: 'rpc', args: ['meal_suggestions', { p_meal: 'breakfast' }] }]);
    expect(suggestions).toEqual({
      recent: [food],
      mostUsed: [{ ...food, id: 'food-2', name: 'Oatmeal' }],
    });
  });

  it.each([
    ['getEntriesByDate', (r: SupabaseRepository) => r.getEntriesByDate('2026-07-05')],
    ['addEntry', (r: SupabaseRepository) => r.addEntry(entry)],
    ['updateEntry', (r: SupabaseRepository) => r.updateEntry(entry)],
    ['deleteEntry', (r: SupabaseRepository) => r.deleteEntry('id-1')],
    ['getDefaultGoals', (r: SupabaseRepository) => r.getDefaultGoals()],
    [
      'saveDefaultGoals',
      (r: SupabaseRepository) => r.saveDefaultGoals({ calories: 1, carbs: 1, protein: 1, fat: 1 }),
    ],
    ['getGoalsForDate', (r: SupabaseRepository) => r.getGoalsForDate('2026-07-05')],
    [
      'saveGoalsForDate',
      (r: SupabaseRepository) =>
        r.saveGoalsForDate('2026-07-05', { calories: 1, carbs: 1, protein: 1, fat: 1 }),
    ],
    ['clearGoalsForDate', (r: SupabaseRepository) => r.clearGoalsForDate('2026-07-05')],
    ['getFoods', (r: SupabaseRepository) => r.getFoods()],
    ['addFood', (r: SupabaseRepository) => r.addFood(food)],
    ['updateFood', (r: SupabaseRepository) => r.updateFood(food)],
    ['archiveFood', (r: SupabaseRepository) => r.archiveFood('food-1')],
    ['getMealSuggestions', (r: SupabaseRepository) => r.getMealSuggestions('breakfast')],
  ])('%s throws when Supabase returns an error', async (_name, run) => {
    const { client } = fakeClient({ error: { message: 'permission denied' } });
    await expect(run(new SupabaseRepository(client))).rejects.toThrow(/permission denied/);
  });
});
