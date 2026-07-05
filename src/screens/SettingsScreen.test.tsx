import { fireEvent, render, screen } from '@testing-library/react';
import { SettingsScreen } from './SettingsScreen';
import { AppProvider } from '../state/AppState';
import { AuthProvider } from '../state/AuthProvider';
import { ThemeProvider } from '../state/ThemeProvider';
import type { StorageRepository } from '../storage';
import type { FoodEntry, Goals, LibraryFood, MealSuggestions } from '../types';

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
    expect(screen.getByLabelText('Theme')).toHaveValue('system');
    expect(document.documentElement).not.toHaveAttribute('data-theme');
  });

  it('switches the app to dark mode and persists the choice', async () => {
    renderSettings();
    await screen.findByRole('heading', { name: 'Default daily goal' });
    fireEvent.change(screen.getByLabelText('Theme'), { target: { value: 'dark' } });

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(localStorage.getItem('cal-tracker:theme')).toBe('dark');
  });
});
