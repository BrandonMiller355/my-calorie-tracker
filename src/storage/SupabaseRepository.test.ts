import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseRepository } from './SupabaseRepository';
import { DEFAULT_GOALS, type FoodEntry, type Goals, type LibraryFood } from '../types';

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
  amount: 1.5,
  unit: 'cup',
  servingLabel: 'serving',
  servingSize: { amount: 1, unit: 'cup' },
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
  amount: 1.5,
  unit: 'cup',
  serving_label: 'serving',
  serving_size_amount: 1,
  serving_size_unit: 'cup',
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
  recipe: 'Spread pbfit, add jelly, close sandwich',
  servingLabel: 'sandwich',
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
  recipe: 'Spread pbfit, add jelly, close sandwich',
  serving_label: 'sandwich',
  serving_size_amount: null,
  serving_size_unit: null,
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

  it('maps null serving size columns to an absent servingSize', async () => {
    const { client } = fakeClient({
      data: [{ ...entryRow, serving_size_amount: null, serving_size_unit: null }],
    });
    const [mapped] = await new SupabaseRepository(client).getEntriesByDate('2026-07-05');
    expect(mapped.servingSize).toBeUndefined();
  });

  it('addEntry inserts a snake_case row, mapping a missing servingSize to nulls', async () => {
    const { client, calls } = fakeClient();
    const { servingSize: _omitted, ...withoutSize } = entry;
    await new SupabaseRepository(client).addEntry({ ...withoutSize, unit: 'serving' });

    expect(calls[0]).toEqual({ method: 'from', args: ['food_entries'] });
    expect(calls[1]).toEqual({
      method: 'insert',
      args: [
        { ...entryRow, unit: 'serving', serving_size_amount: null, serving_size_unit: null },
      ],
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
    const { description: _d, recipe: _r, ...bare } = food;
    await new SupabaseRepository(client).addFood(bare);

    expect(calls).toEqual([
      { method: 'from', args: ['foods'] },
      { method: 'insert', args: [{ ...foodRow, description: null, recipe: null }] },
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

  it('getWeekDeficitSummary calls the RPC with the date range and maps snake_case rows', async () => {
    const rows = [
      { date: '2026-06-29', consumed_calories: 1800, effective_goal_calories: 2000, has_entries: true },
      { date: '2026-06-30', consumed_calories: 0, effective_goal_calories: 2100, has_entries: false },
    ];
    const { client, calls } = fakeClient({ data: rows });
    const summary = await new SupabaseRepository(client).getWeekDeficitSummary(
      '2026-06-29',
      '2026-06-30',
    );

    expect(calls).toEqual([
      {
        method: 'rpc',
        args: ['week_deficit_summary', { p_from: '2026-06-29', p_through: '2026-06-30' }],
      },
    ]);
    expect(summary).toEqual([
      { date: '2026-06-29', consumedCalories: 1800, effectiveGoalCalories: 2000, hasEntries: true },
      { date: '2026-06-30', consumedCalories: 0, effectiveGoalCalories: 2100, hasEntries: false },
    ]);
  });

  it('getWeeklyDeficitGoal reads the weekly_deficit_goal column and returns null when absent', async () => {
    const withValue = fakeClient({ data: { weekly_deficit_goal: 3500 } });
    await expect(
      new SupabaseRepository(withValue.client).getWeeklyDeficitGoal(),
    ).resolves.toBe(3500);
    expect(withValue.calls).toEqual([
      { method: 'from', args: ['goals'] },
      { method: 'select', args: ['weekly_deficit_goal'] },
      { method: 'maybeSingle', args: [] },
    ]);

    const withoutValue = fakeClient({ data: { weekly_deficit_goal: null } });
    await expect(
      new SupabaseRepository(withoutValue.client).getWeeklyDeficitGoal(),
    ).resolves.toBeNull();
  });

  it('saveWeeklyDeficitGoal carries existing goal columns through the upsert', async () => {
    const existing: Goals = { calories: 2200, carbs: 250, protein: 140, fat: 70 };
    const { client, calls } = fakeClient({ data: existing });
    await new SupabaseRepository(client).saveWeeklyDeficitGoal(3500);

    expect(calls).toEqual([
      { method: 'from', args: ['goals'] },
      { method: 'select', args: ['calories, carbs, protein, fat'] },
      { method: 'maybeSingle', args: [] },
      { method: 'from', args: ['goals'] },
      { method: 'upsert', args: [{ ...existing, weekly_deficit_goal: 3500 }] },
    ]);
  });

  it('saveWeeklyDeficitGoal falls back to DEFAULT_GOALS when no goals row exists yet', async () => {
    const { client, calls } = fakeClient({ data: null });
    await new SupabaseRepository(client).saveWeeklyDeficitGoal(3500);

    expect(calls[calls.length - 1]).toEqual({
      method: 'upsert',
      args: [{ ...DEFAULT_GOALS, weekly_deficit_goal: 3500 }],
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
    [
      'getWeekDeficitSummary',
      (r: SupabaseRepository) => r.getWeekDeficitSummary('2026-06-29', '2026-07-05'),
    ],
    ['getWeeklyDeficitGoal', (r: SupabaseRepository) => r.getWeeklyDeficitGoal()],
    ['saveWeeklyDeficitGoal', (r: SupabaseRepository) => r.saveWeeklyDeficitGoal(3500)],
  ])('%s throws when Supabase returns an error', async (_name, run) => {
    const { client } = fakeClient({ error: { message: 'permission denied' } });
    await expect(run(new SupabaseRepository(client))).rejects.toThrow(/permission denied/);
  });
});
