import type { FoodEntry } from '../types';
import { entryTotals, sumTotals, ZERO_TOTALS } from './totals';

function entry(overrides: Partial<FoodEntry> = {}): FoodEntry {
  return {
    id: '1',
    date: '2026-07-04',
    meal: 'lunch',
    name: 'Test food',
    amount: overrides.quantity ?? 1,
    unit: 'serving',
    servingLabel: 'serving',
    quantity: 1,
    calories: 100,
    carbs: 10,
    protein: 5,
    fat: 2,
    source: 'manual',
    ...overrides,
  };
}

describe('entryTotals', () => {
  it('returns per-serving values at quantity 1', () => {
    expect(entryTotals(entry())).toEqual({ calories: 100, carbs: 10, protein: 5, fat: 2 });
  });

  it('scales by quantity, including fractions', () => {
    expect(entryTotals(entry({ quantity: 2 }))).toEqual({
      calories: 200,
      carbs: 20,
      protein: 10,
      fat: 4,
    });
    expect(entryTotals(entry({ quantity: 0.5 }))).toEqual({
      calories: 50,
      carbs: 5,
      protein: 2.5,
      fat: 1,
    });
  });

  it('rounds to one decimal place', () => {
    expect(entryTotals(entry({ calories: 33.33, quantity: 3 })).calories).toBe(100);
  });
});

describe('sumTotals', () => {
  it('returns zeros for an empty day', () => {
    expect(sumTotals([])).toEqual(ZERO_TOTALS);
  });

  it('sums scaled entries across meals', () => {
    const total = sumTotals([
      entry({ meal: 'breakfast', calories: 300, carbs: 40, protein: 12, fat: 8 }),
      entry({ meal: 'lunch', calories: 550, carbs: 60, protein: 30, fat: 20, quantity: 1 }),
      entry({ meal: 'snacks', calories: 100, carbs: 15, protein: 2, fat: 4, quantity: 2 }),
    ]);
    expect(total).toEqual({ calories: 1050, carbs: 130, protein: 46, fat: 36 });
  });
});
