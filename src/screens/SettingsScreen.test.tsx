import { fireEvent, render, screen } from '@testing-library/react';
import { SettingsScreen } from './SettingsScreen';
import { AppProvider } from '../state/AppState';
import { AuthProvider } from '../state/AuthProvider';
import { ThemeProvider } from '../state/ThemeProvider';
import type { StorageRepository } from '../storage';
import type {
  FoodEntry,
  Goals,
  LibraryFood,
  MealSuggestions,
  SavedMeal,
  WeekDeficitDay,
} from '../types';

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signOut: vi.fn(async () => ({ error: null })),
    },
  },
}));

class FakeRepository implements StorageRepository {
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
    return [];
  }
  async addFood(): Promise<void> {}
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
    return [];
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
  weeklyDeficitGoal: number | null = null;
  async getWeeklyDeficitGoal(): Promise<number | null> {
    return this.weeklyDeficitGoal;
  }
  async saveWeeklyDeficitGoal(goal: number): Promise<void> {
    this.weeklyDeficitGoal = goal;
  }
}

function renderSettings() {
  return render(
    <ThemeProvider>
      <AuthProvider>
        <AppProvider repository={new FakeRepository()}>
          <SettingsScreen />
        </AppProvider>
      </AuthProvider>
    </ThemeProvider>,
  );
}

describe('SettingsScreen theme toggle', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('defaults to "Match device" and applies no override', async () => {
    renderSettings();
    await screen.findByRole('heading', { name: 'Default daily goal' });
    expect(screen.getByRole('radio', { name: 'Match device' })).toBeChecked();
    expect(document.documentElement).not.toHaveAttribute('data-theme');
  });

  it('switches the app to dark mode and persists the choice', async () => {
    renderSettings();
    await screen.findByRole('heading', { name: 'Default daily goal' });
    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(localStorage.getItem('cal-tracker:theme')).toBe('dark');
  });
});

describe('SettingsScreen goal labeling', () => {
  it('labels the daily calorie goal field as "Calorie burn"', async () => {
    renderSettings();
    await screen.findByRole('heading', { name: 'Default daily goal' });
    expect(screen.getByLabelText('Calorie burn (kcal)')).toBeInTheDocument();
  });
});

describe('SettingsScreen macro/calorie mismatch warning', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('warns before saving when macros do not add up to the calorie goal', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderSettings();
    await screen.findByRole('heading', { name: 'Default daily goal' });

    fireEvent.change(screen.getByLabelText('Calorie burn (kcal)'), {
      target: { value: '5000' },
    });
    fireEvent.click(screen.getByText('Save goals'));

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy.mock.calls[0][0]).toContain('but your calorie goal is 5000 kcal');
    expect(await screen.findByText('Saved ✓')).toBeInTheDocument();
  });

  it('does not save when the user cancels the mismatch warning', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderSettings();
    await screen.findByRole('heading', { name: 'Default daily goal' });

    fireEvent.change(screen.getByLabelText('Calorie burn (kcal)'), {
      target: { value: '5000' },
    });
    fireEvent.click(screen.getByText('Save goals'));

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Saved ✓')).not.toBeInTheDocument();
  });

  it('saves without warning when macros roughly match the calorie goal', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderSettings();
    await screen.findByRole('heading', { name: 'Default daily goal' });

    // Built-in defaults (2000 kcal vs ~1985 from macros) are within tolerance.
    fireEvent.click(screen.getByText('Save goals'));

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(await screen.findByText('Saved ✓')).toBeInTheDocument();
  });
});

describe('SettingsScreen weekly deficit goal', () => {
  it('starts blank when no weekly deficit goal has been set', async () => {
    renderSettings();
    await screen.findByRole('heading', { name: 'Weekly deficit goal' });
    expect(screen.getByLabelText('Weekly deficit goal (kcal)')).toHaveValue('');
  });

  it('saves a valid weekly deficit goal', async () => {
    renderSettings();
    await screen.findByRole('heading', { name: 'Weekly deficit goal' });

    fireEvent.change(screen.getByLabelText('Weekly deficit goal (kcal)'), {
      target: { value: '3500' },
    });
    fireEvent.click(screen.getByText('Save weekly goal'));

    expect(await screen.findByText('Saved ✓')).toBeInTheDocument();
  });

  it('saves a weekly deficit goal of zero', async () => {
    renderSettings();
    await screen.findByRole('heading', { name: 'Weekly deficit goal' });

    fireEvent.change(screen.getByLabelText('Weekly deficit goal (kcal)'), {
      target: { value: '0' },
    });
    fireEvent.click(screen.getByText('Save weekly goal'));

    expect(await screen.findByText('Saved ✓')).toBeInTheDocument();
  });

  it('rejects a non-numeric weekly deficit goal', async () => {
    renderSettings();
    await screen.findByRole('heading', { name: 'Weekly deficit goal' });

    fireEvent.change(screen.getByLabelText('Weekly deficit goal (kcal)'), {
      target: { value: 'abc' },
    });
    fireEvent.click(screen.getByText('Save weekly goal'));

    expect(
      await screen.findByText('Weekly deficit goal must be a number.'),
    ).toBeInTheDocument();
  });
});
