import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, useTheme } from './ThemeProvider';

function ThemePicker() {
  const { theme, setTheme } = useTheme();
  return (
    <div>
      <span>Current: {theme}</span>
      <button onClick={() => setTheme('light')}>Light</button>
      <button onClick={() => setTheme('dark')}>Dark</button>
      <button onClick={() => setTheme('system')}>System</button>
    </div>
  );
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('defaults to system with no data-theme attribute', () => {
    render(
      <ThemeProvider>
        <ThemePicker />
      </ThemeProvider>,
    );
    expect(screen.getByText('Current: system')).toBeInTheDocument();
    expect(document.documentElement).not.toHaveAttribute('data-theme');
  });

  it('sets and persists an explicit theme choice', () => {
    render(
      <ThemeProvider>
        <ThemePicker />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByText('Dark'));

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(localStorage.getItem('cal-tracker:theme')).toBe('dark');

    fireEvent.click(screen.getByText('Light'));
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');

    fireEvent.click(screen.getByText('System'));
    expect(document.documentElement).not.toHaveAttribute('data-theme');
    expect(localStorage.getItem('cal-tracker:theme')).toBe('system');
  });

  it('restores a previously saved theme on mount', () => {
    localStorage.setItem('cal-tracker:theme', 'dark');
    render(
      <ThemeProvider>
        <ThemePicker />
      </ThemeProvider>,
    );
    expect(screen.getByText('Current: dark')).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  });

  it('ignores garbage stored values and falls back to system', () => {
    localStorage.setItem('cal-tracker:theme', 'purple');
    render(
      <ThemeProvider>
        <ThemePicker />
      </ThemeProvider>,
    );
    expect(screen.getByText('Current: system')).toBeInTheDocument();
  });
});
