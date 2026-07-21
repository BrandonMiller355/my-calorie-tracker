import { fireEvent, render, screen } from '@testing-library/react';
import { SettingsScreen } from './SettingsScreen';
import { AppProvider } from '../state/AppState';
import { AuthProvider } from '../state/AuthProvider';
import { ThemeProvider } from '../state/ThemeProvider';
import type { StorageRepository } from '../storage';
import type { FoodEntry, Goals, LibraryFood, MealSuggestions, WeekDeficitDay } from '../types';

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

  it('rejects a non-positive weekly deficit goal', async () => {
    renderSettings();
    await screen.findByRole('heading', { name: 'Weekly deficit goal' });

    fireEvent.change(screen.getByLabelText('Weekly deficit goal (kcal)'), {
      target: { value: '0' },
    });
    fireEvent.click(screen.getByText('Save weekly goal'));

    expect(
      await screen.findByText('Weekly deficit goal must be a number greater than 0.'),
    ).toBeInTheDocument();
  });
});
