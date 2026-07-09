import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  updateFoodCalls: unknown[] = [];
  addFoodCalls: unknown[] = [];

  async getEntriesByDate(): Promise<FoodEntry[]> {
    return [];
  }
  async addEntry(entry: unknown): Promise<void> {
    this.addEntryCalls.push(entry);
  }
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

async function renderForm(props: { editing?: FoodEntry; onClose?: () => void } = {}) {
  const repository = new FakeRepository();
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
