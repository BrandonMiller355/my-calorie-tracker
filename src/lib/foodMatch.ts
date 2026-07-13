import type { LibraryFood } from '../types';

/** The library dedup key: matches the DB unique index on lower(trim(name)). */
export function normalizeFoodName(name: string): string {
  return name.trim().toLowerCase();
}

export function findFoodByName(foods: LibraryFood[], name: string): LibraryFood | undefined {
  const normalized = normalizeFoodName(name);
  return foods.find((f) => normalizeFoodName(f.name) === normalized);
}

function tokenize(query: string): string[] {
  return query.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

/** Best rank across all tokens in one haystack: 0 = every token is a word-boundary match, 1 = some token only matches mid-word. Null if any token is missing. */
function fieldRank(haystack: string, tokens: string[]): number | null {
  let worst = 0;
  for (const token of tokens) {
    const index = haystack.indexOf(token);
    if (index === -1) return null;
    const isBoundary = index === 0 || !/[a-z0-9]/.test(haystack[index - 1]);
    worst = Math.max(worst, isBoundary ? 0 : 1);
  }
  return worst;
}

/**
 * Lower rank sorts first. Every query token must appear somewhere (in any
 * order) in the name or description for a food to match at all. Matches
 * found entirely within the name (rank 0-1) always outrank matches that
 * need the description to cover some token (rank 2-3).
 */
function rank(food: LibraryFood, tokens: string[]): number | null {
  const nameOnly = fieldRank(food.name.toLowerCase(), tokens);
  if (nameOnly !== null) return nameOnly;
  const combined = `${food.name} ${food.description ?? ''}`.toLowerCase();
  const combinedRank = fieldRank(combined, tokens);
  return combinedRank === null ? null : combinedRank + 2;
}

/**
 * Case-insensitive, token-based match over name + description of the
 * in-memory library. Query words can appear in any order and don't need to
 * be contiguous, so "fat free cheese" matches "Cheese, Cheddar, Fat Free,
 * Shred". Name matches are ranked above description-only matches, ties
 * broken alphabetically.
 */
export function matchFoods(foods: LibraryFood[], query: string): LibraryFood[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];
  return foods
    .flatMap((food) => {
      const r = rank(food, tokens);
      return r === null ? [] : [{ food, r }];
    })
    .sort((a, b) => a.r - b.r || a.food.name.localeCompare(b.food.name))
    .map(({ food }) => food);
}
