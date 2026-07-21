import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TextLogOverlay } from './TextLogOverlay';
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
import type { TextLogItem } from '../api/logFromText';

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}));

// Only the network call is stubbed; buildRequestFoods and resolveTextLogItems
// stay real so review rows reflect the actual resolution rules.
const logFromTextMock = vi.hoisted(() => vi.fn());
vi.mock('../api/logFromText', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/logFromText')>();
  return { ...actual, logFromText: logFromTextMock };
});

const BREAD: LibraryFood = {
  id: 'food-bread',
  name: 'Sara Lee bread',
  description: 'whole wheat',
  servingLabel: 'slice',
  calories: 70,
  carbs: 13,
  protein: 3,
  fat: 1,
  source: 'manual',
};

const RICE: LibraryFood = {
  id: 'food-rice',
  name: 'Jasmine rice',
  servingLabel: 'serving',
  servingSize: { amount: 100, unit: 'g' },
  calories: 130,
  carbs: 28,
  protein: 3,
  fat: 0,
  source: 'manual',
};

const MATCH_BREAD: TextLogItem = { kind: 'match', foodId: 'food-bread', servings: 2 };
const MATCH_RICE: TextLogItem = { kind: 'match', foodId: 'food-rice', grams: 150 };
const ESTIMATE_PB: TextLogItem = {
  kind: 'estimate',
  name: 'Peanut butter',
  calories: 90,
  fat: 7,
  carbs: 4,
  protein: 4,
  confidenceNote: 'assumed 1 tbsp',
};

class FakeRepository implements StorageRepository {
  addEntryCalls: FoodEntry[] = [];
  addFoodCalls: LibraryFood[] = [];
  /** Entry names whose save should fail once, then succeed. */
  failOnceFor = new Set<string>();

  async getEntriesByDate(): Promise<FoodEntry[]> {
    return [];
  }
  async addEntry(entry: FoodEntry): Promise<void> {
    if (this.failOnceFor.delete(entry.name)) throw new Error('save failed');
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
    return [BREAD, RICE];
  }
  async addFood(food: LibraryFood): Promise<void> {
    this.addFoodCalls.push(food);
  }
  async updateFood(): Promise<void> {}
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

interface Callbacks {
  onSingleItem: ReturnType<typeof vi.fn>;
  onLogged: ReturnType<typeof vi.fn>;
  onCancel: ReturnType<typeof vi.fn>;
}

async function renderOverlay(): Promise<{ repository: FakeRepository } & Callbacks> {
  const repository = new FakeRepository();
  const callbacks: Callbacks = {
    onSingleItem: vi.fn(),
    onLogged: vi.fn(),
    onCancel: vi.fn(),
  };
  render(
    <AuthProvider>
      <AppProvider repository={repository}>
        <TextLogOverlay
          foods={[BREAD, RICE]}
          date="2026-07-10"
          meal="lunch"
          onSingleItem={callbacks.onSingleItem}
          onLogged={callbacks.onLogged}
          onCancel={callbacks.onCancel}
        />
      </AppProvider>
    </AuthProvider>,
  );
  // Flush the provider's initial async loads
  await act(async () => {});
  return { repository, ...callbacks };
}

async function send(text: string) {
  fireEvent.change(screen.getByLabelText('What did you eat?'), { target: { value: text } });
  fireEvent.click(screen.getByText('Log it'));
  await act(async () => {});
}

beforeEach(() => {
  logFromTextMock.mockReset();
});

describe('TextLogOverlay input phase', () => {
  it('focuses the text input on open so the keyboard pops immediately', async () => {
    await renderOverlay();
    expect(screen.getByLabelText('What did you eat?')).toHaveFocus();
  });

  it('disables send while the input is blank', async () => {
    await renderOverlay();

    expect(screen.getByText('Log it')).toBeDisabled();
    fireEvent.change(screen.getByLabelText('What did you eat?'), { target: { value: '   ' } });
    expect(screen.getByText('Log it')).toBeDisabled();
    expect(logFromTextMock).not.toHaveBeenCalled();
  });

  it('sends the text, dialog meal, and library payload', async () => {
    logFromTextMock.mockResolvedValue([MATCH_BREAD, ESTIMATE_PB]);
    await renderOverlay();

    await send('2 slices of bread with pb');

    expect(logFromTextMock).toHaveBeenCalledWith(
      {
        text: '2 slices of bread with pb',
        meal: 'lunch',
        foods: [
          { id: 'food-bread', name: 'Sara Lee bread', description: 'whole wheat', servingLabel: 'slice' },
          { id: 'food-rice', name: 'Jasmine rice', servingLabel: 'serving', servingGrams: 100 },
        ],
      },
      expect.anything(),
    );
  });

  it('cancel logs nothing and calls onCancel', async () => {
    const { repository, onCancel } = await renderOverlay();

    fireEvent.click(screen.getByText('Cancel'));

    expect(onCancel).toHaveBeenCalled();
    expect(repository.addEntryCalls).toHaveLength(0);
    expect(logFromTextMock).not.toHaveBeenCalled();
  });

  it('shows a parse error and preserves the text for edit and resend', async () => {
    logFromTextMock.mockRejectedValueOnce(
      new Error("That description couldn't be understood — try rephrasing it."),
    );
    logFromTextMock.mockResolvedValueOnce([MATCH_BREAD, ESTIMATE_PB]);
    await renderOverlay();

    await send('gibberish');

    expect(screen.getByRole('alert')).toHaveTextContent("couldn't be understood");
    expect(screen.getByLabelText('What did you eat?')).toHaveValue('gibberish');

    fireEvent.click(screen.getByText('Log it'));
    await act(async () => {});
    expect(screen.getByText('Check these before logging')).toBeInTheDocument();
  });

  it('hands a single item to the parent instead of showing review', async () => {
    logFromTextMock.mockResolvedValue([{ kind: 'match', foodId: 'food-bread', servings: 2 }]);
    const { onSingleItem, repository } = await renderOverlay();

    await send('2 slices of sara lee bread');

    expect(onSingleItem).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Sara Lee bread',
        amount: 2,
        unit: 'slice',
        meal: 'lunch',
        foodId: 'food-bread',
      }),
    );
    expect(screen.queryByText('Check these before logging')).not.toBeInTheDocument();
    expect(repository.addEntryCalls).toHaveLength(0);
  });
});

describe('TextLogOverlay review phase', () => {
  it('lists every parsed item with resolved amounts, meals, and calories', async () => {
    logFromTextMock.mockResolvedValue([MATCH_BREAD, MATCH_RICE, ESTIMATE_PB]);
    const { repository } = await renderOverlay();

    await send('bread, rice, and peanut butter');

    expect(screen.getByText('Sara Lee bread')).toBeInTheDocument();
    expect(screen.getByText('whole wheat')).toBeInTheDocument();
    expect(screen.getByLabelText('Amount of Sara Lee bread')).toHaveValue('2');
    expect(screen.getByText('140 kcal')).toBeInTheDocument(); // 2 slices × 70

    expect(screen.getByLabelText('Amount of Jasmine rice')).toHaveValue('150');
    expect(screen.getByLabelText('Unit of Jasmine rice')).toHaveValue('g');
    expect(screen.getByText('195 kcal')).toBeInTheDocument(); // 150 g of 130/100 g

    expect(screen.getByText('AI estimate — assumed 1 tbsp')).toBeInTheDocument();
    expect(screen.getByText('90 kcal')).toBeInTheDocument();
    expect(screen.getByLabelText('Meal for Peanut butter')).toHaveValue('lunch');

    expect(screen.getByText('Add 3 entries')).toBeInTheDocument();
    expect(repository.addEntryCalls).toHaveLength(0);
  });

  it('updates an item’s calories live as its amount changes', async () => {
    logFromTextMock.mockResolvedValue([MATCH_BREAD, ESTIMATE_PB]);
    await renderOverlay();
    await send('bread and pb');

    fireEvent.change(screen.getByLabelText('Amount of Sara Lee bread'), {
      target: { value: '3' },
    });

    expect(screen.getByText('210 kcal')).toBeInTheDocument();
  });

  it('disables confirm while an amount is invalid', async () => {
    logFromTextMock.mockResolvedValue([MATCH_BREAD, ESTIMATE_PB]);
    await renderOverlay();
    await send('bread and pb');

    fireEvent.change(screen.getByLabelText('Amount of Sara Lee bread'), {
      target: { value: 'two' },
    });

    expect(screen.getByText('Enter a valid amount')).toBeInTheDocument();
    expect(screen.getByText('Add 2 entries')).toBeDisabled();
  });

  it('removing an item excludes it from logging', async () => {
    logFromTextMock.mockResolvedValue([MATCH_BREAD, MATCH_RICE, ESTIMATE_PB]);
    const { repository, onLogged } = await renderOverlay();
    await send('bread, rice, and peanut butter');

    fireEvent.click(screen.getByLabelText('Remove Jasmine rice'));
    expect(screen.queryByText('Jasmine rice')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Add 2 entries'));
    await waitFor(() => expect(onLogged).toHaveBeenCalled());

    expect(repository.addEntryCalls.map((e) => e.name)).toEqual([
      'Sara Lee bread',
      'Peanut butter',
    ]);
  });

  it('logs entries with the reviewed amounts, meals, links, and sources', async () => {
    logFromTextMock.mockResolvedValue([
      { ...MATCH_BREAD, meal: 'breakfast' },
      ESTIMATE_PB,
    ] as TextLogItem[]);
    const { repository, onLogged } = await renderOverlay();
    await send('bread for breakfast and pb');

    fireEvent.click(screen.getByText('Add 2 entries'));
    await waitFor(() => expect(onLogged).toHaveBeenCalled());

    const [bread, pb] = repository.addEntryCalls;
    expect(bread).toMatchObject({
      name: 'Sara Lee bread',
      amount: 2,
      unit: 'slice',
      quantity: 2,
      meal: 'breakfast',
      date: '2026-07-10',
      foodId: 'food-bread',
      source: 'manual',
      calories: 70,
    });
    expect(pb).toMatchObject({
      name: 'Peanut butter',
      amount: 1,
      unit: 'serving',
      quantity: 1,
      meal: 'lunch',
      source: 'search',
      calories: 90,
    });
    // The estimate was auto-captured to the library like any new-name entry
    expect(repository.addFoodCalls.map((f) => f.name)).toEqual(['Peanut butter']);
  });

  it('keeps failed and remaining items for retry after a partial failure', async () => {
    logFromTextMock.mockResolvedValue([MATCH_BREAD, MATCH_RICE, ESTIMATE_PB]);
    const { repository, onLogged } = await renderOverlay();
    await send('bread, rice, and peanut butter');
    repository.failOnceFor.add('Jasmine rice');

    fireEvent.click(screen.getByText('Add 3 entries'));
    await act(async () => {});

    // Bread landed; rice failed; peanut butter never attempted
    expect(repository.addEntryCalls.map((e) => e.name)).toEqual(['Sara Lee bread']);
    expect(onLogged).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Couldn’t save');
    expect(screen.queryByText('Sara Lee bread')).not.toBeInTheDocument();
    expect(screen.getByText('Jasmine rice')).toBeInTheDocument();
    expect(screen.getByText('Peanut butter')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Add 2 entries'));
    await waitFor(() => expect(onLogged).toHaveBeenCalled());
    expect(repository.addEntryCalls.map((e) => e.name)).toEqual([
      'Sara Lee bread',
      'Jasmine rice',
      'Peanut butter',
    ]);
  });

  it('refine returns to the input with the description preserved and reparses', async () => {
    logFromTextMock.mockResolvedValue([MATCH_BREAD, ESTIMATE_PB]);
    const { repository, onCancel } = await renderOverlay();
    await send('bred and pb');

    fireEvent.click(screen.getByText('Refine description'));

    // Back at the input, original text still there, nothing logged or cancelled
    const input = screen.getByLabelText('What did you eat?');
    expect(input).toHaveValue('bred and pb');
    expect(screen.queryByText('Check these before logging')).not.toBeInTheDocument();
    expect(onCancel).not.toHaveBeenCalled();
    expect(repository.addEntryCalls).toHaveLength(0);

    // Tweaking and resending reparses into a fresh review
    logFromTextMock.mockResolvedValue([MATCH_BREAD, MATCH_RICE]);
    fireEvent.change(input, { target: { value: 'bread and rice' } });
    fireEvent.click(screen.getByText('Log it'));
    await act(async () => {});

    expect(screen.getByText('Add 2 entries')).toBeInTheDocument();
    expect(screen.getByText('Jasmine rice')).toBeInTheDocument();
  });

  it('dismissing the review logs nothing', async () => {
    logFromTextMock.mockResolvedValue([MATCH_BREAD, ESTIMATE_PB]);
    const { repository, onCancel } = await renderOverlay();
    await send('bread and pb');

    fireEvent.click(screen.getByText('Cancel'));

    expect(onCancel).toHaveBeenCalled();
    expect(repository.addEntryCalls).toHaveLength(0);
  });
});
