import { render, screen } from '@testing-library/react';
import { WeeklyDeficit } from './WeeklyDeficit';

describe('WeeklyDeficit', () => {
  it('shows the deficit-to-date without a goal comparison when no goal is set', () => {
    render(<WeeklyDeficit deficit={800} goal={null} hasMissingDays={false} />);
    expect(screen.getByText(/800/)).toBeInTheDocument();
    expect(screen.queryByText(/goal/i)).toBeNull();
  });

  it('shows remaining progress toward the goal when under it', () => {
    render(<WeeklyDeficit deficit={1500} goal={3500} hasMissingDays={false} />);
    expect(screen.getByText(/2000 kcal to go to hit your 3500 kcal goal/)).toBeInTheDocument();
  });

  it('shows the goal as met, plus extra, once reached', () => {
    render(<WeeklyDeficit deficit={4000} goal={3500} hasMissingDays={false} />);
    expect(screen.getByText(/Goal met \(3500 kcal\) — 500 kcal extra/)).toBeInTheDocument();
  });

  it('shows the missing-log disclaimer only when there are missing days', () => {
    const { rerender } = render(<WeeklyDeficit deficit={800} goal={null} hasMissingDays={false} />);
    expect(screen.queryByText(/missing log entries/)).toBeNull();

    rerender(<WeeklyDeficit deficit={800} goal={null} hasMissingDays={true} />);
    expect(screen.getByText(/missing log entries/)).toBeInTheDocument();
  });
});
