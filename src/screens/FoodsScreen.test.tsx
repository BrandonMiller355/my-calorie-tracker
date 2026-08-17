import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { FoodsScreen } from './FoodsScreen';
import { AppProvider } from '../state/AppState';
import type { StorageRepository } from '../storage';
import type {
  FoodEntry,
  Goals,
  LibraryFood,
  MealSuggestions,
  SavedMeal,
  WeekDeficitDay,
} from '../types';

// The camera/file overlay is untestable in jsdom; the stub captures directly.
vi.mock('../components/PhotoCapture', () => ({
  PhotoCapture: ({ onCapture }: { onCapture: (img: string) => void; onCancel: () => void }) => (
    <button onClick={() => onCapture('data:image/jpeg;base64,editorphoto')}>stub-capture</button>
  ),
}));

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
  addedMeals: SavedMeal[] = [];
  updatedMeals: SavedMeal[] = [];
  archivedMeals: string[] = [];
  imageUploads: { foodId: string; blob: Blob }[] = [];
  imageRemovals: string[] = [];
  constructor(
    private foods: LibraryFood[] = [],
    private meals: SavedMeal[] = [],
  ) {}

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
  async uploadFoodImage(foodId: string, blob: Blob): Promise<string> {
    this.imageUploads.push({ foodId, blob });
    return `uid/${foodId}.jpg`;
  }
  async removeFoodImage(foodId: string): Promise<void> {
    this.imageRemovals.push(foodId);
  }
  async getFoodImageUrl(path: string): Promise<string> {
    return `signed:${path}`;
  }
  async getMeals(): Promise<SavedMeal[]> {
    return this.meals;
  }
  async addMeal(meal: SavedMeal): Promise<void> {
    this.addedMeals.push(meal);
  }
  async updateMeal(meal: SavedMeal): Promise<void> {
    this.updatedMeals.push(meal);
  }
  async archiveMeal(id: string): Promise<void> {
    this.archivedMeals.push(id);
  }
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

function renderFoods(foods: LibraryFood[], meals: SavedMeal[] = []) {
  const repository = new FakeRepository(foods, meals);
  render(
    <AppProvider repository={repository}>
      <FoodsScreen />
    </AppProvider>,
  );
  return repository;
}

// Some tests spy on window.confirm for the macro/calorie mismatch prompt.
afterEach(() => vi.restoreAllMocks());

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
    // 420 kcal no longer matches PB&J's macros (~289), so the fork prompts.
    vi.spyOn(window, 'confirm').mockReturnValue(true);
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

const PBJ_WITH_PHOTO: LibraryFood = { ...PBJ, imagePath: 'uid/pbj.jpg' };

describe('FoodsScreen food photos', () => {
  it('attaches a chosen photo to the edited food', async () => {
    const repository = renderFoods([OATMEAL]);
    await openEditForm('Oatmeal');

    fireEvent.click(screen.getByLabelText('Add photo'));
    fireEvent.click(screen.getByText('stub-capture'));

    await waitFor(() => expect(repository.imageUploads).toHaveLength(1));
    expect(repository.imageUploads[0].foodId).toBe('oatmeal');
  });

  it('reveals Replace/Remove icons only on the enlarged photo and removes it', async () => {
    const repository = renderFoods([PBJ_WITH_PHOTO]);
    const form = await openEditForm('PB&J');

    // No action icons on the small thumbnail.
    expect(within(form).queryByLabelText('Remove photo')).not.toBeInTheDocument();

    // Tapping the form's thumbnail enlarges it; the icons live on that view.
    fireEvent.click(await within(form).findByLabelText('View PB&J photo'));
    expect(within(form).getByLabelText('Replace photo')).toBeInTheDocument();
    fireEvent.click(within(form).getByLabelText('Remove photo'));

    await waitFor(() => expect(repository.imageRemovals).toEqual(['pbj']));
  });

  it('saves text changes independently of the photo', async () => {
    const repository = renderFoods([OATMEAL]);
    await openEditForm('Oatmeal');

    // Save the text edit without ever touching a photo.
    setName('Oatmeal, steel cut');
    fireEvent.click(screen.getByText('Save changes'));

    await screen.findByText('Oatmeal, steel cut');
    expect(repository.updated).toHaveLength(1);
    expect(repository.imageUploads).toHaveLength(0);
  });

  it('keeps an existing photo when saving text/nutrition changes', async () => {
    const repository = renderFoods([PBJ_WITH_PHOTO]);
    await openEditForm('PB&J');

    fireEvent.change(screen.getByLabelText('Calories (kcal)'), { target: { value: '333' } });
    fireEvent.click(screen.getByText('Save changes'));

    await waitFor(() => expect(repository.updated).toHaveLength(1));
    // The image reference must survive the save, not be clobbered to undefined.
    expect(repository.updated[0]).toMatchObject({ calories: 333, imagePath: 'uid/pbj.jpg' });
  });

  /** Fills the add form with a food whose macros already add up. */
  function fillNewFood(name: string) {
    setName(name);
    fireEvent.change(screen.getByLabelText('Calories (kcal)'), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('Carbs (g)'), { target: { value: '25' } });
  }

  it('attaches a photo chosen while adding a food, once the food is saved', async () => {
    const repository = renderFoods([]);

    fireEvent.click(await screen.findByText('+ Add food item'));
    fillNewFood('Rice');
    fireEvent.click(screen.getByLabelText('Add photo'));
    fireEvent.click(screen.getByText('stub-capture'));
    // The pending photo previews in the form before there is anything to upload.
    expect(await screen.findByLabelText('View Rice photo')).toBeInTheDocument();
    expect(repository.imageUploads).toHaveLength(0);

    fireEvent.click(screen.getByText('Add to library'));

    await waitFor(() => expect(repository.imageUploads).toHaveLength(1));
    expect(repository.added).toHaveLength(1);
    expect(repository.imageUploads[0].foodId).toBe(repository.added[0].id);
  });

  it('drops a pending photo removed before the new food is saved', async () => {
    const repository = renderFoods([]);

    fireEvent.click(await screen.findByText('+ Add food item'));
    fillNewFood('Rice');
    fireEvent.click(screen.getByLabelText('Add photo'));
    fireEvent.click(screen.getByText('stub-capture'));

    fireEvent.click(await screen.findByLabelText('View Rice photo'));
    fireEvent.click(screen.getByLabelText('Remove photo'));
    expect(screen.getByLabelText('Add photo')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Add to library'));

    await waitFor(() => expect(repository.added).toHaveLength(1));
    expect(repository.imageUploads).toHaveLength(0);
  });
});

// Beer's alcohol calories never reconcile with its macros: 6c + 1p + 0f ≈ 28
// kcal against 110. Already opted out of the mismatch warning.
const BEER: LibraryFood = {
  id: 'beer',
  name: 'Modelo',
  servingLabel: 'serving',
  calories: 110,
  carbs: 6,
  protein: 1,
  fat: 0,
  source: 'manual',
  skipMacroCheck: true,
};

describe('FoodsScreen macro/calorie mismatch warning', () => {
  it('warns when a brand-new food added from scratch does not add up', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const repository = renderFoods([]);

    fireEvent.click(await screen.findByText('+ Add food item'));
    setName('Modelo');
    fireEvent.change(screen.getByLabelText('Calories (kcal)'), { target: { value: '110' } });
    fireEvent.change(screen.getByLabelText('Carbs (g)'), { target: { value: '6' } });
    fireEvent.change(screen.getByLabelText('Protein (g)'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Fat (g)'), { target: { value: '0' } });
    fireEvent.click(screen.getByText('Add to library'));

    await waitFor(() => expect(repository.added).toHaveLength(1));
    expect(confirmSpy).toHaveBeenCalledOnce();
    expect(repository.added[0]).toMatchObject({ name: 'Modelo', calories: 110, skipMacroCheck: true });
  });

  it('warns when an edit makes the macros stop adding up, and cancelling aborts', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const repository = renderFoods([OATMEAL]);
    await openEditForm('Oatmeal');

    fireEvent.change(screen.getByLabelText('Calories (kcal)'), { target: { value: '400' } });
    fireEvent.click(screen.getByText('Save changes'));

    expect(confirmSpy).toHaveBeenCalledOnce();
    expect(repository.updated).toHaveLength(0);
  });

  it('opts the food out for good when the user saves the mismatch anyway', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const repository = renderFoods([OATMEAL]);
    await openEditForm('Oatmeal');

    fireEvent.change(screen.getByLabelText('Calories (kcal)'), { target: { value: '400' } });
    fireEvent.click(screen.getByText('Save changes'));

    await waitFor(() => expect(repository.updated).toHaveLength(1));
    expect(confirmSpy).toHaveBeenCalledOnce();
    expect(repository.updated[0]).toMatchObject({ id: 'oatmeal', calories: 400, skipMacroCheck: true });
  });

  it('never warns for a food already opted out, and preserves the flag', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const repository = renderFoods([BEER]);
    await openEditForm('Modelo');

    fireEvent.click(screen.getByText('Save changes'));

    await waitFor(() => expect(repository.updated).toHaveLength(1));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(repository.updated[0]).toMatchObject({ id: 'beer', skipMacroCheck: true });
  });

  it('flags a mismatched fork and does not inherit the original food’s opt-out', async () => {
    // Forking the already-opted-out beer must warn again — a fork starts fresh.
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const repository = renderFoods([BEER]);
    await openEditForm('Modelo');

    setName('Modelo Negra');
    fireEvent.click(saveAsNew()!);

    expect(confirmSpy).toHaveBeenCalledOnce();
    expect(repository.added).toHaveLength(0);
  });
});

const TACO_SALAD: SavedMeal = {
  id: 'taco-salad',
  name: 'Taco salad',
  items: [
    { foodId: 'pbj', amount: 1, unit: 'serving' },
    { foodId: 'oatmeal', amount: 2, unit: 'serving' },
  ],
};

const OATS_AND_TOAST: SavedMeal = {
  id: 'oats-and-toast',
  name: 'Oats and toast',
  items: [{ foodId: 'oatmeal', amount: 1, unit: 'serving' }],
};

/** Enter multi-select mode and tick the named foods, searching for each in turn —
 *  select mode lists nothing until the search narrows the library. The "+ New
 *  meal" button lives on the Meals tab and drops back into the Foods tab in
 *  select mode. */
async function selectFoods(...names: string[]) {
  fireEvent.click(await screen.findByRole('tab', { name: 'Meals' }));
  fireEvent.click(await screen.findByText('+ New meal'));
  const filter = screen.getByLabelText('Filter your library');
  for (const name of names) {
    fireEvent.change(filter, { target: { value: name } });
    fireEvent.click(screen.getByLabelText(`Select ${name}`));
  }
  fireEvent.change(filter, { target: { value: '' } });
}

describe('FoodsScreen new meal button placement', () => {
  it('hides "+ New meal" on the Foods tab and shows it on the Meals tab', async () => {
    renderFoods([PBJ, OATMEAL]);

    // The Foods tab is the default; the meal entry point is not here.
    await screen.findByText('+ Add food item');
    expect(screen.queryByText('+ New meal')).not.toBeInTheDocument();

    fireEvent.click(await screen.findByRole('tab', { name: 'Meals' }));
    expect(await screen.findByText('+ New meal')).toBeInTheDocument();
  });

  it('starts a new meal in Foods select mode from the Meals tab', async () => {
    renderFoods([PBJ, OATMEAL]);
    fireEvent.click(await screen.findByRole('tab', { name: 'Meals' }));
    fireEvent.click(await screen.findByText('+ New meal'));

    // We land back on the Foods tab in select mode, ready to pick foods.
    expect(screen.getByRole('tab', { name: 'Foods' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Filter your library')).toBeInTheDocument();
  });

  it('withholds "+ New meal" until the library has at least two foods', async () => {
    renderFoods([PBJ]);
    fireEvent.click(await screen.findByRole('tab', { name: 'Meals' }));

    expect(screen.queryByText('+ New meal')).not.toBeInTheDocument();
    expect(
      screen.getByText('No meals yet — add at least two foods to combine them into a meal.'),
    ).toBeInTheDocument();
  });
});

describe('FoodsScreen meal builder', () => {
  it('creates a meal from a multi-selection, seeded at 1 serving each', async () => {
    const repository = renderFoods([PBJ, OATMEAL]);
    await selectFoods('PB&J', 'Oatmeal');

    fireEvent.click(screen.getByText('Create meal from 2 foods'));
    const builder = screen.getByRole('form', { name: 'Create meal' });
    fireEvent.change(within(builder).getByLabelText('Name'), { target: { value: 'Taco salad' } });
    fireEvent.click(within(builder).getByText('Save meal'));

    await waitForMeal(repository);
    expect(repository.addedMeals).toHaveLength(1);
    expect(repository.addedMeals[0]).toMatchObject({
      name: 'Taco salad',
      items: [
        { foodId: 'pbj', amount: 1, unit: 'serving' },
        { foodId: 'oatmeal', amount: 1, unit: 'serving' },
      ],
    });
  });

  it('saves an adjusted component portion', async () => {
    const repository = renderFoods([PBJ, OATMEAL]);
    await selectFoods('PB&J', 'Oatmeal');
    fireEvent.click(screen.getByText('Create meal from 2 foods'));

    const builder = screen.getByRole('form', { name: 'Create meal' });
    fireEvent.change(within(builder).getByLabelText('Name'), { target: { value: 'Combo' } });
    fireEvent.change(within(builder).getByLabelText('Amount of Oatmeal'), { target: { value: '3' } });
    fireEvent.click(within(builder).getByText('Save meal'));

    await waitForMeal(repository);
    expect(repository.addedMeals[0].items).toContainEqual({
      foodId: 'oatmeal',
      amount: 3,
      unit: 'serving',
    });
  });

  it('lists no foods until the search narrows them, keeping ticks across searches', async () => {
    renderFoods([PBJ, OATMEAL]);
    fireEvent.click(await screen.findByRole('tab', { name: 'Meals' }));
    fireEvent.click(await screen.findByText('+ New meal'));

    // Nothing is listed up front — the library would bury the create button.
    expect(screen.queryByLabelText('Select PB&J')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Select Oatmeal')).not.toBeInTheDocument();

    const filter = screen.getByLabelText('Filter your library');
    fireEvent.change(filter, { target: { value: 'pb' } });
    fireEvent.click(screen.getByLabelText('Select PB&J'));

    fireEvent.change(filter, { target: { value: 'oat' } });
    // PB&J is out of the results but still ticked, shown as a chip
    expect(screen.queryByLabelText('Select PB&J')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Unselect PB&J')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Select Oatmeal'));
    fireEvent.change(filter, { target: { value: '' } });
    // With two picked, the create button is on screen without any list to scroll
    expect(screen.getByText('Create meal from 2 foods')).toBeInTheDocument();
  });

  it('drops a food from the selection when its chip is tapped', async () => {
    renderFoods([PBJ, OATMEAL]);
    await selectFoods('PB&J', 'Oatmeal');
    expect(screen.getByText('Create meal from 2 foods')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Unselect Oatmeal'));

    expect(screen.queryByLabelText('Unselect Oatmeal')).not.toBeInTheDocument();
    expect(screen.queryByText(/Create meal from/)).not.toBeInTheDocument();
  });

  it('requires a name before saving', async () => {
    const repository = renderFoods([PBJ, OATMEAL]);
    await selectFoods('PB&J', 'Oatmeal');
    fireEvent.click(screen.getByText('Create meal from 2 foods'));

    const builder = screen.getByRole('form', { name: 'Create meal' });
    fireEvent.click(within(builder).getByText('Save meal'));

    expect(within(builder).getByText('Name is required')).toBeInTheDocument();
    expect(repository.addedMeals).toHaveLength(0);
  });

  it('rejects a meal name already in use', async () => {
    const repository = renderFoods([PBJ, OATMEAL], [TACO_SALAD]);
    await selectFoods('PB&J', 'Oatmeal');
    fireEvent.click(screen.getByText('Create meal from 2 foods'));

    const builder = screen.getByRole('form', { name: 'Create meal' });
    fireEvent.change(within(builder).getByLabelText('Name'), { target: { value: 'taco salad' } });
    fireEvent.click(within(builder).getByText('Save meal'));

    expect(within(builder).getAllByText('A meal with this name already exists').length).toBeGreaterThan(0);
    expect(repository.addedMeals).toHaveLength(0);
  });
});

describe('FoodsScreen Meals tab', () => {
  it('lists meals with a live total and an expandable breakdown', async () => {
    renderFoods([PBJ, OATMEAL], [TACO_SALAD]);
    fireEvent.click(await screen.findByRole('tab', { name: 'Meals' }));

    const row = (await screen.findByText('Taco salad')).closest('.food-row') as HTMLElement;
    // 1 serving PB&J (300) + 2 servings Oatmeal (300) = 600
    expect(within(row).getByText(/600 kcal/)).toBeInTheDocument();

    fireEvent.click(within(row).getByText('2 items'));
    expect(within(row).getByText(/PB&J · 1 serving/)).toBeInTheDocument();
    expect(within(row).getByText(/Oatmeal · 2 serving/)).toBeInTheDocument();
  });

  it('notes unavailable components whose food is gone', async () => {
    // Only PB&J is in the library; the oatmeal component can't resolve
    renderFoods([PBJ], [TACO_SALAD]);
    fireEvent.click(await screen.findByRole('tab', { name: 'Meals' }));

    const row = (await screen.findByText('Taco salad')).closest('.food-row') as HTMLElement;
    fireEvent.click(within(row).getByText('2 items'));
    expect(within(row).getByText('1 item unavailable')).toBeInTheDocument();
  });

  it('filters the meal list by name', async () => {
    renderFoods([PBJ, OATMEAL], [TACO_SALAD, OATS_AND_TOAST]);
    fireEvent.click(await screen.findByRole('tab', { name: 'Meals' }));

    fireEvent.change(await screen.findByLabelText('Filter your meals'), {
      target: { value: 'oats' },
    });

    expect(screen.getByText('Oats and toast')).toBeInTheDocument();
    expect(screen.queryByText('Taco salad')).not.toBeInTheDocument();
  });

  it('says when no meal matches the filter, then restores the list when cleared', async () => {
    renderFoods([PBJ, OATMEAL], [TACO_SALAD, OATS_AND_TOAST]);
    fireEvent.click(await screen.findByRole('tab', { name: 'Meals' }));

    const filter = await screen.findByLabelText('Filter your meals');
    fireEvent.change(filter, { target: { value: 'sushi' } });
    expect(screen.getByText('No meals match “sushi”.')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Clear meal filter'));
    expect(screen.getByText('Taco salad')).toBeInTheDocument();
    expect(screen.getByText('Oats and toast')).toBeInTheDocument();
  });

  it('archives a meal after confirmation', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const repository = renderFoods([PBJ, OATMEAL], [TACO_SALAD]);
    fireEvent.click(await screen.findByRole('tab', { name: 'Meals' }));

    const row = (await screen.findByText('Taco salad')).closest('.food-row') as HTMLElement;
    fireEvent.click(within(row).getByLabelText('Archive Taco salad'));

    await waitFor(() => expect(repository.archivedMeals).toEqual(['taco-salad']));
    confirm.mockRestore();
  });
});

/** Meal saves are async; wait for the builder's addMeal to land. */
async function waitForMeal(repository: FakeRepository) {
  await waitFor(() => expect(repository.addedMeals.length).toBeGreaterThan(0));
}
