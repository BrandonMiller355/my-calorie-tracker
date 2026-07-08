import type { WeekDeficitDay } from '../types';

export interface WeeklyDeficitResult {
  /** Sum of (effective calorie-burn goal - consumed) across `weekSummary`, excluding `today` */
  deficit: number;
  /** true when an elapsed day in range has zero logged entries */
  hasMissingDays: boolean;
}

/**
 * Reduces a week's per-day breakdown (that week's Monday through the
 * selected date, inclusive) into the running deficit total and whether any
 * elapsed day is missing entries. `today` is passed in rather than read from
 * the clock so this stays pure and testable: the selected date's own
 * emptiness is only excused when it equals `today`, since a past selected
 * date has already fully elapsed. `today` itself is excluded from the
 * deficit sum entirely, since its consumed total is necessarily partial
 * until the day is over and would otherwise skew the running deficit.
 */
export function computeWeeklyDeficit(
  weekSummary: WeekDeficitDay[],
  selectedDate: string,
  today: string,
): WeeklyDeficitResult {
  const deficit =
    Math.round(
      weekSummary.reduce(
        (sum, day) =>
          day.date === today ? sum : sum + (day.effectiveGoalCalories - day.consumedCalories),
        0,
      ) * 10,
    ) / 10;
  const hasMissingDays = weekSummary.some(
    (day) => !day.hasEntries && !(day.date === selectedDate && selectedDate === today),
  );
  return { deficit, hasMissingDays };
}
