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
  constructor(
    private foods: LibraryFood[] = [],
    private meals: SavedMeal[] = [],
  ) {}

  async getEntriesByDate(): Promise<FoodEntry[]> {
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
