import { act, renderHook, waitFor } from '@testing-library/react';
import { AppProvider, useAppState } from './AppState';
import type { StorageRepository } from '../storage';
import type {
  DayGoalOverride,
  FoodEntry,
  Goals,
  LibraryFood,
  MealSuggestions,
  SavedMeal,
  WeekDeficitDay,
} from '../types';

/** Lets a test pin the calendar day the provider believes it is. */
const clock = vi.hoisted(() => ({ today: null as string | null }));

vi.mock('../lib/date', async () => {
  const actual = await vi.importActual<typeof import('../lib/date')>('../lib/date');
  return { ...actual, todayKey: () => clock.today ?? actual.todayKey() };
});

const BEANS: LibraryFood = {
  id: 'beans',
  name: 'Beans',
  servingLabel: 'can',
  servingSize: { amount: 400, unit: 'g' },
  calories: 320,
  carbs: 40,
  protein: 20,
  fat: 2,
  source: 'manual',
};

const LETTUCE: LibraryFood = {
  id: 'lettuce',
  name: 'Lettuce',
  servingLabel: 'cup',
  calories: 5,
  carbs: 1,
  protein: 0,
  fat: 0,
  source: 'manual',
};

const TACO_SALAD: SavedMeal = {
  id: 'meal-1',
  name: 'Taco salad',
  items: [
    { foodId: 'beans', amount: 0.5, unit: 'can' },
    { foodId: 'lettuce', amount: 1, unit: 'cup' },
  ],
};

class FakeRepository implements StorageRepository {
  addEntryCalls: FoodEntry[] = [];
  addFoodCalls: LibraryFood[] = [];
  /** One date per getEntriesByDate call, in order, so reloads are observable */
  entryLoadDates: string[] = [];
  constructor(
    private foods: LibraryFood[] = [],
    private meals: SavedMeal[] = [],
  ) {}

  async getEntriesByDate(date: string): Promise<FoodEntry[]> {
    this.entryLoadDates.push(date);
    return [];
  }
  async addEntry(entry: FoodEntry): Promise<void> {
    this.addEntryCalls.push(entry);
  }
  async updateEntry(): Promise<void> {}
  async deleteEntry(): Promise<void> {}
  async getDefaultGoals(): Promise<Goals | null> {
    return null;
  }
  async saveDefaultGoals(): Promise<void> {}
  async getGoalsForDate(): Promise<DayGoalOverride | null> {
    return null;
  }
  async saveGoalsForDate(): Promise<void> {}
  async clearGoalsForDate(): Promise<void> {}
  async getFoods(): Promise<LibraryFood[]> {
    return this.foods;
  }
  async addFood(food: LibraryFood): Promise<void> {
    this.addFoodCalls.push(food);
  }
  async updateFood(): Promise<void> {}
  async archiveFood(): Promise<void> {}
  async uploadFoodImage(foodId: string): Promise<string> {
    return `uid/${foodId}.jpg`;
  }
  async removeFoodImage(): Promise<void> {}
  async getFoodImageUrl(path: string): Promise<string> {
    return `signed:${path}`;
  }
  async getMeals(): Promise<SavedMeal[]> {
    return this.meals;
  }
  async addMeal(): Promise<void> {}
  async updateMeal(): Promise<void> {}
  async archiveMeal(): Promise<void> {}
  async getMealSuggestions(): Promise<MealSuggestions> {
    return { recent: [], mostUsed: [] };
  }
  async getFoodLastUsed(): Promise<Record<string, string>> {
    return {};
  }
  async getWeekDeficitSummary(): Promise<WeekDeficitDay[]> {
    return [];
  }
  async getWeeklyDeficitGoal(): Promise<number | null> {
    return null;
  }
  async saveWeeklyDeficitGoal(): Promise<void> {}
}

async function renderState(foods: LibraryFood[], meals: SavedMeal[]) {
  const repository = new FakeRepository(foods, meals);
  const { result } = renderHook(() => useAppState(), {
    wrapper: ({ children }) => <AppProvider repository={repository}>{children}</AppProvider>,
  });
  // The provider loads foods and meals asynchronously; logMeal resolves against
  // that loaded state, so wait for it before invoking.
  await waitFor(() => {
    expect(result.current.foods).toHaveLength(foods.length);
    expect(result.current.meals).toHaveLength(meals.length);
  });
  return { repository, result };
}

describe('logMeal', () => {
  it('fans a meal out into one entry per component, scaled by its portion', async () => {
    const { repository, result } = await renderState([BEANS, LETTUCE], [TACO_SALAD]);

    let logged = 0;
    await act(async () => {
      logged = await result.current.logMeal('meal-1', 'dinner', '2026-07-09');
    });

    expect(logged).toBe(2);
    expect(repository.addEntryCalls).toHaveLength(2);
    const beans = repository.addEntryCalls.find((e) => e.foodId === 'beans')!;
    expect(beans).toMatchObject({
      date: '2026-07-09',
      meal: 'dinner',
      name: 'Beans',
      amount: 0.5,
      unit: 'can',
      quantity: 0.5,
      calories: 320,
      source: 'manual',
    });
    // Per-serving nutrition is stored, scaled at read time by quantity
    const lettuce = repository.addEntryCalls.find((e) => e.foodId === 'lettuce')!;
    expect(lettuce).toMatchObject({ quantity: 1, calories: 5, unit: 'cup' });
  });

  it('skips a component whose food no longer resolves', async () => {
    // Lettuce is missing from the library, so only beans can be logged
    const { repository, result } = await renderState([BEANS], [TACO_SALAD]);

    let logged = 0;
    await act(async () => {
      logged = await result.current.logMeal('meal-1', 'lunch', '2026-07-09');
    });

    expect(logged).toBe(1);
    expect(repository.addEntryCalls).toHaveLength(1);
    expect(repository.addEntryCalls[0].foodId).toBe('beans');
  });

  it('logs nothing when every component is unavailable', async () => {
    const { repository, result } = await renderState([], [TACO_SALAD]);

    let logged = 0;
    await act(async () => {
      logged = await result.current.logMeal('meal-1', 'lunch', '2026-07-09');
    });

    expect(logged).toBe(0);
    expect(repository.addEntryCalls).toHaveLength(0);
  });

  it('logs nothing for an unknown meal id', async () => {
    const { repository, result } = await renderState([BEANS], [TACO_SALAD]);

    let logged = 0;
    await act(async () => {
      logged = await result.current.logMeal('nope', 'lunch', '2026-07-09');
    });

    expect(logged).toBe(0);
    expect(repository.addEntryCalls).toHaveLength(0);
  });
});

describe('addEntry skip-macro-check capture seed', () => {
  const newBeerInput = {
    date: '2026-07-09',
    meal: 'dinner' as const,
    name: 'Modelo',
    amount: 1,
    unit: 'serving',
    servingLabel: 'serving',
    quantity: 1,
    calories: 110,
    carbs: 6,
    protein: 1,
    fat: 0,
    source: 'manual' as const,
    skipMacroCheck: true,
  };

  it('flags a brand-new captured food and keeps the flag off the entry', async () => {
    const { repository, result } = await renderState([], []);

    await act(async () => {
      await result.current.addEntry(newBeerInput);
    });

    expect(repository.addFoodCalls).toHaveLength(1);
    expect(repository.addFoodCalls[0]).toMatchObject({ name: 'Modelo', skipMacroCheck: true });
    // The seed never rides along on the entry row.
    expect(repository.addEntryCalls[0]).not.toHaveProperty('skipMacroCheck');
  });

  it('does not capture or modify a food when the name already exists', async () => {
    const existingBeer: LibraryFood = {
      id: 'food-beer',
      name: 'Modelo',
      servingLabel: 'serving',
      calories: 110,
      carbs: 6,
      protein: 1,
      fat: 0,
      source: 'manual',
    };
    const { repository, result } = await renderState([existingBeer], []);

    await act(async () => {
      await result.current.addEntry(newBeerInput);
    });

    // Existing foods are never touched from the log form — the seed only ever
    // flags a food captured on this save (the linked-food case is handled by
    // the entry form via updateFood).
    expect(repository.addFoodCalls).toHaveLength(0);
    expect(repository.addEntryCalls[0]).toMatchObject({ foodId: 'food-beer' });
    expect(repository.addEntryCalls[0]).not.toHaveProperty('skipMacroCheck');
  });
});

describe('refresh on return from the background', () => {
  /** Matches the default staleness window in useRefreshOnReturn. */
  const STALE_MS = 2 * 60 * 1000;
  const realNow = Date.now.bind(Date);
  let clockOffset = 0;

  beforeEach(() => {
    clockOffset = 0;
    clock.today = '2026-08-05';
    // Offset rather than pin, so testing-library's own timeouts still advance
    vi.spyOn(Date, 'now').mockImplementation(() => realNow() + clockOffset);
  });

  afterEach(() => {
    clock.today = null;
    vi.restoreAllMocks();
  });

  async function renderWith(repository: FakeRepository) {
    const { result } = renderHook(() => useAppState(), {
      wrapper: ({ children }) => <AppProvider repository={repository}>{children}</AppProvider>,
    });
    await waitFor(() => expect(result.current.entriesLoading).toBe(false));
    return result;
  }

  /** Advances the clock, then simulates the user coming back to the tab. */
  async function returnAfter(ms: number) {
    clockOffset += ms;
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
  }

  it('reloads the log after time away', async () => {
    const repository = new FakeRepository();
    const result = await renderWith(repository);
    expect(repository.entryLoadDates).toEqual(['2026-08-05']);

    await returnAfter(STALE_MS + 1);

    expect(repository.entryLoadDates).toEqual(['2026-08-05', '2026-08-05']);
    expect(result.current.date).toBe('2026-08-05');
  });

  it('leaves the log alone on a quick glance away and back', async () => {
    const repository = new FakeRepository();
    await renderWith(repository);

    // Well inside the window, with room for the real time the render itself
    // takes — the fake clock here runs alongside the real one, not instead of it
    await returnAfter(STALE_MS / 2);

    expect(repository.entryLoadDates).toEqual(['2026-08-05']);
  });

  it('swaps fresh data in without blanking the log behind a skeleton', async () => {
    class SlowRepository extends FakeRepository {
      release: (() => void) | null = null;
      async getEntriesByDate(date: string): Promise<FoodEntry[]> {
        this.entryLoadDates.push(date);
        // Only the reload hangs, so the first render still settles normally
        if (this.entryLoadDates.length > 1) {
          await new Promise<void>((resolve) => {
            this.release = resolve;
          });
        }
        return [];
      }
    }
    const repository = new SlowRepository();
    const result = await renderWith(repository);

    await returnAfter(STALE_MS + 1);

    // The reload is still in flight, yet the log is still showing what it had
    expect(repository.release).not.toBeNull();
    expect(result.current.entriesLoading).toBe(false);
    await act(async () => {
      repository.release!();
    });
  });

  it('moves a tab left open past midnight onto the new day', async () => {
    const repository = new FakeRepository();
    const result = await renderWith(repository);

    clock.today = '2026-08-06';
    await returnAfter(STALE_MS + 1);

    await waitFor(() => expect(result.current.date).toBe('2026-08-06'));
    expect(repository.entryLoadDates).toContain('2026-08-06');
  });

  it('keeps a deliberately chosen past date when the day rolls over', async () => {
    const repository = new FakeRepository();
    const result = await renderWith(repository);

    act(() => result.current.setDate('2026-07-30'));
    await waitFor(() => expect(result.current.date).toBe('2026-07-30'));

    clock.today = '2026-08-06';
    await returnAfter(STALE_MS + 1);

    expect(result.current.date).toBe('2026-07-30');
  });

  it('retries a load that had failed before the user left', async () => {
    class FailingRepository extends FakeRepository {
      async getEntriesByDate(date: string): Promise<FoodEntry[]> {
        this.entryLoadDates.push(date);
        throw new Error('offline');
      }
    }
    const repository = new FailingRepository();
    const result = await renderWith(repository);
    expect(result.current.loadFailed).toBe(true);

    await returnAfter(STALE_MS + 1);

    expect(repository.entryLoadDates).toHaveLength(2);
  });
});
