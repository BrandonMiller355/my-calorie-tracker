import { resolveMeal } from './meal';
import type { LibraryFood, SavedMeal } from '../types';

function food(overrides: Partial<LibraryFood> & Pick<LibraryFood, 'id'>): LibraryFood {
  return {
    name: overrides.id,
    servingLabel: 'serving',
    calories: 100,
    carbs: 10,
    protein: 5,
    fat: 2,
    source: 'manual',
    ...overrides,
  };
}

const beans = food({ id: 'beans', name: 'Beans', servingLabel: 'can', servingSize: { amount: 400, unit: 'g' }, calories: 320 });
const turkey = food({ id: 'turkey', name: 'Turkey', servingLabel: 'serving', servingSize: { amount: 100, unit: 'g' }, calories: 200, protein: 27 });
const lettuce = food({ id: 'lettuce', name: 'Lettuce', servingLabel: 'cup', calories: 5 });

const meal: SavedMeal = {
  id: 'm1',
  name: 'Taco salad',
  items: [
    { foodId: 'beans', amount: 0.5, unit: 'can' },
    { foodId: 'turkey', amount: 100, unit: 'g' },
    { foodId: 'lettuce', amount: 1, unit: 'cup' },
  ],
};

describe('resolveMeal', () => {
  it('resolves each component and sums live totals', () => {
    const { resolved, unavailable, totals } = resolveMeal(meal, [beans, turkey, lettuce]);
    expect(unavailable).toEqual([]);
    expect(resolved).toHaveLength(3);
    // 0.5 can beans (160) + 100g turkey (200) + 1 cup lettuce (5)
    expect(totals.calories).toBe(365);
    expect(totals.protein).toBe(27 + 5 * 0.5 + 5); // turkey 27 + beans 5*0.5 + lettuce 5
  });

  it('derives quantity from a measure unit against the food anchor', () => {
    const { resolved } = resolveMeal(meal, [beans, turkey, lettuce]);
    const beansRow = resolved.find((r) => r.food.id === 'beans');
    expect(beansRow?.quantity).toBe(0.5);
    expect(beansRow?.calories).toBe(160);
  });

  it('reflects a later edit to a component food', () => {
    const cheaperTurkey = { ...turkey, calories: 100 };
    const { totals } = resolveMeal(meal, [beans, cheaperTurkey, lettuce]);
    expect(totals.calories).toBe(160 + 100 + 5);
  });

  it('marks a component unavailable when its food is missing', () => {
    const { resolved, unavailable, totals } = resolveMeal(meal, [beans, lettuce]);
    expect(unavailable).toEqual([{ foodId: 'turkey', amount: 100, unit: 'g' }]);
    expect(resolved).toHaveLength(2);
    expect(totals.calories).toBe(165);
  });

  it('marks a component unavailable when the anchor no longer offers its unit', () => {
    // Beans lost its weight equivalence, so a "g" portion is no longer loggable
    const countOnlyBeans = { ...beans, servingSize: undefined };
    const { unavailable, resolved } = resolveMeal(
      { ...meal, items: [{ foodId: 'beans', amount: 50, unit: 'g' }] },
      [countOnlyBeans],
    );
    expect(unavailable).toHaveLength(1);
    expect(resolved).toHaveLength(0);
  });

  it('returns empty resolved when every component is unavailable', () => {
    const { resolved, unavailable, totals } = resolveMeal(meal, []);
    expect(resolved).toEqual([]);
    expect(unavailable).toHaveLength(3);
    expect(totals).toEqual({ calories: 0, carbs: 0, protein: 0, fat: 0 });
  });
});
