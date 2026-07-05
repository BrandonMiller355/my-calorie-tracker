import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import type { StorageRepository } from './storage';
import type { FoodEntry, FoodSearchResult, Goals } from './types';

type RouterEntry = string | { pathname: string; state: unknown };

/** In-memory StorageRepository with toggleable failures, for tests only. */
class FakeRepository implements StorageRepository {
  private entries = new Map<string, FoodEntry>();
  private goals: Goals | null = null;
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
  async getGoals(): Promise<Goals | null> {
    this.assertReads();
    return this.goals ? { ...this.goals } : null;
  }
  async saveGoals(goals: Goals): Promise<void> {
    this.assertWrites();
    this.goals = { ...goals };
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
  it('empty day shows zero totals', async () => {
    renderApp(new FakeRepository());
    await screen.findByRole('region', { name: 'Breakfast' });
    expect(screen.getByText('2000 kcal left')).toBeInTheDocument();
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
    fireEvent.change(within(form).getByLabelText(/Calories/), { target: { value: '450' } });
    fireEvent.click(within(form).getByText('Save changes'));

    expect(await screen.findByText('1550 kcal left')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Dinner' })).getByText('450 kcal')).toBeInTheDocument();
  });

  it('deletes an entry and totals update immediately', async () => {
    renderApp(new FakeRepository());
    await addFood('Snacks', { name: 'Chips', calories: '150', carbs: '15', protein: '2', fat: '9' });

    fireEvent.click(screen.getByLabelText('Delete Chips'));
    await waitFor(() => expect(screen.queryByText('Chips')).toBeNull());
    expect(screen.getByText('2000 kcal left')).toBeInTheDocument();
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

  it('search prefill with missing macros flags fields and requires confirmation', async () => {
    const prefill: FoodSearchResult = {
      id: 'off-1',
      name: 'Mystery Snack',
      servingDesc: '100 g',
      calories: 200,
      // carbs, protein, fat unknown
    };
    renderApp(new FakeRepository(), [{ pathname: '/', state: { prefill } }]);

    const form = await screen.findByRole('form', { name: 'Add food entry' });
    expect(within(form).getByRole('alert')).toHaveTextContent(/missing/i);
    expect(within(form).getByLabelText(/Calories/)).toHaveValue('200');
    expect(within(form).getByLabelText(/Carbs/)).toHaveValue('');

    // Saving with blanks is rejected
    fireEvent.click(within(form).getByText('Add to log'));
    expect(await within(form).findAllByText(/Enter a number of 0 or more/)).toHaveLength(3);

    // Filling them in allows the save
    fireEvent.change(within(form).getByLabelText(/Carbs/), { target: { value: '20' } });
    fireEvent.change(within(form).getByLabelText(/Protein/), { target: { value: '3' } });
    fireEvent.change(within(form).getByLabelText(/Fat \(g\)/), { target: { value: '12' } });
    fireEvent.click(within(form).getByText('Add to log'));

    expect(await screen.findByText('Mystery Snack')).toBeInTheDocument();
    expect(screen.getByText('1800 kcal left')).toBeInTheDocument();
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
