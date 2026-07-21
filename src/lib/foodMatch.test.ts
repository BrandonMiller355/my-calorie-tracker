import { findFoodByName, matchFoods, normalizeFoodName } from './foodMatch';
import type { LibraryFood } from '../types';

function food(id: string, name: string, description?: string): LibraryFood {
  return {
    id,
    name,
    description,
    servingLabel: 'serving',
    calories: 100,
    carbs: 10,
    protein: 5,
    fat: 3,
    source: 'manual',
  };
}

describe('normalizeFoodName', () => {
  it('trims and lowercases', () => {
    expect(normalizeFoodName('  PB&J ')).toBe('pb&j');
  });
});

describe('findFoodByName', () => {
  it('matches on the normalized name', () => {
    const target = food('1', 'PB&J');
    expect(findFoodByName([food('2', 'Oatmeal'), target], ' pb&j ')).toBe(target);
  });

  it('returns undefined when nothing matches', () => {
    expect(findFoodByName([food('1', 'Oatmeal')], 'toast')).toBeUndefined();
  });
});

describe('matchFoods', () => {
  const library = [
    food('1', 'Chicken breast', 'grilled, no skin'),
    food('2', 'Chickpea salad'),
    food('3', 'Grilled cheese'),
    food('4', 'PB&J', '15g jelly, 16g pbfit, 2 sara lee slices'),
    food('5', 'Salad chicken wrap'),
  ];

  it('is case-insensitive and matches anywhere in the name', () => {
    expect(matchFoods(library, 'CHEESE').map((f) => f.id)).toEqual(['3']);
  });

  it('matches on description text', () => {
    expect(matchFoods(library, 'pbfit').map((f) => f.id)).toEqual(['4']);
  });

  it('ranks prefix over word boundary over substring', () => {
    // 'chick': prefix of "Chicken breast"/"Chickpea salad", word start in "Salad chicken wrap"
    expect(matchFoods(library, 'chick').map((f) => f.id)).toEqual(['1', '2', '5']);
    // 'rill': substring-only matches rank last and alphabetically
    expect(matchFoods(library, 'grilled').map((f) => f.id)).toEqual(['3', '1']);
  });

  it('returns nothing for a blank query', () => {
    expect(matchFoods(library, '   ')).toEqual([]);
  });

  it('returns every match, not a capped subset', () => {
    const many = Array.from({ length: 10 }, (_, i) => food(String(i), `Apple ${i}`));
    expect(matchFoods(many, 'apple')).toHaveLength(10);
  });

  it('matches out-of-order, comma-separated name words', () => {
    const cheddar = food('c', 'Cheese, Cheddar, Fat Free, Shred', 'Kraft Natural Cheese');
    expect(matchFoods([...library, cheddar], 'fat free cheese').map((f) => f.id)).toEqual(['c']);
  });

  it('ranks a name match above a description-only match', () => {
    const nameMatch = food('n', 'Kraft cheese slices');
    const descMatch = food('d', 'Cheddar block', 'Kraft brand');
    expect(matchFoods([descMatch, nameMatch], 'kraft').map((f) => f.id)).toEqual(['n', 'd']);
  });

  it('requires every token to match, missing one excludes the food', () => {
    expect(matchFoods(library, 'grilled tofu')).toEqual([]);
  });

  it('puts the most recently used food first within a rank', () => {
    // Alphabetical order is Chicken breast, Chickpea salad; recency flips it
    const lastUsed = { '2': '2026-07-19', '1': '2026-07-10' };
    expect(matchFoods(library, 'chick', lastUsed).map((f) => f.id)).toEqual(['2', '1', '5']);
  });

  it('never lets recency outrank match quality', () => {
    // "Chicken breast" matches 'grilled' only via its description; even used
    // yesterday it stays below the name match
    const lastUsed = { '1': '2026-07-19' };
    expect(matchFoods(library, 'grilled', lastUsed).map((f) => f.id)).toEqual(['3', '1']);
  });

  it('sorts never-used foods after used ones, alphabetically', () => {
    const lastUsed = { '2': '2026-07-19' };
    expect(matchFoods(library, 'chick', lastUsed).map((f) => f.id)).toEqual(['2', '1', '5']);
  });
});
