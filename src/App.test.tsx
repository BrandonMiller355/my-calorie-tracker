import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { searchFoods } from './api/openFoodFacts';
import { addDays } from './lib/date';
import type { StorageRepository } from './storage';
import {
  DEFAULT_GOALS,
  type FoodEntry,
  type FoodSearchResult,
  type Goals,
  type LibraryFood,
  type Meal,
  type MealSuggestions,
  type WeekDeficitDay,
} from './types';

vi.mock('./api/openFoodFacts', () => ({ searchFoods: vi.fn(async () => []) }));

type RouterEntry = string | { pathname: string; state: unknown };

/** In-memory StorageRepository with toggleable failures, for tests only. */
class FakeRepository implements StorageRepository {
  private entries = new Map<string, FoodEntry>();
  private defaultGoals: Goals | null = null;
  private dayGoals = new Map<string, Goals>();
  private foods = new Map<string, LibraryFood>();
  private weeklyDeficitGoal: number | null = null;
  failReads = false;
  failWrites = false;

  private assertReads() {
    if (this.failReads) throw new Error('backend unreachable');
  }
  private assertWrites() {
    if (this.failWrites) throw new Error('backend unreachable');
  }

  async getEntriesByDate(date: string): Promise<FoodEntry[]> {
    this.assertReads();
    return [...this.entries.values()].filter((e) => e.date === date);
  }
  async addEntry(entry: FoodEntry): Promise<void> {
    this.assertWrites();
    this.entries.set(entry.id, { ...entry });
  }
  async updateEntry(entry: FoodEntry): Promise<void> {
    this.assertWrites();
    this.entries.set(entry.id, { ...entry });
  }
  async deleteEntry(id: string): Promise<void> {
    this.assertWrites();
    this.entries.delete(id);
  }
  async getDefaultGoals(): Promise<Goals | null> {
    this.assertReads();
    return this.defaultGoals ? { ...this.defaultGoals } : null;
  }
  async saveDefaultGoals(goals: Goals): Promise<void> {
    this.assertWrites();
    this.defaultGoals = { ...goals };
  }
  async getGoalsForDate(date: string): Promise<Goals | null> {
    this.assertReads();
    const goals = this.dayGoals.get(date);
    return goals ? { ...goals } : null;
  }
  async saveGoalsForDate(date: string, goals: Goals): Promise<void> {
    this.assertWrites();
    this.dayGoals.set(date, { ...goals });
  }
  async clearGoalsForDate(date: string): Promise<void> {
    this.assertWrites();
    this.dayGoals.delete(date);
  }
  async getFoods(): Promise<LibraryFood[]> {
    this.assertReads();
    return [...this.foods.values()].filter((f) => !f.archivedAt).map((f) => ({ ...f }));
  }
  async addFood(food: LibraryFood): Promise<void> {
    this.assertWrites();
    const normalized = food.name.trim().toLowerCase();
    for (const existing of this.foods.values()) {
      // Mirrors the unique index on (user_id, lower(trim(name)))
      if (existing.name.trim().toLowerCase() === normalized) throw new Error('duplicate name');
    }
    this.foods.set(food.id, { ...food });
  }
  async updateFood(food: LibraryFood): Promise<void> {
    this.assertWrites();
    this.foods.set(food.id, { ...food });
  }
  async archiveFood(id: string): Promise<void> {
    this.assertWrites();
    const food = this.foods.get(id);
    if (food) this.foods.set(id, { ...food, archivedAt: new Date().toISOString() });
  }
  // Mirrors the meal_suggestions() SQL: per-meal grouping, 3 recent then
  // 3 most used, deduped, archived foods excluded.
  async getMealSuggestions(meal: Meal): Promise<MealSuggestions> {
    this.assertReads();
    const byFood = new Map<string, { lastDate: string; count: number }>();
    for (const e of this.entries.values()) {
      if (e.meal !== meal || !e.foodId) continue;
      const food = this.foods.get(e.foodId);
      if (!food || food.archivedAt) continue;
      const agg = byFood.get(e.foodId) ?? { lastDate: '', count: 0 };
      agg.count += 1;
      if (e.date > agg.lastDate) agg.lastDate = e.date;
      byFood.set(e.foodId, agg);
    }
    const stats = [...byFood.entries()];
    const recent = stats
      .sort((a, b) => b[1].lastDate.localeCompare(a[1].lastDate))
      .slice(0, 3)
      .map(([id]) => id);
    const mostUsed = stats
      .filter(([id]) => !recent.includes(id))
      .sort((a, b) => b[1].count - a[1].count || b[1].lastDate.localeCompare(a[1].lastDate))
      .slice(0, 3)
      .map(([id]) => id);
    const toFood = (id: string) => ({ ...this.foods.get(id)! });
    return { recent: recent.map(toFood), mostUsed: mostUsed.map(toFood) };
  }
  async getWeekDeficitSummary(from: string, through: string): Promise<WeekDeficitDay[]> {
    this.assertReads();
    const days: WeekDeficitDay[] = [];
    for (let d = from; d <= through; d = addDays(d, 1)) {
      const dayEntries = [...this.entries.values()].filter((e) => e.date === d);
      days.push({
        date: d,
        consumedCalories: dayEntries.reduce((sum, e) => sum + e.calories * e.quantity, 0),
        effectiveGoalCalories:
          this.dayGoals.get(d)?.calories ?? this.defaultGoals?.calories ?? DEFAULT_GOALS.calories,
        hasEntries: dayEntries.length > 0,
      });
    }
    return days;
  }
  async getWeeklyDeficitGoal(): Promise<number | null> {
    this.assertReads();
    return this.weeklyDeficitGoal;
  }
  async saveWeeklyDeficitGoal(goal: number): Promise<void> {
    this.assertWrites();
    this.weeklyDeficitGoal = goal;
  }
}

function renderApp(repo: StorageRepository, initialEntries: RouterEntry[] = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <App repository={repo} />
    </MemoryRouter>,
  );
}

async function addFood(
  meal: string,
  food: { name: string; calories: string; carbs: string; protein: string; fat: string },
) {
  const section = await screen.findByRole('region', { name: meal });
  fireEvent.click(within(section).getByText('+ Add food'));

  const form = screen.getByRole('form', { name: 'Add food entry' });
  fireEvent.change(within(form).getByLabelText('Name'), { target: { value: food.name } });
  fireEvent.change(within(form).getByLabelText(/Calories/), { target: { value: food.calories } });
  fireEvent.change(within(form).getByLabelText(/Carbs/), { target: { value: food.carbs } });
  fireEvent.change(within(form).getByLabelText(/Protein/), { target: { value: food.protein } });
  fireEvent.change(within(form).getByLabelText(/Fat \(g\)/), { target: { value: food.fat } });
  fireEvent.click(within(form).getByText('Add to log'));

  await waitFor(() =>
    expect(screen.queryByRole('form', { name: 'Add food entry' })).toBeNull(),
  );
}

describe('App (spec scenario walkthrough)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('empty day shows zero totals', async () => {
    renderApp(new FakeRepository());
    await screen.findByRole('region', { name: 'Breakfast' });
    expect(screen.getByText('2000 kcal left')).toBeInTheDocument();
  });

  it('lets a single day override the default goal, then reset back to it', async () => {
    renderApp(new FakeRepository());
    await screen.findByRole('region', { name: 'Breakfast' });

    fireEvent.click(screen.getByText('Set a custom goal for today'));
    fireEvent.change(screen.getByLabelText('Calorie burn (kcal)'), { target: { value: '1500' } });
    fireEvent.click(screen.getByText('Save for today'));

    expect(await screen.findByText('1500 kcal left')).toBeInTheDocument();
    expect(screen.getByText(/Using a custom goal for today/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Use default'));
    expect(await screen.findByText('2000 kcal left')).toBeInTheDocument();
  });

  it('adds an entry, groups it by meal, and updates totals', async () => {
    renderApp(new FakeRepository());
    await addFood('Breakfast', {
      name: 'Oatmeal',
      calories: '300',
      carbs: '54',
      protein: '10',
      fat: '5',
    });

    const breakfast = screen.getByRole('region', { name: 'Breakfast' });
    expect(within(breakfast).getByText('Oatmeal')).toBeInTheDocument();
    expect(within(breakfast).getByText('300 kcal')).toBeInTheDocument(); // meal subtotal
    expect(screen.getByText('1700 kcal left')).toBeInTheDocument();
  });

  it('warns when calories do not match the macros, and blocks save until confirmed', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderApp(new FakeRepository());
    const section = await screen.findByRole('region', { name: 'Lunch' });
    fireEvent.click(within(section).getByText('+ Add food'));

    const form = screen.getByRole('form', { name: 'Add food entry' });
    fireEvent.change(within(form).getByLabelText('Name'), { target: { value: 'Suspicious bar' } });
    // 5*4 + 1*4 + 1*9 = 33 kcal from macros, nowhere near 400
    fireEvent.change(within(form).getByLabelText(/Calories/), { target: { value: '400' } });
    fireEvent.change(within(form).getByLabelText(/Carbs/), { target: { value: '5' } });
    fireEvent.change(within(form).getByLabelText(/Protein/), { target: { value: '1' } });
    fireEvent.change(within(form).getByLabelText(/Fat \(g\)/), { target: { value: '1' } });
    fireEvent.click(within(form).getByText('Add to log'));

    // Declining the warning keeps the form open and saves nothing
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('33'));
    expect(screen.queryByText('Suspicious bar')).toBeNull();
    expect(screen.getByRole('form', { name: 'Add food entry' })).toBeInTheDocument();

    // Confirming the warning proceeds with the save
    confirmSpy.mockReturnValue(true);
    fireEvent.click(within(form).getByText('Add to log'));
    expect(await screen.findByText('Suspicious bar')).toBeInTheDocument();
  });

  it('rejects invalid nutrition values without saving', async () => {
    renderApp(new FakeRepository());
    const section = await screen.findByRole('region', { name: 'Lunch' });
    fireEvent.click(within(section).getByText('+ Add food'));

    const form = screen.getByRole('form', { name: 'Add food entry' });
    fireEvent.change(within(form).getByLabelText('Name'), { target: { value: 'Bad food' } });
    fireEvent.change(within(form).getByLabelText(/Calories/), { target: { value: '-5' } });
    fireEvent.change(within(form).getByLabelText(/Carbs/), { target: { value: 'abc' } });
    fireEvent.change(within(form).getByLabelText(/Protein/), { target: { value: '1' } });
    fireEvent.change(within(form).getByLabelText(/Fat \(g\)/), { target: { value: '1' } });
    fireEvent.click(within(form).getByText('Add to log'));

    expect(await within(form).findAllByText(/Enter a number of 0 or more/)).toHaveLength(2);
    expect(screen.queryByText('Bad food')).toBeNull(); // not saved
  });

  it('edits an entry and totals update immediately', async () => {
    renderApp(new FakeRepository());
    await addFood('Dinner', { name: 'Pasta', calories: '600', carbs: '80', protein: '20', fat: '15' });

    fireEvent.click(screen.getByText('Pasta'));
    const form = screen.getByRole('form', { name: 'Edit food entry' });
    // Nutrition inputs are collapsed on known entries until deliberately revealed
    expect(within(form).queryByLabelText(/Calories/)).toBeNull();
    fireEvent.click(within(form).getByText('Edit nutrition'));
    fireEvent.change(within(form).getByLabelText(/Calories/), { target: { value: '450' } });
    fireEvent.click(within(form).getByText('Save changes'));

    expect(await screen.findByText('1550 kcal left')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Dinner' })).getByText('450 kcal')).toBeInTheDocument();
  });

  it('deletes an entry and totals update immediately', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderApp(new FakeRepository());
    await addFood('Snacks', { name: 'Chips', calories: '150', carbs: '15', protein: '2', fat: '9' });

    fireEvent.click(screen.getByLabelText('Delete Chips'));
    await waitFor(() => expect(screen.queryByText('Chips')).toBeNull());
    expect(screen.getByText('2000 kcal left')).toBeInTheDocument();
  });

  it('keeps the entry when the delete confirmation is dismissed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderApp(new FakeRepository());
    await addFood('Snacks', { name: 'Chips', calories: '150', carbs: '15', protein: '2', fat: '9' });

    fireEvent.click(screen.getByLabelText('Delete Chips'));
    expect(screen.getByText('Chips')).toBeInTheDocument();
    expect(screen.getByText('1850 kcal left')).toBeInTheDocument();
  });

  it('data persists across an app restart with the same repository', async () => {
    const repo = new FakeRepository();
    const first = renderApp(repo);
    await addFood('Lunch', { name: 'Sandwich', calories: '400', carbs: '40', protein: '25', fat: '12' });
    first.unmount();

    renderApp(repo);
    expect(await screen.findByText('Sandwich')).toBeInTheDocument();
    expect(screen.getByText('1600 kcal left')).toBeInTheDocument();
  });

  it('search prefill with missing macros flags fields but allows saving as zero', async () => {
    const prefill: FoodSearchResult = {
      id: 'off-1',
      name: 'Mystery Snack',
      servingLabel: 'serving',
      servingSize: { amount: 100, unit: 'g' },
      calories: 200,
      // carbs, protein, fat unknown
    };
    renderApp(new FakeRepository(), [{ pathname: '/', state: { prefill } }]);

    const form = await screen.findByRole('form', { name: 'Add food entry' });
    expect(within(form).getByRole('alert')).toHaveTextContent(/missing/i);
    expect(within(form).getByLabelText(/Calories/)).toHaveValue('200');
    expect(within(form).getByLabelText(/Carbs/)).toHaveValue('');

    // Saving with the optional macros left blank succeeds, defaulting them to 0
    fireEvent.click(within(form).getByText('Add to log'));

    expect(await screen.findByText('Mystery Snack')).toBeInTheDocument();
    expect(screen.getByText('1800 kcal left')).toBeInTheDocument();
  });
});

describe('Food library (auto-capture, suggestions, combobox)', () => {
  it('auto-captures a logged food and suggests it for that meal only', async () => {
    renderApp(new FakeRepository());
    await addFood('Breakfast', {
      name: 'Greek yogurt',
      calories: '120',
      carbs: '8',
      protein: '15',
      fat: '4',
    });
    await addFood('Dinner', { name: 'Pasta', calories: '600', carbs: '80', protein: '20', fat: '15' });

    const breakfast = screen.getByRole('region', { name: 'Breakfast' });
    fireEvent.click(within(breakfast).getByText('+ Add food'));
    const form = screen.getByRole('form', { name: 'Add food entry' });
    fireEvent.focus(within(form).getByLabelText('Name'));

    expect(await screen.findByText('Recent · Breakfast')).toBeInTheDocument();
    const listbox = screen.getByRole('listbox');
    expect(within(listbox).getByRole('option', { name: /Greek yogurt/ })).toBeInTheDocument();
    expect(within(listbox).queryByText(/Pasta/)).toBeNull();
  });

  it('selecting a suggestion pre-fills nutrition from the library food', async () => {
    renderApp(new FakeRepository());
    await addFood('Breakfast', {
      name: 'Greek yogurt',
      calories: '120',
      carbs: '8',
      protein: '15',
      fat: '4',
    });

    const breakfast = screen.getByRole('region', { name: 'Breakfast' });
    fireEvent.click(within(breakfast).getByText('+ Add food'));
    const form = screen.getByRole('form', { name: 'Add food entry' });
    fireEvent.focus(within(form).getByLabelText('Name'));
    fireEvent.click(await screen.findByRole('option', { name: /Greek yogurt/ }));

    expect(within(form).getByLabelText('Name')).toHaveValue('Greek yogurt');
    // Nutrition collapses to the computed summary; revealing shows the values
    expect(within(form).getByTestId('entry-preview')).toHaveTextContent('120 kcal');
    fireEvent.click(within(form).getByText('Edit nutrition'));
    expect(within(form).getByLabelText(/Calories/)).toHaveValue('120');
    expect(within(form).getByLabelText(/Protein/)).toHaveValue('15');
  });

  it('typing matches saved foods by description, shown as a secondary line', async () => {
    renderApp(new FakeRepository());
    const lunch = await screen.findByRole('region', { name: 'Lunch' });

    // Log once with a description; it seeds the captured library food
    fireEvent.click(within(lunch).getByText('+ Add food'));
    let form = screen.getByRole('form', { name: 'Add food entry' });
    fireEvent.change(within(form).getByLabelText('Name'), { target: { value: 'PB&J' } });
    fireEvent.change(within(form).getByLabelText(/Description/), {
      target: { value: '16g pbfit, 2 sara lee slices' },
    });
    fireEvent.change(within(form).getByLabelText(/Calories/), { target: { value: '380' } });
    fireEvent.change(within(form).getByLabelText(/Carbs/), { target: { value: '45' } });
    fireEvent.change(within(form).getByLabelText(/Protein/), { target: { value: '14' } });
    fireEvent.change(within(form).getByLabelText(/Fat \(g\)/), { target: { value: '12' } });
    fireEvent.click(within(form).getByText('Add to log'));
    await waitFor(() => expect(screen.queryByRole('form', { name: 'Add food entry' })).toBeNull());

    // A search on description text finds it
    fireEvent.click(within(lunch).getByText('+ Add food'));
    form = screen.getByRole('form', { name: 'Add food entry' });
    fireEvent.change(within(form).getByLabelText('Name'), { target: { value: 'pbfit' } });

    const option = await screen.findByRole('option', { name: /PB&J/ });
    expect(option).toHaveTextContent('16g pbfit, 2 sara lee slices');
  });

  it('offers search-online and use-as-new actions for unmatched text', async () => {
    renderApp(new FakeRepository());
    const lunch = await screen.findByRole('region', { name: 'Lunch' });
    fireEvent.click(within(lunch).getByText('+ Add food'));
    const form = screen.getByRole('form', { name: 'Add food entry' });
    fireEvent.change(within(form).getByLabelText('Name'), { target: { value: 'zzz' } });

    expect(await screen.findByRole('option', { name: /Search online for “zzz”/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Use “zzz” as a new food/ })).toBeInTheDocument();

    // Use-as-new just dismisses the dropdown; free text stays the manual path
    fireEvent.click(screen.getByRole('option', { name: /Use “zzz” as a new food/ }));
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
    expect(within(form).getByLabelText('Name')).toHaveValue('zzz');
  });

  it('a macro tweak while logging does not overwrite the library food', async () => {
    renderApp(new FakeRepository());
    await addFood('Lunch', { name: 'Rice', calories: '200', carbs: '45', protein: '4', fat: '1' });

    // Re-log from the suggestion, tweaking calories for this occasion only
    const lunch = screen.getByRole('region', { name: 'Lunch' });
    fireEvent.click(within(lunch).getByText('+ Add food'));
    const form = screen.getByRole('form', { name: 'Add food entry' });
    fireEvent.focus(within(form).getByLabelText('Name'));
    fireEvent.click(await screen.findByRole('option', { name: /Rice/ }));
    fireEvent.click(within(form).getByText('Edit nutrition'));
    fireEvent.change(within(form).getByLabelText(/Calories/), { target: { value: '250' } });
    fireEvent.click(within(form).getByText('Add to log'));
    await waitFor(() => expect(screen.queryByRole('form', { name: 'Add food entry' })).toBeNull());

    // The library still has the canonical 200 kcal
    fireEvent.click(screen.getByRole('link', { name: 'Foods' }));
    expect(await screen.findByText(/200 kcal/)).toBeInTheDocument();
    expect(screen.queryByText(/250 kcal/)).toBeNull();
  });
});

describe('Search escalation round trip', () => {
  const granola: FoodSearchResult = {
    id: 'off-1',
    name: 'Granola',
    servingLabel: 'serving',
    servingSize: { amount: 100, unit: 'g' },
    calories: 450,
    carbs: 60,
    protein: 10,
    fat: 15,
  };

  it('search online from the form returns with the selected meal preserved', async () => {
    vi.mocked(searchFoods).mockResolvedValue([granola]);
    renderApp(new FakeRepository());
    const lunch = await screen.findByRole('region', { name: 'Lunch' });
    fireEvent.click(within(lunch).getByText('+ Add food'));
    let form = screen.getByRole('form', { name: 'Add food entry' });
    expect(within(form).getByLabelText('Meal')).toHaveValue('lunch');

    fireEvent.change(within(form).getByLabelText('Name'), { target: { value: 'granola' } });
    fireEvent.click(await screen.findByRole('option', { name: /Search online for “granola”/ }));

    // On the search screen with the query carried over; pick the result
    expect(await screen.findByPlaceholderText(/Open Food Facts/)).toHaveValue('granola');
    fireEvent.click(await screen.findByRole('button', { name: /Granola/ }));

    form = await screen.findByRole('form', { name: 'Add food entry' });
    expect(within(form).getByLabelText('Name')).toHaveValue('Granola');
    expect(within(form).getByLabelText('Meal')).toHaveValue('lunch');
  });

  it('standalone search still hands off with the default meal', async () => {
    vi.mocked(searchFoods).mockResolvedValue([granola]);
    renderApp(new FakeRepository(), ['/search']);

    fireEvent.change(await screen.findByPlaceholderText(/Open Food Facts/), {
      target: { value: 'granola' },
    });
    fireEvent.click(await screen.findByRole('button', { name: /Granola/ }));

    const form = await screen.findByRole('form', { name: 'Add food entry' });
    expect(within(form).getByLabelText('Name')).toHaveValue('Granola');
    expect(within(form).getByLabelText('Meal')).toHaveValue('snacks');
  });

  it('offers a retry after a failed search, which recovers without retyping', async () => {
    // The module mock accumulates calls from earlier tests in this describe
    vi.mocked(searchFoods).mockClear();
    vi.mocked(searchFoods).mockRejectedValueOnce(new Error('Food search failed (HTTP 503)'));
    vi.mocked(searchFoods).mockResolvedValueOnce([granola]);
    renderApp(new FakeRepository(), ['/search']);

    fireEvent.change(await screen.findByPlaceholderText(/Open Food Facts/), {
      target: { value: 'granola' },
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(/unavailable right now/);

    fireEvent.click(screen.getByText('Retry'));
    expect(await screen.findByRole('button', { name: /Granola/ })).toBeInTheDocument();
    expect(searchFoods).toHaveBeenCalledTimes(2);
  });
});

describe('Food library screen', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a food item directly, available without ever logging it', async () => {
    renderApp(new FakeRepository(), ['/foods']);
    fireEvent.click(await screen.findByText('+ Add food item'));

    const form = screen.getByRole('form', { name: 'Add library food' });
    fireEvent.change(within(form).getByLabelText('Name'), { target: { value: 'Protein shake' } });
    fireEvent.change(within(form).getByLabelText(/Calories/), { target: { value: '180' } });
    fireEvent.click(within(form).getByText('Add to library'));

    await waitFor(() => expect(screen.queryByRole('form', { name: 'Add library food' })).toBeNull());
    expect(screen.getByText('Protein shake')).toBeInTheDocument();
    expect(screen.getByText(/180 kcal/)).toBeInTheDocument();
  });

  it('rejects a duplicate name instead of creating a second food', async () => {
    renderApp(new FakeRepository(), ['/foods']);
    fireEvent.click(await screen.findByText('+ Add food item'));
    let form = screen.getByRole('form', { name: 'Add library food' });
    fireEvent.change(within(form).getByLabelText('Name'), { target: { value: 'Rice' } });
    fireEvent.change(within(form).getByLabelText(/Calories/), { target: { value: '200' } });
    fireEvent.click(within(form).getByText('Add to library'));
    await waitFor(() => expect(screen.queryByRole('form', { name: 'Add library food' })).toBeNull());

    fireEvent.click(screen.getByText('+ Add food item'));
    form = screen.getByRole('form', { name: 'Add library food' });
    fireEvent.change(within(form).getByLabelText('Name'), { target: { value: ' rice ' } });
    fireEvent.change(within(form).getByLabelText(/Calories/), { target: { value: '210' } });
    fireEvent.click(within(form).getByText('Add to library'));

    expect(
      await within(form).findByText(/already in your library/),
    ).toBeInTheDocument();
  });

  it('editing a library food does not rewrite past entries', async () => {
    renderApp(new FakeRepository());
    await addFood('Lunch', { name: 'Rice', calories: '200', carbs: '45', protein: '4', fat: '1' });
    expect(screen.getByText('1800 kcal left')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: 'Foods' }));
    fireEvent.click(await screen.findByText('Edit'));
    const form = screen.getByRole('form', { name: 'Edit library food' });
    fireEvent.change(within(form).getByLabelText(/Calories/), { target: { value: '210' } });
    fireEvent.click(within(form).getByText('Save changes'));
    expect(await screen.findByText(/210 kcal/)).toBeInTheDocument();

    // The logged entry keeps its snapshot
    fireEvent.click(screen.getByRole('link', { name: 'Log' }));
    expect(await screen.findByText('1800 kcal left')).toBeInTheDocument();
  });

  it('archiving hides the food from the library and suggestions but keeps entries', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderApp(new FakeRepository());
    await addFood('Snacks', { name: 'Chips', calories: '150', carbs: '15', protein: '2', fat: '9' });

    fireEvent.click(screen.getByRole('link', { name: 'Foods' }));
    fireEvent.click(await screen.findByLabelText('Archive Chips'));
    await waitFor(() => expect(screen.queryByLabelText('Archive Chips')).toBeNull());

    // Entry and totals untouched; no suggestion offered anymore
    fireEvent.click(screen.getByRole('link', { name: 'Log' }));
    expect(await screen.findByText('Chips')).toBeInTheDocument();
    expect(screen.getByText('1850 kcal left')).toBeInTheDocument();

    const snacks = screen.getByRole('region', { name: 'Snacks' });
    fireEvent.click(within(snacks).getByText('+ Add food'));
    const form = screen.getByRole('form', { name: 'Add food entry' });
    fireEvent.focus(within(form).getByLabelText('Name'));
    // suggestions resolve within a waitFor poll; the archived food never shows
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
    expect(screen.queryByRole('option', { name: /Chips/ })).toBeNull();
  });

  it('filters the list by name and description, with a no-match hint', async () => {
    const repo = new FakeRepository();
    const base = { servingLabel: 'serving', calories: 100, carbs: 10, protein: 5, fat: 2, source: 'manual' as const };
    await repo.addFood({ ...base, id: 'f1', name: 'Greek yogurt', description: 'Fage 5%' });
    await repo.addFood({ ...base, id: 'f2', name: 'Rice' });
    renderApp(repo, ['/foods']);

    // Everything shows before a query is typed
    expect(await screen.findByText('Greek yogurt')).toBeInTheDocument();
    expect(screen.getByText('Rice')).toBeInTheDocument();

    const filter = screen.getByLabelText('Filter your library');
    fireEvent.change(filter, { target: { value: 'fage' } }); // matches description
    expect(screen.getByText('Greek yogurt')).toBeInTheDocument();
    expect(screen.queryByText('Rice')).toBeNull();

    fireEvent.change(filter, { target: { value: 'tofu' } });
    expect(screen.getByText('No foods match “tofu”.')).toBeInTheDocument();

    fireEvent.change(filter, { target: { value: '' } });
    expect(screen.getByText('Rice')).toBeInTheDocument();
  });
});

describe('Structured serving units', () => {
  it('logs a per-100g search food by weight and scales totals', async () => {
    const prefill: FoodSearchResult = {
      id: 'off-2',
      name: 'Oats',
      servingLabel: 'serving',
      servingSize: { amount: 100, unit: 'g' },
      calories: 200,
      carbs: 30,
      protein: 8,
      fat: 4,
    };
    renderApp(new FakeRepository(), [{ pathname: '/', state: { prefill } }]);

    const form = await screen.findByRole('form', { name: 'Add food entry' });
    fireEvent.change(within(form).getByLabelText('Amount'), { target: { value: '45' } });
    fireEvent.change(within(form).getByLabelText('Unit'), { target: { value: 'g' } });

    // The live preview shows the scaled contribution before saving
    expect(within(form).getByTestId('entry-preview')).toHaveTextContent('90 kcal');
    expect(within(form).getByText(/per 1 serving \(= 100 g\)/)).toHaveTextContent('200 kcal');

    fireEvent.click(within(form).getByText('Add to log'));

    // 45 g of a 100 g serving at 200 kcal → 90 kcal consumed
    expect(await screen.findByText('Oats')).toBeInTheDocument();
    expect(screen.getByText('1910 kcal left')).toBeInTheDocument();
  });

  it('a count-only food offers only its label and multiplies by count', async () => {
    renderApp(new FakeRepository());
    const dinner = await screen.findByRole('region', { name: 'Dinner' });
    fireEvent.click(within(dinner).getByText('+ Add food'));

    const form = screen.getByRole('form', { name: 'Add food entry' });
    fireEvent.change(within(form).getByLabelText('Name'), { target: { value: 'Chili' } });
    fireEvent.change(within(form).getByLabelText('Serving name'), { target: { value: 'bowl' } });
    fireEvent.change(within(form).getByLabelText(/Calories/), { target: { value: '300' } });
    fireEvent.change(within(form).getByLabelText(/Carbs/), { target: { value: '30' } });
    fireEvent.change(within(form).getByLabelText(/Protein/), { target: { value: '20' } });
    fireEvent.change(within(form).getByLabelText(/Fat \(g\)/), { target: { value: '10' } });

    const unitSelect = within(form).getByLabelText('Unit');
    expect(within(unitSelect).getAllByRole('option').map((o) => o.textContent)).toEqual(['bowl']);

    fireEvent.change(within(form).getByLabelText('Amount'), { target: { value: '2' } });
    fireEvent.click(within(form).getByText('Add to log'));

    await waitFor(() => expect(screen.queryByRole('form', { name: 'Add food entry' })).toBeNull());
    expect(screen.getByText('1400 kcal left')).toBeInTheDocument();
  });

  it('rejects a measure unit name as the serving label', async () => {
    renderApp(new FakeRepository());
    const lunch = await screen.findByRole('region', { name: 'Lunch' });
    fireEvent.click(within(lunch).getByText('+ Add food'));

    const form = screen.getByRole('form', { name: 'Add food entry' });
    fireEvent.change(within(form).getByLabelText('Name'), { target: { value: 'Sugar' } });
    fireEvent.change(within(form).getByLabelText('Serving name'), { target: { value: 'g' } });
    fireEvent.change(within(form).getByLabelText(/Calories/), { target: { value: '16' } });
    fireEvent.click(within(form).getByText('Add to log'));

    expect(await within(form).findByText(/is a measurement unit/)).toBeInTheDocument();
    expect(screen.queryByText('Sugar')).toBeNull();
  });

  it('an inline serving definition round-trips into the library unit picker', async () => {
    renderApp(new FakeRepository());
    const lunch = await screen.findByRole('region', { name: 'Lunch' });

    // Define "1 can (drained) = 120 g" while logging a new food
    fireEvent.click(within(lunch).getByText('+ Add food'));
    let form = screen.getByRole('form', { name: 'Add food entry' });
    fireEvent.change(within(form).getByLabelText('Name'), { target: { value: 'Tuna' } });
    fireEvent.change(within(form).getByLabelText('Serving name'), {
      target: { value: 'can (drained)' },
    });
    fireEvent.change(within(form).getByLabelText(/Equals/), { target: { value: '120' } });
    fireEvent.change(within(form).getByLabelText('Serving unit'), { target: { value: 'g' } });
    fireEvent.change(within(form).getByLabelText(/Calories/), { target: { value: '100' } });
    fireEvent.change(within(form).getByLabelText(/Protein/), { target: { value: '22' } });
    fireEvent.click(within(form).getByText('Add to log'));
    await waitFor(() => expect(screen.queryByRole('form', { name: 'Add food entry' })).toBeNull());
    expect(screen.getByText('1900 kcal left')).toBeInTheDocument();

    // Re-log from the captured library food: label and weight units offered
    fireEvent.click(within(lunch).getByText('+ Add food'));
    form = screen.getByRole('form', { name: 'Add food entry' });
    fireEvent.focus(within(form).getByLabelText('Name'));
    fireEvent.click(await screen.findByRole('option', { name: /Tuna/ }));

    const unitSelect = within(form).getByLabelText('Unit');
    expect(within(unitSelect).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'can (drained)',
      'g',
      'oz',
      'lb',
      'kg',
    ]);

    // 60 g of a 120 g can at 100 kcal → 50 kcal
    fireEvent.change(within(form).getByLabelText('Amount'), { target: { value: '60' } });
    fireEvent.change(within(form).getByLabelText('Unit'), { target: { value: 'g' } });
    fireEvent.click(within(form).getByText('Add to log'));
    await waitFor(() => expect(screen.queryByRole('form', { name: 'Add food entry' })).toBeNull());
    expect(screen.getByText('1850 kcal left')).toBeInTheDocument();
  });

  it('editing an entry uses its own snapshot after the library anchor changes', async () => {
    renderApp(new FakeRepository());
    const lunch = await screen.findByRole('region', { name: 'Lunch' });

    // Log 45 g of a food defined as 1 serving = 100 g, 200 kcal
    fireEvent.click(within(lunch).getByText('+ Add food'));
    let form = screen.getByRole('form', { name: 'Add food entry' });
    fireEvent.change(within(form).getByLabelText('Name'), { target: { value: 'Oats' } });
    fireEvent.change(within(form).getByLabelText(/Equals/), { target: { value: '100' } });
    fireEvent.change(within(form).getByLabelText('Serving unit'), { target: { value: 'g' } });
    fireEvent.change(within(form).getByLabelText(/Calories/), { target: { value: '200' } });
    fireEvent.change(within(form).getByLabelText('Amount'), { target: { value: '45' } });
    fireEvent.change(within(form).getByLabelText('Unit'), { target: { value: 'g' } });
    fireEvent.click(within(form).getByText('Add to log'));
    await waitFor(() => expect(screen.queryByRole('form', { name: 'Add food entry' })).toBeNull());
    expect(screen.getByText('1910 kcal left')).toBeInTheDocument();

    // Remove the library food's equivalence entirely
    fireEvent.click(screen.getByRole('link', { name: 'Foods' }));
    fireEvent.click(await screen.findByText('Edit'));
    const foodForm = screen.getByRole('form', { name: 'Edit library food' });
    fireEvent.change(within(foodForm).getByLabelText(/Equals/), { target: { value: '' } });
    fireEvent.change(within(foodForm).getByLabelText('Serving unit'), { target: { value: '' } });
    fireEvent.click(within(foodForm).getByText('Save changes'));
    await waitFor(() =>
      expect(screen.queryByRole('form', { name: 'Edit library food' })).toBeNull(),
    );

    // The entry still edits in grams from its own snapshot
    fireEvent.click(screen.getByRole('link', { name: 'Log' }));
    fireEvent.click(await screen.findByText('Oats'));
    form = screen.getByRole('form', { name: 'Edit food entry' });
    expect(within(form).getByLabelText('Amount')).toHaveValue('45');
    expect(within(form).getByLabelText('Unit')).toHaveValue('g');

    fireEvent.change(within(form).getByLabelText('Amount'), { target: { value: '90' } });
    fireEvent.click(within(form).getByText('Save changes'));
    expect(await screen.findByText('1820 kcal left')).toBeInTheDocument();
  });
});

describe('App (backend failure handling)', () => {
  it('shows an error state with retry when loading fails, and recovers', async () => {
    const repo = new FakeRepository();
    repo.failReads = true;
    renderApp(repo);

    expect(await screen.findByText(/can’t be loaded/i)).toBeInTheDocument();

    repo.failReads = false;
    fireEvent.click(screen.getByText('Retry'));
    expect(await screen.findByRole('region', { name: 'Breakfast' })).toBeInTheDocument();
    expect(screen.queryByText(/can’t be loaded/i)).toBeNull();
  });

  it('surfaces a failed add and does not show the entry as saved', async () => {
    const repo = new FakeRepository();
    renderApp(repo);
    const section = await screen.findByRole('region', { name: 'Breakfast' });
    repo.failWrites = true;

    fireEvent.click(within(section).getByText('+ Add food'));
    const form = screen.getByRole('form', { name: 'Add food entry' });
    fireEvent.change(within(form).getByLabelText('Name'), { target: { value: 'Doomed toast' } });
    fireEvent.change(within(form).getByLabelText(/Calories/), { target: { value: '100' } });
    fireEvent.change(within(form).getByLabelText(/Carbs/), { target: { value: '10' } });
    fireEvent.change(within(form).getByLabelText(/Protein/), { target: { value: '3' } });
    fireEvent.change(within(form).getByLabelText(/Fat \(g\)/), { target: { value: '2' } });
    fireEvent.click(within(form).getByText('Add to log'));

    // Form stays open with an error; nothing lands in the log
    expect(await within(form).findByText(/was not stored/i)).toBeInTheDocument();
    expect(screen.getByText('2000 kcal left')).toBeInTheDocument();

    // Clearing the failure lets the same form submit succeed
    repo.failWrites = false;
    fireEvent.click(within(form).getByText('Add to log'));
    expect(await screen.findByText('Doomed toast')).toBeInTheDocument();
    expect(screen.getByText('1900 kcal left')).toBeInTheDocument();
  });

  it('surfaces a failed delete and keeps the entry in the log', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const repo = new FakeRepository();
    renderApp(repo);
    await addFood('Snacks', { name: 'Chips', calories: '150', carbs: '15', protein: '2', fat: '9' });
    repo.failWrites = true;

    fireEvent.click(screen.getByLabelText('Delete Chips'));
    expect(await screen.findByText(/was not removed/i)).toBeInTheDocument();
    expect(screen.getByText('Chips')).toBeInTheDocument();
    expect(screen.getByText('1850 kcal left')).toBeInTheDocument();
  });
});
