import { computeWeeklyDeficit } from './weeklyDeficit';
import type { WeekDeficitDay } from '../types';

function day(overrides: Partial<WeekDeficitDay>): WeekDeficitDay {
  return {
    date: '2026-07-06',
    consumedCalories: 0,
    effectiveGoalCalories: 2000,
    hasEntries: true,
    ...overrides,
  };
}

describe('computeWeeklyDeficit', () => {
  it('sums (goal - consumed) across the week so far', () => {
    const week = [
      day({ date: '2026-07-06', effectiveGoalCalories: 2000, consumedCalories: 1800 }),
      day({ date: '2026-07-07', effectiveGoalCalories: 2200, consumedCalories: 2500 }),
      day({ date: '2026-07-08', effectiveGoalCalories: 1900, consumedCalories: 1600 }),
    ];
    const result = computeWeeklyDeficit(week, '2026-07-08', '2026-07-08');
    // (2000-1800) + (2200-2500) + (1900-1600) = 200 - 300 + 300 = 200
    expect(result.deficit).toBe(200);
  });

  it('rounds the deficit to one decimal place', () => {
    const week = [day({ effectiveGoalCalories: 2000.05, consumedCalories: 1800.02 })];
    const result = computeWeeklyDeficit(week, '2026-07-06', '2026-07-06');
    expect(result.deficit).toBe(200.0);
  });

  it('handles the Monday-only case (single day in range)', () => {
    const week = [day({ date: '2026-07-06', effectiveGoalCalories: 2000, consumedCalories: 1200 })];
    const result = computeWeeklyDeficit(week, '2026-07-06', '2026-07-06');
    expect(result.deficit).toBe(800);
    expect(result.hasMissingDays).toBe(false);
  });

  it('flags a past day in range with zero entries', () => {
    const week = [
      day({ date: '2026-07-06', hasEntries: false }),
      day({ date: '2026-07-07', hasEntries: true }),
    ];
    const result = computeWeeklyDeficit(week, '2026-07-07', '2026-07-07');
    expect(result.hasMissingDays).toBe(true);
  });

  it('does not flag today for having zero entries so far', () => {
    const week = [day({ date: '2026-07-06', hasEntries: false })];
    const result = computeWeeklyDeficit(week, '2026-07-06', '2026-07-06');
    expect(result.hasMissingDays).toBe(false);
  });

  it('flags a fully-elapsed selected date (not today) with zero entries', () => {
    const week = [day({ date: '2026-07-06', hasEntries: false })];
    const result = computeWeeklyDeficit(week, '2026-07-06', '2026-07-08');
    expect(result.hasMissingDays).toBe(true);
  });
});
