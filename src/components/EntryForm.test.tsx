import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
  SavedMeal,
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
  image: 'data:image/jpeg;base64,identify',
}));

vi.mock('./IdentifyOverlay', () => ({
  IdentifyOverlay: ({
    onMatch,
    onEstimateFallback,
    onCancel,
  }: {
    onMatch: (food: LibraryFood, amount: IdentifiedAmount | undefined, image: string) => void;
    onEstimateFallback: (image: string, note: string) => void;
    onCancel: () => void;
  }) => (
    <div data-testid="identify-overlay">
      <button onClick={() => onMatch(stubIdentify.food, stubIdentify.amount, stubIdentify.image)}>
        stub-match
      </button>
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
    onAccept: (
      result: {
        id: string;
        name: string;
        servingLabel: string;
        calories: number;
        fat: number;
        carbs: number;
        protein: number;
      },
      image: string,
    ) => void;
  }) => (
    <div data-testid="analyze-overlay" data-image={initialImage} data-note={initialNote}>
      <button
        onClick={() =>
          onAccept(
            {
              id: 'estimate-1',
              name: 'Mystery bowl',
              servingLabel: 'serving',
              calories: 400,
              fat: 10,
              carbs: 50,
              protein: 20,
            },
            initialImage ?? 'data:image/jpeg;base64,analyzed',
          )
        }
      >
        stub-accept-estimate
      </button>
    </div>
  ),
}));

// The camera/file overlay is untestable in jsdom; the stub captures directly.
vi.mock('./PhotoCapture', () => ({
  PhotoCapture: ({ onCapture }: { onCapture: (img: string) => void; onCancel: () => void }) => (
    <button onClick={() => onCapture('data:image/jpeg;base64,entryphoto')}>stub-capture</button>
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
  imageUploads: { foodId: string; blob: Blob }[] = [];
  imageRemovals: string[] = [];
  library: LibraryFood[] = [CHICKEN, COOKIE];
  meals: SavedMeal[] = [];
  lastUsed: Record<string, string> = {};

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
    return this.library;
  }
  async addFood(food: unknown): Promise<void> {
    this.addFoodCalls.push(food);
  }
  async updateFood(food: unknown): Promise<void> {
    this.updateFoodCalls.push(food);
  }
  async archiveFood(): Promise<void> {}
  async uploadFoodImage(foodId: string, blob: Blob): Promise<string> {
    this.imageUploads.push({ foodId, blob });
    return `uid/${foodId}.jpg`;
  }
  async removeFoodImage(foodId: string): Promise<void> {
    this.imageRemovals.push(foodId);
    const food = this.library.find((f) => f.id === foodId);
    if (food) delete food.imagePath;
  }
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
    return this.lastUsed;
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
    // 1.42 servings of 165 kcal, rounded to whole calories
    expect(screen.getByTestId('entry-preview')).toHaveTextContent('234 kcal');
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

  it('auto-attaches the identify photo to a matched food that has no image', async () => {
    const repository = await renderForm();

    openIdentify();
    fireEvent.click(screen.getByText('stub-match'));

    await waitFor(() => expect(repository.imageUploads).toHaveLength(1));
    expect(repository.imageUploads[0].foodId).toBe(CHICKEN.id);
  });

  it('does not attach when the matched food already has an image', async () => {
    stubIdentify.food = { ...CHICKEN, imagePath: 'uid/chicken.jpg' };
    const repository = await renderForm();

    openIdentify();
    fireEvent.click(screen.getByText('stub-match'));
    // Give any (unwanted) fire-and-forget upload a chance to run.
    await act(async () => {});

    expect(repository.imageUploads).toHaveLength(0);
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
    // 1.5 servings of 165 kcal, rounded to whole calories
    expect(screen.getByTestId('entry-preview')).toHaveTextContent('248 kcal');
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

describe('EntryForm name search ordering', () => {
  it('puts the most recently logged match first among equal-quality matches', async () => {
    const repository = new FakeRepository();
    repository.library = [
      { ...CHICKEN, id: 'food-crumble', name: 'Apple crumble' },
      { ...CHICKEN, id: 'food-pie', name: 'Apple pie' },
    ];
    // Alphabetical order would put the crumble first; recency must win
    repository.lastUsed = { 'food-pie': '2026-07-08', 'food-crumble': '2026-07-01' };
    await renderForm({ repository });

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'apple' } });
    const options = within(screen.getByRole('listbox')).getAllByRole('option');
    expect(options[0]).toHaveTextContent('Apple pie');
    expect(options[1]).toHaveTextContent('Apple crumble');
  });

  it('closes the dropdown and drops focus after tapping a food, and does not reopen it', async () => {
    const repository = new FakeRepository();
    repository.library = [CHICKEN];
    await renderForm({ repository });

    // The typed text is a partial match, so the food isn't linked yet — this
    // is what flips the head from "defining a new food" to "matched to the
    // library" at the moment of picking. That used to remount the name field
    // mid-click and, since the fresh input auto-focused, reopen the dropdown
    // right behind the pick.
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'chick' } });
    const option = within(screen.getByRole('listbox'))
      .getAllByRole('option')
      .find((o) => o.textContent?.includes('Chicken breast'))!;
    fireEvent.mouseDown(option);
    fireEvent.click(option);

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(document.activeElement).not.toBe(screen.getByLabelText('Name'));
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

const TACO_SALAD: SavedMeal = {
  id: 'meal-taco',
  name: 'Taco salad',
  items: [
    { foodId: 'food-chicken', amount: 1, unit: 'serving' },
    { foodId: 'food-cookie', amount: 1, unit: 'cookie' },
  ],
};

/** Renders the form with the given library + saved meals seeded on the repo. */
async function renderWithMeals(library: LibraryFood[], meals: SavedMeal[], onClose = vi.fn()) {
  const repository = new FakeRepository();
  repository.library = library;
  repository.meals = meals;
  await renderForm({ repository, onClose });
  return repository;
}

describe('EntryForm meal logging', () => {
  it('matches a saved meal by name and marks it with a badge', async () => {
    await renderWithMeals([CHICKEN, COOKIE], [TACO_SALAD]);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'taco' } });
    const option = within(screen.getByRole('listbox'))
      .getAllByRole('option')
      .find((o) => o.textContent?.includes('Taco salad'))!;
    expect(option).toBeTruthy();
    expect(within(option).getByText('Meal')).toBeInTheDocument();
  });

  it('opens the confirm sheet without pre-filling the form when a meal is picked', async () => {
    await renderWithMeals([CHICKEN, COOKIE], [TACO_SALAD]);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'taco' } });
    fireEvent.click(screen.getByText('Taco salad'));

    expect(screen.getByRole('dialog', { name: 'Log Taco salad' })).toBeInTheDocument();
    // The entry form fields are untouched — no prefill from a meal
    expect(screen.getByLabelText('Name')).toHaveValue('taco');
  });

  it('fans the meal out into one entry per component in the chosen slot', async () => {
    const onClose = vi.fn();
    const repository = await renderWithMeals([CHICKEN, COOKIE], [TACO_SALAD], onClose);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'taco' } });
    fireEvent.click(screen.getByText('Taco salad'));

    const sheet = screen.getByRole('dialog', { name: 'Log Taco salad' });
    // Retarget the fan-out to lunch before confirming
    fireEvent.click(within(sheet).getByLabelText('Lunch'));
    fireEvent.click(within(sheet).getByText('Log all'));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(repository.addEntryCalls).toHaveLength(2);
    expect(repository.addEntryCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ foodId: 'food-chicken', meal: 'lunch', calories: 165, quantity: 1 }),
        expect.objectContaining({ foodId: 'food-cookie', meal: 'lunch', calories: 220, quantity: 1 }),
      ]),
    );
  });

  it('applies the chosen portion to every component it logs', async () => {
    const onClose = vi.fn();
    const repository = await renderWithMeals([CHICKEN, COOKIE], [TACO_SALAD], onClose);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'taco' } });
    fireEvent.click(screen.getByText('Taco salad'));

    const sheet = screen.getByRole('dialog', { name: 'Log Taco salad' });
    fireEvent.click(within(sheet).getByRole('button', { name: '½' }));
    // The preview follows the portion before anything is saved
    expect(within(sheet).getByText('Total: 193 kcal')).toBeInTheDocument();
    fireEvent.click(within(sheet).getByText('Log all'));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(repository.addEntryCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ foodId: 'food-chicken', amount: 0.5, quantity: 0.5 }),
        expect.objectContaining({ foodId: 'food-cookie', amount: 0.5, quantity: 0.5 }),
      ]),
    );
  });

  it('accepts a typed portion and blocks logging when it is not a positive number', async () => {
    const repository = await renderWithMeals([CHICKEN, COOKIE], [TACO_SALAD]);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'taco' } });
    fireEvent.click(screen.getByText('Taco salad'));

    const sheet = screen.getByRole('dialog', { name: 'Log Taco salad' });
    const portion = within(sheet).getByLabelText('Portion');
    fireEvent.change(portion, { target: { value: '0' } });
    expect(within(sheet).getByText('Enter a portion greater than 0')).toBeInTheDocument();
    expect(within(sheet).getByText('Log all')).toBeDisabled();

    fireEvent.change(portion, { target: { value: '1.5' } });
    fireEvent.click(within(sheet).getByText('Log all'));

    await waitFor(() => expect(repository.addEntryCalls).toHaveLength(2));
    expect(repository.addEntryCalls[0]).toMatchObject({ amount: 1.5, quantity: 1.5 });
  });

  it('skips an unavailable component and notes it on the sheet', async () => {
    // Only the chicken resolves; the cookie component is gone
    const repository = await renderWithMeals([CHICKEN], [TACO_SALAD]);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'taco' } });
    fireEvent.click(screen.getByText('Taco salad'));

    const sheet = screen.getByRole('dialog', { name: 'Log Taco salad' });
    expect(within(sheet).getByText('1 item unavailable and will be skipped')).toBeInTheDocument();
    fireEvent.click(within(sheet).getByText('Log all'));

    await waitFor(() => expect(repository.addEntryCalls).toHaveLength(1));
    expect(repository.addEntryCalls[0]).toMatchObject({ foodId: 'food-chicken' });
  });

  it('blocks logging when every component is unavailable', async () => {
    const repository = await renderWithMeals([], [TACO_SALAD]);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'taco' } });
    fireEvent.click(screen.getByText('Taco salad'));

    const sheet = screen.getByRole('dialog', { name: 'Log Taco salad' });
    expect(within(sheet).getByText(/nothing to log/i)).toBeInTheDocument();
    expect(within(sheet).getByText('Log all')).toBeDisabled();
    expect(repository.addEntryCalls).toHaveLength(0);
  });
});

// Beer: alcohol calories the tracked macros can't account for, so 6c + 1p + 0f
// ≈ 28 kcal never reconciles with its 110 kcal — a permanent mismatch.
const BEER: LibraryFood = {
  id: 'food-beer',
  name: 'Modelo',
  servingLabel: 'serving',
  calories: 110,
  carbs: 6,
  protein: 1,
  fat: 0,
  source: 'manual',
};

const BEER_ENTRY: FoodEntry = {
  id: 'entry-beer',
  date: '2026-07-09',
  meal: 'dinner',
  name: 'Modelo',
  amount: 1,
  unit: 'serving',
  servingLabel: 'serving',
  quantity: 1,
  calories: 110,
  carbs: 6,
  protein: 1,
  fat: 0,
  source: 'manual',
  foodId: 'food-beer',
};

describe('EntryForm macro/calorie mismatch warning', () => {
  afterEach(() => vi.restoreAllMocks());

  it('never warns for a linked food already flagged to skip the check', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const repository = new FakeRepository();
    repository.library = [{ ...BEER, skipMacroCheck: true }];
    const onClose = vi.fn();
    await renderForm({ editing: BEER_ENTRY, onClose, repository });

    fireEvent.click(screen.getByText('Save changes'));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(repository.updateEntryCalls).toHaveLength(1);
    // Already flagged, so no re-write of the food.
    expect(repository.updateFoodCalls).toHaveLength(0);
  });

  it('warns on an unflagged mismatch and backing out aborts the save', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const repository = new FakeRepository();
    repository.library = [BEER];
    const onClose = vi.fn();
    await renderForm({ editing: BEER_ENTRY, onClose, repository });

    fireEvent.click(screen.getByText('Save changes'));

    expect(confirmSpy).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
    expect(repository.updateEntryCalls).toHaveLength(0);
    expect(repository.updateFoodCalls).toHaveLength(0);
  });

  it('flags the linked food when the user saves the mismatch anyway', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const repository = new FakeRepository();
    repository.library = [BEER];
    const onClose = vi.fn();
    await renderForm({ editing: BEER_ENTRY, onClose, repository });

    fireEvent.click(screen.getByText('Save changes'));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(confirmSpy).toHaveBeenCalledOnce();
    expect(repository.updateEntryCalls).toHaveLength(1);
    expect(repository.updateFoodCalls).toHaveLength(1);
    expect(repository.updateFoodCalls[0]).toMatchObject({ id: 'food-beer', skipMacroCheck: true });
  });

  it('does not warn when calories match the macros within tolerance', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const repository = new FakeRepository();
    repository.library = [BEER];
    const onClose = vi.fn();
    // 6c + 1p + 0f ≈ 28 kcal; entering 30 sits inside the 50 kcal slack.
    await renderForm({ editing: { ...BEER_ENTRY, calories: 30 }, onClose, repository });

    fireEvent.click(screen.getByText('Save changes'));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(repository.updateFoodCalls).toHaveLength(0);
  });

  it('warns every time for a quick entry and never flags a food', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onClose = vi.fn();
    const repository = await renderForm({ onClose });
    enterQuickMode();

    fireEvent.change(screen.getByLabelText(/Calories \(kcal\)/), { target: { value: '400' } });
    fireEvent.change(screen.getByLabelText(/Carbs \(g\)/), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText(/Protein \(g\)/), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText(/Fat \(g\)/), { target: { value: '5' } });
    fireEvent.click(screen.getByText('Add to log'));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(confirmSpy).toHaveBeenCalledOnce();
    expect(repository.addEntryCalls[0]).toMatchObject({ source: 'quick', calories: 400 });
    expect(repository.addFoodCalls).toHaveLength(0);
    expect(repository.updateFoodCalls).toHaveLength(0);
  });
});

/** Fills the add form as a brand-new food whose macros already add up. */
function fillNewFood(name: string) {
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: name } });
  fireEvent.change(screen.getByLabelText(/Calories \(kcal\)/), { target: { value: '100' } });
  fireEvent.change(screen.getByLabelText(/Carbs \(g\)/), { target: { value: '25' } });
}

function attachPhoto() {
  fireEvent.click(screen.getByLabelText('Add photo'));
  fireEvent.click(screen.getByText('stub-capture'));
}

describe('EntryForm photo for a captured food', () => {
  it('attaches the chosen photo to the food captured from logging', async () => {
    const onClose = vi.fn();
    const repository = await renderForm({ onClose });

    fillNewFood('Cheesy mash');
    attachPhoto();
    // The held photo previews before there is anything to upload it to.
    expect(await screen.findByLabelText('View Cheesy mash photo')).toBeInTheDocument();
    expect(repository.imageUploads).toHaveLength(0);

    fireEvent.click(screen.getByText('Add to log'));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(repository.addFoodCalls).toHaveLength(1);
    const captured = repository.addFoodCalls[0] as LibraryFood;
    expect(captured.name).toBe('Cheesy mash');
    await waitFor(() => expect(repository.imageUploads).toHaveLength(1));
    expect(repository.imageUploads[0].foodId).toBe(captured.id);
  });

  it('offers no photo control in quick mode or for an entry with no library food', async () => {
    await renderForm();
    expect(screen.getByLabelText('Add photo')).toBeInTheDocument();

    enterQuickMode();
    expect(screen.queryByLabelText('Add photo')).not.toBeInTheDocument();

    cleanup();
    // PB&J is not in the library, so revealing its nutrition still has no
    // food to attach a photo to
    await renderForm({ editing: ENTRY });
    expect(screen.queryByLabelText('Add photo')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Edit nutrition'));
    expect(screen.queryByLabelText('Add photo')).not.toBeInTheDocument();
  });

  it('attaches a photo to a matched library food right away', async () => {
    const repository = await renderForm();

    // Typing a name the library knows opens that food's own fields, photo included
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Chicken breast' } });
    attachPhoto();

    // The food already exists, so the upload doesn't wait for the entry to save
    await waitFor(() => expect(repository.imageUploads).toHaveLength(1));
    expect(repository.imageUploads[0].foodId).toBe('food-chicken');
    expect(repository.addFoodCalls).toHaveLength(0);
    expect(await screen.findByLabelText('View Chicken breast photo')).toBeInTheDocument();
  });

  it('reveals a linked food’s photo controls with the rest of its fields', async () => {
    const repository = new FakeRepository();
    repository.library = [{ ...CHICKEN, imagePath: 'uid/food-chicken.jpg' }, COOKIE];
    await renderForm({
      editing: { ...ENTRY, name: 'Chicken breast', foodId: 'food-chicken' },
      repository,
    });

    // Look-only while the entry's nutrition stays collapsed
    fireEvent.click(await screen.findByLabelText('View Chicken breast photo'));
    expect(screen.queryByLabelText('Remove photo')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('dialog', { name: 'Chicken breast photo' }));

    fireEvent.click(screen.getByText('Edit nutrition'));
    fireEvent.click(screen.getByLabelText('View Chicken breast photo'));
    fireEvent.click(screen.getByLabelText('Remove photo'));

    // Removal lands on the library food itself, not on this entry
    await waitFor(() => expect(repository.imageRemovals).toEqual(['food-chicken']));
    expect(await screen.findByLabelText('Add photo')).toBeInTheDocument();
    expect(repository.updateEntryCalls).toHaveLength(0);
  });

  it('drops a held photo when a library food is picked from the dropdown', async () => {
    const onClose = vi.fn();
    const repository = await renderForm({ onClose });

    fillNewFood('Chicken');
    attachPhoto();
    expect(await screen.findByLabelText('View Chicken photo')).toBeInTheDocument();

    const option = within(screen.getByRole('listbox'))
      .getAllByRole('option')
      .find((o) => o.textContent?.includes('Chicken breast'))!;
    fireEvent.click(option);

    // Nothing left to attach it to, so the control and the photo both go
    expect(screen.queryByLabelText('View Chicken photo')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Add photo')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Add to log'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(repository.imageUploads).toHaveLength(0);
    expect(repository.addFoodCalls).toHaveLength(0);
  });

  it('uploads nothing when the photo is removed before saving', async () => {
    const onClose = vi.fn();
    const repository = await renderForm({ onClose });

    fillNewFood('Cheesy mash');
    attachPhoto();

    fireEvent.click(await screen.findByLabelText('View Cheesy mash photo'));
    fireEvent.click(screen.getByLabelText('Remove photo'));
    expect(screen.getByLabelText('Add photo')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Add to log'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(repository.addFoodCalls).toHaveLength(1);
    expect(repository.imageUploads).toHaveLength(0);
  });

  it('uploads nothing when the form is closed without saving', async () => {
    const repository = await renderForm();

    fillNewFood('Cheesy mash');
    attachPhoto();
    await screen.findByLabelText('View Cheesy mash photo');

    cleanup();
    expect(repository.imageUploads).toHaveLength(0);
    expect(repository.addFoodCalls).toHaveLength(0);
  });

  it('keeps the entry and the captured food when the image upload fails', async () => {
    const onClose = vi.fn();
    const repository = new FakeRepository();
    repository.uploadFoodImage = async () => {
      throw new Error('upload failed');
    };
    await renderForm({ onClose, repository });

    fillNewFood('Cheesy mash');
    attachPhoto();
    fireEvent.click(screen.getByText('Add to log'));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(repository.addEntryCalls).toHaveLength(1);
    expect(repository.addFoodCalls).toHaveLength(1);
    // Non-image values are all intact; the photo is the only thing lost
    expect(repository.addFoodCalls[0]).toMatchObject({ name: 'Cheesy mash', calories: 100 });
    expect(repository.addFoodCalls[0]).not.toHaveProperty('imagePath');
  });

  it('logs the entry and uploads nothing when the food capture fails', async () => {
    const onClose = vi.fn();
    const repository = new FakeRepository();
    repository.addFood = async () => {
      throw new Error('capture failed');
    };
    await renderForm({ onClose, repository });

    fillNewFood('Cheesy mash');
    attachPhoto();
    fireEvent.click(screen.getByText('Add to log'));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    // The entry survives unlinked; with no food to attach to, the photo is dropped
    expect(repository.addEntryCalls[0]).toMatchObject({ name: 'Cheesy mash', foodId: undefined });
    expect(repository.imageUploads).toHaveLength(0);
  });

  it('holds the analyzed photo from an accepted estimate, still removable', async () => {
    const onClose = vi.fn();
    const repository = await renderForm({ onClose });

    openIdentify();
    fireEvent.click(screen.getByText('stub-fallback'));
    fireEvent.click(screen.getByText('stub-accept-estimate'));

    // The identify photo carried through the handoff into the form
    expect(await screen.findByLabelText('View Mystery bowl photo')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('View Mystery bowl photo'));
    fireEvent.click(screen.getByLabelText('Remove photo'));
    expect(screen.getByLabelText('Add photo')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Add to log'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(repository.imageUploads).toHaveLength(0);
  });

  it('attaches the analyzed photo when the estimate is saved as-is', async () => {
    const onClose = vi.fn();
    const repository = await renderForm({ onClose });

    openIdentify();
    fireEvent.click(screen.getByText('stub-fallback'));
    fireEvent.click(screen.getByText('stub-accept-estimate'));
    await screen.findByLabelText('View Mystery bowl photo');

    fireEvent.click(screen.getByText('Add to log'));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const captured = repository.addFoodCalls[0] as LibraryFood;
    expect(captured.name).toBe('Mystery bowl');
    await waitFor(() => expect(repository.imageUploads).toHaveLength(1));
    expect(repository.imageUploads[0].foodId).toBe(captured.id);
  });

  it('never attaches an image to a food the entry merely matches', async () => {
    const onClose = vi.fn();
    const repository = new FakeRepository();
    repository.library = [{ ...CHICKEN, imagePath: 'uid/chicken.jpg' }, COOKIE];
    await renderForm({ onClose, repository });

    fillNewFood('Chicken brea');
    attachPhoto();
    await screen.findByLabelText('View Chicken brea photo');

    // Completing the name onto an existing food withdraws the control
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Chicken breast' } });
    fireEvent.click(screen.getByText('Add to log'));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(repository.addFoodCalls).toHaveLength(0);
    expect(repository.imageUploads).toHaveLength(0);
    expect(repository.addEntryCalls[0]).toMatchObject({ foodId: 'food-chicken' });
  });
});
