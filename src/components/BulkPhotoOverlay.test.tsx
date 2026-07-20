import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BulkPhotoOverlay, MAX_BATCH_PHOTOS } from './BulkPhotoOverlay';
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

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}));

// Only the network call is stubbed; buildRequestFoods stays real so requests
// carry the actual library payload.
const identifyFoodMock = vi.hoisted(() => vi.fn());
vi.mock('../api/identifyFood', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/identifyFood')>();
  return { ...actual, identifyFood: identifyFoodMock };
});

// jsdom can't decode images, so the downscaler maps each file to a fake data
// URL carrying its name; files named bad* reject like a corrupt image.
vi.mock('../lib/photo', () => ({
  loadImageFile: vi.fn(async (file: File) => {
    if (file.name.startsWith('bad')) throw new Error('not a decodable image');
    return `data:image/jpeg;base64,${file.name}`;
  }),
}));

const BEANS: LibraryFood = {
  id: 'food-beans',
  name: 'Black beans',
  servingLabel: 'serving',
  servingSize: { amount: 100, unit: 'g' },
  calories: 120,
  carbs: 21,
  protein: 7,
  fat: 1,
  source: 'manual',
};

const CHEESE: LibraryFood = {
  id: 'food-cheese',
  name: 'Cheese sauce',
  description: 'homemade',
  servingLabel: 'serving',
  servingSize: { amount: 30, unit: 'g' },
  calories: 90,
  carbs: 2,
  protein: 3,
  fat: 8,
  source: 'manual',
};

const SALSA: LibraryFood = {
  id: 'food-salsa',
  name: 'Salsa',
  servingLabel: 'serving',
  servingSize: { amount: 36, unit: 'g' },
  calories: 15,
  carbs: 3,
  protein: 1,
  fat: 0,
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

const FOODS = [BEANS, CHEESE, SALSA, COOKIE];

function photoFile(name: string, lastModified: number): File {
  return new File(['x'], name, { type: 'image/jpeg', lastModified });
}

function match(food: LibraryFood, grams?: number, source: 'scale' | 'estimate' = 'scale') {
  return {
    candidates: [{ id: food.id, confidence: 0.9 }],
    ...(grams !== undefined ? { amount: { grams, source } } : {}),
  };
}

class FakeRepository implements StorageRepository {
  addEntryCalls: FoodEntry[] = [];
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
    return FOODS;
  }
  async addFood(): Promise<void> {}
  async updateFood(): Promise<void> {}
  async archiveFood(): Promise<void> {}
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

interface Callbacks {
  onLogged: ReturnType<typeof vi.fn>;
  onCancel: ReturnType<typeof vi.fn>;
}

async function renderOverlay(): Promise<{ repository: FakeRepository } & Callbacks> {
  const repository = new FakeRepository();
  const callbacks: Callbacks = { onLogged: vi.fn(), onCancel: vi.fn() };
  render(
    <AuthProvider>
      <AppProvider repository={repository}>
        <BulkPhotoOverlay
          foods={FOODS}
          date="2026-07-17"
          meal="lunch"
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

async function selectFiles(files: File[]) {
  fireEvent.change(screen.getByLabelText('Choose photos from your device'), {
    target: { files },
  });
  // Flush the decode + sequential identification chain
  await act(async () => {});
}

beforeEach(() => {
  identifyFoodMock.mockReset();
});

describe('BulkPhotoOverlay selection', () => {
  it('rejects selections over the batch cap without sending anything', async () => {
    await renderOverlay();

    const files = Array.from({ length: MAX_BATCH_PHOTOS + 1 }, (_, i) =>
      photoFile(`p${i}.jpg`, 1000 + i),
    );
    await selectFiles(files);

    expect(screen.getByRole('alert')).toHaveTextContent(`limit is ${MAX_BATCH_PHOTOS}`);
    expect(identifyFoodMock).not.toHaveBeenCalled();
    // Still on the picker, so a smaller reselection can proceed
    expect(screen.getByText('🖼️ Choose photos')).toBeInTheDocument();
  });

  it('skips undecodable files with a note and identifies the rest', async () => {
    identifyFoodMock.mockResolvedValueOnce(match(BEANS, 142));
    await renderOverlay();

    await selectFiles([photoFile('bad.jpg', 1000), photoFile('beans.jpg', 2000)]);

    expect(identifyFoodMock).toHaveBeenCalledTimes(1);
    expect(identifyFoodMock.mock.calls[0][0].image).toBe('data:image/jpeg;base64,beans.jpg');
    expect(screen.getByText(/couldn't be used as a photo/)).toBeInTheDocument();
  });

  it('cancel before selecting logs nothing and calls onCancel', async () => {
    const { repository, onCancel } = await renderOverlay();

    fireEvent.click(screen.getByText('Cancel'));

    expect(onCancel).toHaveBeenCalled();
    expect(repository.addEntryCalls).toHaveLength(0);
    expect(identifyFoodMock).not.toHaveBeenCalled();
  });
});

describe('BulkPhotoOverlay chained identification', () => {
  it('identifies photos in lastModified order with chained notes', async () => {
    identifyFoodMock
      .mockResolvedValueOnce(match(BEANS, 142)) // photo 1: beans
      .mockResolvedValueOnce({ candidates: [] }) // photo 2: not recognized
      .mockResolvedValueOnce(match(SALSA, 50)); // photo 3: salsa

    await renderOverlay();
    // Selected out of order; lastModified must define the sequence
    await selectFiles([
      photoFile('cheese.jpg', 2000),
      photoFile('beans.jpg', 1000),
      photoFile('salsa.jpg', 3000),
    ]);

    expect(identifyFoodMock).toHaveBeenCalledTimes(3);
    const [first, second, third] = identifyFoodMock.mock.calls.map((c) => c[0]);

    // First photo: the oldest file, no chaining note
    expect(first.image).toBe('data:image/jpeg;base64,beans.jpg');
    expect(first.note).toBeUndefined();
    expect(first.foods.map((f: { id: string }) => f.id)).toEqual(FOODS.map((f) => f.id));

    // Second photo: note names photo 1's top candidate with its weight
    expect(second.image).toBe('data:image/jpeg;base64,cheese.jpg');
    expect(second.note).toContain('already contained: Black beans (142 g)');
    expect(second.note).toContain('identify ONLY the new addition');
    expect(second.note).toContain('tared before each addition');

    // Third photo: the unrecognized photo still advances the chain
    expect(third.note).toContain('Black beans (142 g), an unidentified addition');
  });
});

describe('BulkPhotoOverlay review', () => {
  async function renderThreePhotoReview() {
    identifyFoodMock
      .mockResolvedValueOnce(match(BEANS, 142))
      .mockResolvedValueOnce({ candidates: [] })
      .mockResolvedValueOnce(match(SALSA, 50));
    const result = await renderOverlay();
    await selectFiles([
      photoFile('beans.jpg', 1000),
      photoFile('mystery.jpg', 2000),
      photoFile('salsa.jpg', 3000),
    ]);
    return result;
  }

  it('prefills rows from scale reads, defaults meals, and excludes unrecognized photos', async () => {
    await renderThreePhotoReview();

    expect(screen.getByText('Check these before logging')).toBeInTheDocument();
    expect(screen.getByLabelText('Amount for photo 1')).toHaveValue('142');
    expect(screen.getByLabelText('Unit for photo 1')).toHaveValue('g');
    expect(screen.getByLabelText('Meal for photo 1')).toHaveValue('lunch');
    expect(screen.getByText('170.4 kcal')).toBeInTheDocument(); // 142 g of 120/100 g

    expect(screen.getByText('Not recognized')).toBeInTheDocument();
    expect(screen.getByLabelText('Amount for photo 3')).toHaveValue('50');

    // The unrecognized middle photo doesn't count
    expect(screen.getByText('Add 2 entries')).toBeInTheDocument();
  });

  it('removing a row updates the count and logging skips it', async () => {
    const { repository, onLogged } = await renderThreePhotoReview();

    fireEvent.click(screen.getByLabelText('Remove photo 3'));
    expect(screen.getByText('Add 1 entry')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Add 1 entry'));
    await waitFor(() => expect(onLogged).toHaveBeenCalled());
    expect(repository.addEntryCalls.map((e) => e.name)).toEqual(['Black beans']);
  });

  it('disables logging while an amount is invalid', async () => {
    await renderThreePhotoReview();

    fireEvent.change(screen.getByLabelText('Amount for photo 1'), { target: { value: 'oops' } });

    expect(screen.getByText('Enter a valid amount')).toBeInTheDocument();
    expect(screen.getByText('Add 2 entries')).toBeDisabled();
  });

  it('marks an uncertain row, preselects the top candidate, and re-prefills on re-pick', async () => {
    identifyFoodMock.mockResolvedValueOnce({
      candidates: [
        { id: BEANS.id, confidence: 0.6 },
        { id: COOKIE.id, confidence: 0.4 },
      ],
      amount: { grams: 100, source: 'scale' },
    });
    await renderOverlay();
    await selectFiles([photoFile('mystery.jpg', 1000)]);

    expect(screen.getByText('AI unsure — check the match')).toBeInTheDocument();
    const picker = screen.getByLabelText('Food for photo 1');
    expect(picker).toHaveValue(BEANS.id);
    expect(screen.getByLabelText('Amount for photo 1')).toHaveValue('100');
    expect(screen.getByLabelText('Unit for photo 1')).toHaveValue('g');

    // The cookie has no weight equivalence, so the grams are dropped for 1 cookie
    fireEvent.change(picker, { target: { value: COOKIE.id } });
    expect(screen.getByLabelText('Amount for photo 1')).toHaveValue('1');
    expect(screen.getByLabelText('Unit for photo 1')).toHaveValue('cookie');
  });

  it('labels an AI-estimated weight', async () => {
    identifyFoodMock.mockResolvedValueOnce(match(BEANS, 90, 'estimate'));
    await renderOverlay();
    await selectFiles([photoFile('beans.jpg', 1000)]);

    expect(screen.getByText(/Weight estimated by AI/)).toBeInTheDocument();
  });

  it('logs entries with the reviewed values, links, and sources', async () => {
    const { repository, onLogged } = await renderThreePhotoReview();

    fireEvent.change(screen.getByLabelText('Meal for photo 3'), { target: { value: 'dinner' } });
    fireEvent.click(screen.getByText('Add 2 entries'));
    await waitFor(() => expect(onLogged).toHaveBeenCalled());

    const [beans, salsa] = repository.addEntryCalls;
    expect(beans).toMatchObject({
      name: 'Black beans',
      amount: 142,
      unit: 'g',
      quantity: 1.42,
      servingLabel: 'serving',
      meal: 'lunch',
      date: '2026-07-17',
      foodId: 'food-beans',
      source: 'manual',
      calories: 120,
    });
    expect(salsa).toMatchObject({
      name: 'Salsa',
      amount: 50,
      unit: 'g',
      meal: 'dinner',
      foodId: 'food-salsa',
    });
  });

  it('dismissing the review logs nothing', async () => {
    const { repository, onCancel } = await renderThreePhotoReview();

    fireEvent.click(screen.getByText('Cancel'));

    expect(onCancel).toHaveBeenCalled();
    expect(repository.addEntryCalls).toHaveLength(0);
  });
});

describe('BulkPhotoOverlay failure handling', () => {
  it('keeps earlier rows on a mid-batch failure and resumes from the failed photo', async () => {
    identifyFoodMock
      .mockResolvedValueOnce(match(BEANS, 142))
      .mockRejectedValueOnce(new Error('rate-limited right now'));
    await renderOverlay();
    await selectFiles([
      photoFile('beans.jpg', 1000),
      photoFile('cheese.jpg', 2000),
      photoFile('salsa.jpg', 3000),
    ]);

    // Photo 1's row survived; photos 2 and 3 wait behind the retry
    expect(screen.getByRole('alert')).toHaveTextContent('rate-limited right now');
    expect(identifyFoodMock).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText('Amount for photo 1')).toHaveValue('142');

    identifyFoodMock
      .mockResolvedValueOnce(match(CHEESE, 89))
      .mockResolvedValueOnce(match(SALSA, 50));
    fireEvent.click(screen.getByText('Retry'));
    await act(async () => {});

    expect(identifyFoodMock).toHaveBeenCalledTimes(4);
    // The retried request still chains off photo 1's result
    const retried = identifyFoodMock.mock.calls[2][0];
    expect(retried.image).toBe('data:image/jpeg;base64,cheese.jpg');
    expect(retried.note).toContain('Black beans (142 g)');
    // And the final request chains off both
    expect(identifyFoodMock.mock.calls[3][0].note).toContain(
      'Black beans (142 g), Cheese sauce (89 g)',
    );

    expect(screen.getByText('Add 3 entries')).toBeInTheDocument();
  });

  it('keeps unsaved rows for retry after a partial save failure', async () => {
    identifyFoodMock
      .mockResolvedValueOnce(match(BEANS, 142))
      .mockResolvedValueOnce(match(CHEESE, 89));
    const { repository, onLogged } = await renderOverlay();
    await selectFiles([photoFile('beans.jpg', 1000), photoFile('cheese.jpg', 2000)]);
    repository.failOnceFor.add('Cheese sauce');

    fireEvent.click(screen.getByText('Add 2 entries'));
    await act(async () => {});

    // Beans landed; cheese failed and stays listed
    expect(repository.addEntryCalls.map((e) => e.name)).toEqual(['Black beans']);
    expect(onLogged).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Couldn’t save');
    expect(screen.getByText('Add 1 entry')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Add 1 entry'));
    await waitFor(() => expect(onLogged).toHaveBeenCalled());
    expect(repository.addEntryCalls.map((e) => e.name)).toEqual(['Black beans', 'Cheese sauce']);
  });
});
