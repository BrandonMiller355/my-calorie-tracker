import type { LibraryFood } from '../types';

/** The library dedup key: matches the DB unique index on lower(trim(name)). */
export function normalizeFoodName(name: string): string {
  return name.trim().toLowerCase();
}

export function findFoodByName(foods: LibraryFood[], name: string): LibraryFood | undefined {
  const normalized = normalizeFoodName(name);
  return foods.find((f) => normalizeFoodName(f.name) === normalized);
}

/** Lower rank sorts first: name/description prefix, then word start, then anywhere. */
function rank(food: LibraryFood, query: string): number | null {
  const haystack = `${food.name} ${food.description ?? ''}`.toLowerCase();
  const index = haystack.indexOf(query);
  if (index === -1) return null;
  if (index === 0) return 0;
  if (!/[a-z0-9]/.test(haystack[index - 1])) return 1;
  return 2;
}

/**
 * Case-insensitive match over name + description of the in-memory library,
 * ranked prefix > word boundary > substring, ties broken alphabetically.
 */
export function matchFoods(foods: LibraryFood[], query: string, limit = 8): LibraryFood[] {
  const q = query.trim().toLowerCase();
  if (q === '') return [];
  return foods
    .flatMap((food) => {
      const r = rank(food, q);
      return r === null ? [] : [{ food, r }];
    })
    .sort((a, b) => a.r - b.r || a.food.name.localeCompare(b.food.name))
    .slice(0, limit)
    .map(({ food }) => food);
}
