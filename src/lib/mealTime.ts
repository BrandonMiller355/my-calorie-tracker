import type { Meal } from '../types';

/**
 * Which meal "now" falls in, for defaulting the log form and deciding which
 * meal sections start expanded: breakfast until 10:30, lunch until 15:00,
 * dinner until 20:30, snacks after.
 */
export function currentMeal(now: Date = new Date()): Meal {
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (minutes < 10 * 60 + 30) return 'breakfast';
  if (minutes < 15 * 60) return 'lunch';
  if (minutes < 20 * 60 + 30) return 'dinner';
  return 'snacks';
}
