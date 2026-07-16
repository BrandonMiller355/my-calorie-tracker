import { fireEvent, render, screen, within } from '@testing-library/react';
import { FoodsScreen } from './FoodsScreen';
import { AppProvider } from '../state/AppState';
import type { StorageRepository } from '../storage';
import type { FoodEntry, Goals, LibraryFood, MealSuggestions, WeekDeficitDay } from '../types';

const PBJ: LibraryFood = {
  id: 'pbj',
  name: 'PB&J',
  description: '15g jelly, 16g pbfit',
  servingLabel: 'serving',
  calories: 300,
  carbs: 40,
  protein: 12,
  fat: 9,
  source: 'manual',
};

const OATMEAL: LibraryFood = {
  id: 'oatmeal',
  name: 'Oatmeal',
  servingLabel: 'serving',
  calories: 150,
  carbs: 27,
  protein: 5,
  fat: 3,
  source: 'manual',
};

class FakeRepository implements StorageRepository {
  added: LibraryFood[] = [];
  updated: LibraryFood[] = [];
  constructor(private foods: LibraryFood[] = []) {}

  async getEntriesByDate(): Promise<FoodEntry[]> {
    return [];
  }
  async addEntry(): Promise<void> {}
  async updateEntry(): Promise<void> {}
  async deleteEntry(): Promise<void> {}
  async getDefaultGoals(): Promise<Goals | null> {
    return null;
  }
  async saveDefaultGoals(): Promise<void> {}
  async getGoalsForDate(): Promise<Goals | null> {
    return null;
  }
  async saveGoalsForDate(): Promise<void> {}
  async clearGoalsForDate(): Promise<void> {}
  async getFoods(): Promise<LibraryFood[]> {
    return this.foods;
  }
  async addFood(food: LibraryFood): Promise<void> {
    this.added.push(food);
  }
  async updateFood(food: LibraryFood): Promise<void> {
    this.updated.push(food);
  }
  async archiveFood(): Promise<void> {}
  async getMealSuggestions(): Promise<MealSuggestions> {
    return { recent: [], mostUsed: [] };
  }
  async getWeekDeficitSummary(): Promise<WeekDeficitDay[]> {
    return [];
  }
  async getWeeklyDeficitGoal(): Promise<number | null> {
    return null;
  }
  async saveWeeklyDeficitGoal(): Promise<void> {}
}

function renderFoods(foods: LibraryFood[]) {
  const repository = new FakeRepository(foods);
  render(
    <AppProvider repository={repository}>
      <FoodsScreen />
    </AppProvider>,
  );
  return repository;
}

/** Opens the edit form for a food already rendered in the library list. */
async function openEditForm(name: string) {
  const row = (await screen.findByText(name)).closest('.food-row') as HTMLElement;
  fireEvent.click(within(row).getByText('Edit'));
  return screen.getByRole('form', { name: 'Edit library food' });
}

function setName(value: string) {
  fireEvent.change(screen.getByLabelText('Name'), { target: { value } });
}

const saveAsNew = () => screen.queryByText('Save as new food');

describe('FoodsScreen save as new food', () => {
  it('forks a saved food into a new one and leaves the original alone', async () => {
    const repository = renderFoods([PBJ]);
    await openEditForm('PB&J');

    setName('PB&J (crunchy)');
    fireEvent.change(screen.getByLabelText('Calories (kcal)'), { target: { value: '420' } });
    fireEvent.click(saveAsNew()!);

    await screen.findByText('PB&J (crunchy)');
    expect(repository.added).toHaveLength(1);
    expect(repository.added[0]).toMatchObject({ name: 'PB&J (crunchy)', calories: 420 });
    expect(repository.updated).toHaveLength(0);
    expect(screen.getByText('PB&J')).toBeInTheDocument();
  });

  it('carries the untouched fields of the original onto the fork', async () => {
    const repository = renderFoods([PBJ]);
    await openEditForm('PB&J');

    setName('PB&J (crunchy)');
    fireEvent.click(saveAsNew()!);

    await screen.findByText('PB&J (crunchy)');
    expect(repository.added[0]).toMatchObject({
      description: '15g jelly, 16g pbfit',
      calories: 300,
      carbs: 40,
      protein: 12,
      fat: 9,
    });
  });

  it('does not offer the fork until the name diverges', async () => {
    renderFoods([PBJ]);
    await openEditForm('PB&J');

    expect(saveAsNew()).not.toBeInTheDocument();
    expect(screen.getByText('Save changes')).toBeInTheDocument();
  });

  it('does not treat a case- or whitespace-only edit as a diverged name', async () => {
    renderFoods([PBJ]);
    await openEditForm('PB&J');

    setName('pb&j');
    expect(saveAsNew()).not.toBeInTheDocument();

    setName('  PB&J  ');
    expect(saveAsNew()).not.toBeInTheDocument();
  });

  it('offers the fork once the name diverges, then withdraws it when restored', async () => {
    renderFoods([PBJ]);
    await openEditForm('PB&J');

    setName('PB&J (crunchy)');
    expect(saveAsNew()).toBeInTheDocument();

    setName('PB&J');
    expect(saveAsNew()).not.toBeInTheDocument();
  });

  it('never offers the fork when adding a brand-new food', async () => {
    renderFoods([PBJ]);
    fireEvent.click(await screen.findByText('+ Add food item'));

    setName('Toast');
    expect(saveAsNew()).not.toBeInTheDocument();
    expect(screen.getByText('Add to library')).toBeInTheDocument();
  });

  it('still renames in place when the user picks Save changes', async () => {
    const repository = renderFoods([OATMEAL]);
    await openEditForm('Oatmeal');

    setName('Oatmeal, steel cut');
    fireEvent.click(screen.getByText('Save changes'));

    await screen.findByText('Oatmeal, steel cut');
    expect(repository.updated).toHaveLength(1);
    expect(repository.updated[0]).toMatchObject({ id: 'oatmeal', name: 'Oatmeal, steel cut' });
    expect(repository.added).toHaveLength(0);
    expect(screen.queryByText('Oatmeal')).not.toBeInTheDocument();
  });

  it('rejects a fork onto another library food’s name', async () => {
    const repository = renderFoods([PBJ, OATMEAL]);
    await openEditForm('PB&J');

    setName('oatmeal');
    fireEvent.click(saveAsNew()!);

    expect(
      await screen.findByText('A food with this name is already in your library'),
    ).toBeInTheDocument();
    expect(repository.added).toHaveLength(0);
    expect(repository.updated).toHaveLength(0);
  });
});
