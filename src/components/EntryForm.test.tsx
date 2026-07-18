import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EntryForm } from './EntryForm';
import { AppProvider } from '../state/AppState';
import { AuthProvider } from '../state/AuthProvider';
import type { StorageRepository } from '../storage';
import type {
  FoodEntry,
  Goals,
  LibraryFood,
  MealSuggestions,
  WeekDeficitDay,
} from '../types';
import type { IdentifiedAmount } from '../api/identifyFood';

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}));

// What the identify stub delivers when its buttons are clicked; set per test.
const stubIdentify = vi.hoisted(() => ({
  food: null as unknown as LibraryFood,
  amount: undefined as IdentifiedAmount | undefined,
}));

vi.mock('./IdentifyOverlay', () => ({
  IdentifyOverlay: ({
    onMatch,
    onEstimateFallback,
    onCancel,
  }: {
    onMatch: (food: LibraryFood, amount?: IdentifiedAmount) => void;
    onEstimateFallback: (image: string, note: string) => void;
    onCancel: () => void;
  }) => (
    <div data-testid="identify-overlay">
      <button onClick={() => onMatch(stubIdentify.food, stubIdentify.amount)}>stub-match</button>
      <button onClick={() => onEstimateFallback('data:image/jpeg;base64,handoff', 'my note')}>
        stub-fallback
      </button>
      <button onClick={onCancel}>stub-identify-cancel</button>
    </div>
  ),
}));

// What the text-log stub delivers when its buttons are clicked; set per test.
const stubTextLog = vi.hoisted(() => ({
  item: null as unknown,
}));

vi.mock('./TextLogOverlay', () => ({
  TextLogOverlay: ({
    onSingleItem,
    onLogged,
    onCancel,
  }: {
    onSingleItem: (item: unknown) => void;
    onLogged: () => void;
    onCancel: () => void;
  }) => (
    <div data-testid="text-log-overlay">
      <button onClick={() => onSingleItem(stubTextLog.item)}>stub-single-item</button>
      <button onClick={onLogged}>stub-logged</button>
      <button onClick={onCancel}>stub-text-cancel</button>
    </div>
  ),
}));

vi.mock('./BulkPhotoOverlay', () => ({
  BulkPhotoOverlay: ({
    meal,
    onLogged,
    onCancel,
  }: {
    meal: string;
    onLogged: () => void;
    onCancel: () => void;
  }) => (
    <div data-testid="bulk-photo-overlay" data-meal={meal}>
      <button onClick={onLogged}>stub-bulk-logged</button>
      <button onClick={onCancel}>stub-bulk-cancel</button>
    </div>
  ),
}));

vi.mock('./AiAnalyzeOverlay', () => ({
  AiAnalyzeOverlay: ({
    initialImage,
    initialNote,
    onAccept,
  }: {
    initialImage?: string;
    initialNote?: string;
    onAccept: (result: {
      id: string;
      name: string;
      servingLabel: string;
      calories: number;
      fat: number;
      carbs: number;
      protein: number;
    }) => void;
  }) => (
    <div data-testid="analyze-overlay" data-image={initialImage} data-note={initialNote}>
      <button
        onClick={() =>
          onAccept({
            id: 'estimate-1',
            name: 'Mystery bowl',
            servingLabel: 'serving',
            calories: 400,
            fat: 10,
            carbs: 50,
            protein: 20,
          })
        }
      >
        stub-accept-estimate
      </button>
    </div>
  ),
}));

const CHICKEN: LibraryFood = {
  id: 'food-chicken',
  name: 'Chicken breast',
  servingLabel: 'serving',
  servingSize: { amount: 100, unit: 'g' },
  calories: 165,
  carbs: 0,
  protein: 31,
  fat: 4,
  source: 'manual',
};

const COOKIE: LibraryFood = {
  id: 'food-cookie',
  name: 'Protein cookie',
  servingLabel: 'cookie',
  calories: 220,
  carbs: 24,
  protein: 15,
  fat: 8,
  source: 'manual',
};

const ENTRY: FoodEntry = {
  id: 'entry-1',
  date: '2026-07-09',
  meal: 'lunch',
  name: 'PB&J',
  amount: 1,
  unit: 'serving',
  servingLabel: 'serving',
  quantity: 1,
  calories: 300,
  carbs: 30,
  protein: 12,
  fat: 14,
  source: 'manual',
};

class FakeRepository implements StorageRepository {
  addEntryCalls: unknown[] = [];
  updateEntryCalls: unknown[] = [];
  updateFoodCalls: unknown[] = [];
  addFoodCalls: unknown[] = [];

  async getEntriesByDate(): Promise<FoodEntry[]> {
    return [];
  }
  async addEntry(entry: unknown): Promise<void> {
    this.addEntryCalls.push(entry);
  }
  async updateEntry(entry: unknown): Promise<void> {
    this.updateEntryCalls.push(entry);
  }
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
    return [CHICKEN, COOKIE];
  }
  async addFood(food: unknown): Promise<void> {
    this.addFoodCalls.push(food);
  }
  async updateFood(food: unknown): Promise<void> {
    this.updateFoodCalls.push(food);
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

async function renderForm(
  props: { editing?: FoodEntry; onClose?: () => void; repository?: FakeRepository } = {},
) {
  const repository = props.repository ?? new FakeRepository();
  render(
    <MemoryRouter>
      <AuthProvider>
        <AppProvider repository={repository}>
          <EntryForm date="2026-07-09" onClose={props.onClose ?? (() => {})} editing={props.editing} />
        </AppProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
  // Flush the provider's initial async loads (foods, suggestions)
  await act(async () => {});
  return repository;
}

function openIdentify() {
  fireEvent.click(screen.getByLabelText('Identify food from a photo'));
}

describe('EntryForm identify action', () => {
  beforeEach(() => {
    stubIdentify.food = CHICKEN;
    stubIdentify.amount = undefined;
  });

  it('shows the identify action when adding and hides it when editing', async () => {
    await renderForm();
    expect(screen.getByLabelText('Identify food from a photo')).toBeInTheDocument();
  });

  it('hides the identify action when editing', async () => {
    await renderForm({ editing: ENTRY });
    expect(screen.queryByLabelText('Identify food from a photo')).not.toBeInTheDocument();
  });

  it('fills the form from a match with a scale weight in grams', async () => {
    stubIdentify.amount = { grams: 142, source: 'scale' };
    await renderForm();

    openIdentify();
    fireEvent.click(screen.getByText('stub-match'));

    expect(screen.getByLabelText('Name')).toHaveValue('Chicken breast');
    expect(screen.getByLabelText('Amount')).toHaveValue('142');
    expect(screen.getByLabelText('Unit')).toHaveValue('g');
    // 1.42 servings of 165 kcal
    expect(screen.getByTestId('entry-preview')).toHaveTextContent('234.3 kcal');
    // A scale read is trusted, not caveated
    expect(screen.queryByText(/Weight estimated by AI/)).not.toBeInTheDocument();
    expect(screen.queryByTestId('identify-overlay')).not.toBeInTheDocument();
  });

  it('ignores the weight when the matched food has no weight equivalence', async () => {
    stubIdentify.food = COOKIE;
    stubIdentify.amount = { grams: 60, source: 'scale' };
    await renderForm();

    openIdentify();
    fireEvent.click(screen.getByText('stub-match'));

    expect(screen.getByLabelText('Name')).toHaveValue('Protein cookie');
    expect(screen.getByLabelText('Amount')).toHaveValue('1');
    expect(screen.getByLabelText('Unit')).toHaveValue('cookie');
  });

  it('labels an estimated weight and clears the label once the amount is edited', async () => {
    stubIdentify.amount = { grams: 130, source: 'estimate' };
    await renderForm();

    openIdentify();
    fireEvent.click(screen.getByText('stub-match'));

    expect(screen.getByLabelText('Amount')).toHaveValue('130');
    expect(screen.getByText(/Weight estimated by AI/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '150' } });
    expect(screen.queryByText(/Weight estimated by AI/)).not.toBeInTheDocument();
  });

  it('hands off to the estimate flow and applies the accepted estimate in place', async () => {
    await renderForm();

    openIdentify();
    fireEvent.click(screen.getByText('stub-fallback'));

    const analyze = screen.getByTestId('analyze-overlay');
    expect(analyze).toHaveAttribute('data-image', 'data:image/jpeg;base64,handoff');
    expect(analyze).toHaveAttribute('data-note', 'my note');
    expect(screen.queryByTestId('identify-overlay')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('stub-accept-estimate'));

    expect(screen.queryByTestId('analyze-overlay')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Mystery bowl');
    expect(screen.getByLabelText('Amount')).toHaveValue('1');
    expect(screen.getByLabelText('Unit')).toHaveValue('serving');
    // A new food's nutrition inputs are visible, seeded from the estimate
    expect(screen.getByLabelText(/Calories/)).toHaveValue('400');
  });

  it('cancelling the identify overlay leaves the form untouched', async () => {
    await renderForm();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'half-typed' } });

    openIdentify();
    fireEvent.click(screen.getByText('stub-identify-cancel'));

    expect(screen.queryByTestId('identify-overlay')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('half-typed');
  });

  it('saving after an amount tweak stores the entry without touching the library food', async () => {
    stubIdentify.amount = { grams: 142, source: 'scale' };
    const onClose = vi.fn();
    const repository = await renderForm({ onClose });

    openIdentify();
    fireEvent.click(screen.getByText('stub-match'));
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '100' } });
    fireEvent.click(screen.getByText('Add to log'));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(repository.addEntryCalls).toHaveLength(1);
    expect(repository.addEntryCalls[0]).toMatchObject({
      name: 'Chicken breast',
      amount: 100,
      unit: 'g',
      quantity: 1,
      calories: 165,
      foodId: CHICKEN.id,
      source: 'manual',
    });
    expect(repository.updateFoodCalls).toHaveLength(0);
    expect(repository.addFoodCalls).toHaveLength(0);
  });
});

function openTextLog() {
  fireEvent.click(screen.getByLabelText('Log foods from a text description'));
}

describe('EntryForm bulk-photos action', () => {
  it('shows the bulk-photos action when adding', async () => {
    await renderForm();
    expect(screen.getByLabelText('Log foods from several photos')).toBeInTheDocument();
  });

  it('hides the bulk-photos action when editing', async () => {
    await renderForm({ editing: ENTRY });
    expect(screen.queryByLabelText('Log foods from several photos')).not.toBeInTheDocument();
  });

  it('opens the overlay with the selected meal and closes the dialog when all are logged', async () => {
    const onClose = vi.fn();
    await renderForm({ onClose });

    fireEvent.click(screen.getByRole('radio', { name: 'Dinner' }));
    await act(async () => {});
    fireEvent.click(screen.getByLabelText('Log foods from several photos'));

    expect(screen.getByTestId('bulk-photo-overlay')).toHaveAttribute('data-meal', 'dinner');
    fireEvent.click(screen.getByText('stub-bulk-logged'));
    expect(onClose).toHaveBeenCalled();
  });

  it('cancelling the overlay returns to the untouched form', async () => {
    const onClose = vi.fn();
    const repository = await renderForm({ onClose });

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'half-typed' } });
    fireEvent.click(screen.getByLabelText('Log foods from several photos'));
    fireEvent.click(screen.getByText('stub-bulk-cancel'));

    expect(screen.queryByTestId('bulk-photo-overlay')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('half-typed');
    expect(onClose).not.toHaveBeenCalled();
    expect(repository.addEntryCalls).toHaveLength(0);
  });
});

describe('EntryForm text-log action', () => {
  it('shows the text-log action when adding', async () => {
    await renderForm();
    expect(screen.getByLabelText('Log foods from a text description')).toBeInTheDocument();
  });

  it('hides the text-log action when editing', async () => {
    await renderForm({ editing: ENTRY });
    expect(screen.queryByLabelText('Log foods from a text description')).not.toBeInTheDocument();
  });

  it('fills the form from a single match with its amount, unit, and meal', async () => {
    stubTextLog.item = {
      key: 'k1',
      name: 'Chicken breast',
      anchor: { servingLabel: 'serving', servingSize: { amount: 100, unit: 'g' } },
      calories: 165,
      fat: 4,
      carbs: 0,
      protein: 31,
      amount: 150,
      unit: 'g',
      meal: 'dinner',
      foodId: CHICKEN.id,
      source: 'manual',
    };
    await renderForm();

    openTextLog();
    fireEvent.click(screen.getByText('stub-single-item'));
    // Flush the meal change's async suggestions reload
    await act(async () => {});

    expect(screen.queryByTestId('text-log-overlay')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Chicken breast');
    expect(screen.getByLabelText('Amount')).toHaveValue('150');
    expect(screen.getByLabelText('Unit')).toHaveValue('g');
    expect(screen.getByRole('radio', { name: 'Dinner' })).toBeChecked();
    // 1.5 servings of 165 kcal
    expect(screen.getByTestId('entry-preview')).toHaveTextContent('247.5 kcal');
  });

  it('fills the form from a single estimate as a new one-serving food', async () => {
    stubTextLog.item = {
      key: 'k2',
      name: 'Peanut butter toast',
      anchor: { servingLabel: 'serving' },
      calories: 250,
      fat: 12,
      carbs: 28,
      protein: 9,
      amount: 1,
      unit: 'serving',
      meal: 'breakfast',
      source: 'search',
      confidenceNote: 'assumed 1 tbsp of peanut butter',
    };
    await renderForm();

    openTextLog();
    fireEvent.click(screen.getByText('stub-single-item'));
    // Flush the meal change's async suggestions reload
    await act(async () => {});

    expect(screen.getByLabelText('Name')).toHaveValue('Peanut butter toast');
    expect(screen.getByLabelText('Amount')).toHaveValue('1');
    expect(screen.getByLabelText('Unit')).toHaveValue('serving');
    expect(screen.getByRole('radio', { name: 'Breakfast' })).toBeChecked();
    // A new food's nutrition inputs are visible, seeded from the estimate
    expect(screen.getByLabelText(/Calories/)).toHaveValue('250');
  });

  it('closes the whole dialog after a bulk log', async () => {
    const onClose = vi.fn();
    await renderForm({ onClose });

    openTextLog();
    fireEvent.click(screen.getByText('stub-logged'));

    expect(onClose).toHaveBeenCalled();
  });

  it('cancelling the text-log overlay leaves the form untouched', async () => {
    await renderForm();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'half-typed' } });

    openTextLog();
    fireEvent.click(screen.getByText('stub-text-cancel'));

    expect(screen.queryByTestId('text-log-overlay')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('half-typed');
  });
});

const QUICK_ENTRY: FoodEntry = {
  id: 'entry-quick-1',
  date: '2026-07-09',
  meal: 'snacks',
  name: 'Calories',
  amount: 1,
  unit: 'serving',
  servingLabel: 'serving',
  quantity: 1,
  calories: 450,
  carbs: 0,
  protein: 0,
  fat: 0,
  source: 'quick',
  description: 'wedding buffet',
};

function enterQuickMode() {
  fireEvent.focus(screen.getByLabelText('Name'));
  fireEvent.click(screen.getByText('Log calories only'));
}

describe('EntryForm quick calories mode', () => {
  it('offers the quick action last, with the name field empty and while typing', async () => {
    await renderForm();

    fireEvent.focus(screen.getByLabelText('Name'));
    let options = within(screen.getByRole('listbox')).getAllByRole('option');
    expect(options[options.length - 1]).toHaveTextContent('Log calories only');

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'chick' } });
    options = within(screen.getByRole('listbox')).getAllByRole('option');
    expect(options.map((o) => o.textContent)).toContain('Search online for “chick”');
    expect(options[options.length - 1]).toHaveTextContent('Log calories only');
  });

  it('does not offer the quick action when editing a normal entry', async () => {
    await renderForm({ editing: ENTRY });
    fireEvent.focus(screen.getByLabelText('Name'));
    expect(screen.queryByText('Log calories only')).not.toBeInTheDocument();
  });

  it('switches to the quick form: fixed name, no amount/serving, nutrition and description inputs', async () => {
    await renderForm();
    enterQuickMode();

    expect(screen.getByRole('heading', { name: 'Log calories' })).toBeInTheDocument();
    expect(screen.getByText('Calories')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Amount')).not.toBeInTheDocument();
    expect(screen.queryByText('Serving name')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Calories \(kcal\)/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Protein \(g\)/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Description \(optional\)/)).toBeInTheDocument();
  });

  it('saves a quick entry with fixed fields, entered macros, and the description on the entry', async () => {
    const onClose = vi.fn();
    const repository = await renderForm({ onClose });
    enterQuickMode();

    fireEvent.change(screen.getByLabelText(/Calories \(kcal\)/), { target: { value: '400' } });
    fireEvent.change(screen.getByLabelText(/Carbs \(g\)/), { target: { value: '40' } });
    fireEvent.change(screen.getByLabelText(/Protein \(g\)/), { target: { value: '30' } });
    fireEvent.change(screen.getByLabelText(/Fat \(g\)/), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText(/Description \(optional\)/), {
      target: { value: 'wedding buffet' },
    });
    fireEvent.click(screen.getByText('Add to log'));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(repository.addEntryCalls).toHaveLength(1);
    expect(repository.addEntryCalls[0]).toMatchObject({
      name: 'Calories',
      amount: 1,
      unit: 'serving',
      servingLabel: 'serving',
      quantity: 1,
      calories: 400,
      carbs: 40,
      protein: 30,
      fat: 10,
      source: 'quick',
      description: 'wedding buffet',
      foodId: undefined,
    });
    expect(repository.addFoodCalls).toHaveLength(0);
  });

  it('saves blank macros as 0 and no description as undefined', async () => {
    const onClose = vi.fn();
    const repository = await renderForm({ onClose });
    enterQuickMode();

    fireEvent.change(screen.getByLabelText(/Calories \(kcal\)/), { target: { value: '450' } });
    fireEvent.click(screen.getByText('Add to log'));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(repository.addEntryCalls[0]).toMatchObject({
      calories: 450,
      carbs: 0,
      protein: 0,
      fat: 0,
      description: undefined,
    });
  });

  it('never captures or links a library food, even when one named "Calories" exists', async () => {
    const repository = new FakeRepository();
    repository.getFoods = async () => [
      ...(await new FakeRepository().getFoods()),
      { ...CHICKEN, id: 'food-calories', name: 'Calories', calories: 100 },
    ];
    const onClose = vi.fn();
    await renderForm({ onClose, repository });
    enterQuickMode();

    fireEvent.change(screen.getByLabelText(/Calories \(kcal\)/), { target: { value: '300' } });
    fireEvent.click(screen.getByText('Add to log'));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(repository.addEntryCalls[0]).toMatchObject({ foodId: undefined, source: 'quick' });
    expect(repository.addFoodCalls).toHaveLength(0);
    expect(repository.updateFoodCalls).toHaveLength(0);
  });

  it('rejects an empty or invalid calorie value and invalid macros', async () => {
    const repository = await renderForm();
    enterQuickMode();

    fireEvent.click(screen.getByText('Add to log'));
    expect(screen.getByText('Enter a number of 0 or more')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Calories \(kcal\)/), { target: { value: '300' } });
    fireEvent.change(screen.getByLabelText(/Protein \(g\)/), { target: { value: '-5' } });
    fireEvent.click(screen.getByText('Add to log'));
    expect(screen.getByText('Enter a number of 0 or more')).toBeInTheDocument();

    expect(repository.addEntryCalls).toHaveLength(0);
  });

  it('editing a quick entry reopens the quick form prefilled and saves entry-only', async () => {
    const onClose = vi.fn();
    const repository = await renderForm({ editing: QUICK_ENTRY, onClose });

    expect(screen.getByRole('heading', { name: 'Edit calories' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Amount')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Calories \(kcal\)/)).toHaveValue('450');
    expect(screen.getByLabelText(/Description \(optional\)/)).toHaveValue('wedding buffet');

    fireEvent.change(screen.getByLabelText(/Calories \(kcal\)/), { target: { value: '500' } });
    fireEvent.change(screen.getByLabelText(/Description \(optional\)/), {
      target: { value: 'buffet, second plate' },
    });
    fireEvent.click(screen.getByText('Save changes'));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(repository.updateEntryCalls).toHaveLength(1);
    expect(repository.updateEntryCalls[0]).toMatchObject({
      id: QUICK_ENTRY.id,
      name: 'Calories',
      calories: 500,
      source: 'quick',
      description: 'buffet, second plate',
      foodId: undefined,
    });
    expect(repository.addFoodCalls).toHaveLength(0);
    expect(repository.updateFoodCalls).toHaveLength(0);
  });
});
