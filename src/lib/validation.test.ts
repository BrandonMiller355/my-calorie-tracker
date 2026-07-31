import type { LibraryFood, ServingAnchor } from '../types';
import {
  validateEntryForm,
  validateMealForm,
  validateServingAnchor,
  type EntryFormValues,
  type MealComponentFormValue,
  type ServingAnchorFormValues,
} from './validation';

const plainAnchor: ServingAnchor = { servingLabel: 'serving' };
const weightAnchor: ServingAnchor = {
  servingLabel: 'serving',
  servingSize: { amount: 100, unit: 'g' },
};

function values(overrides: Partial<EntryFormValues> = {}): EntryFormValues {
  return {
    name: 'Banana',
    amount: '1',
    unit: 'serving',
    calories: '105',
    carbs: '27',
    protein: '1.3',
    fat: '0.4',
    ...overrides,
  };
}

describe('validateEntryForm', () => {
  it('accepts valid values and parses numbers', () => {
    const result = validateEntryForm(values(), plainAnchor);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.parsed).toEqual({
        name: 'Banana',
        amount: 1,
        unit: 'serving',
        calories: 105,
        carbs: 27,
        protein: 1.3,
        fat: 0.4,
      });
    }
  });

  it('accepts a measure unit offered by the anchor', () => {
    const result = validateEntryForm(values({ amount: '45', unit: 'g' }), weightAnchor);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.parsed).toMatchObject({ amount: 45, unit: 'g' });
  });

  it('rejects a unit the anchor does not offer', () => {
    const noEquivalence = validateEntryForm(values({ unit: 'g' }), plainAnchor);
    expect(noEquivalence.ok).toBe(false);
    if (!noEquivalence.ok) expect(noEquivalence.errors.unit).toBeTruthy();

    const wrongDimension = validateEntryForm(values({ unit: 'ml' }), weightAnchor);
    expect(wrongDimension.ok).toBe(false);
  });

  it('accepts zero for nutrients', () => {
    expect(validateEntryForm(values({ fat: '0' }), plainAnchor).ok).toBe(true);
  });

  it('rejects negative values', () => {
    const result = validateEntryForm(values({ calories: '-5' }), plainAnchor);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.calories).toBeTruthy();
  });

  it('rejects non-numeric values', () => {
    const result = validateEntryForm(values({ carbs: '12abc', protein: 'lots' }), plainAnchor);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.carbs).toBeTruthy();
      expect(result.errors.protein).toBeTruthy();
    }
  });

  it('defaults blank carbs/protein/fat to 0', () => {
    const result = validateEntryForm(values({ carbs: '', protein: '', fat: '' }), plainAnchor);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.parsed).toMatchObject({ carbs: 0, protein: 0, fat: 0 });
    }
  });

  it('rejects a blank calories field', () => {
    const result = validateEntryForm(values({ calories: '' }), plainAnchor);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.calories).toBeTruthy();
  });

  it('rejects empty name and non-positive amount', () => {
    const noName = validateEntryForm(values({ name: '  ' }), plainAnchor);
    expect(noName.ok).toBe(false);

    const zeroAmount = validateEntryForm(values({ amount: '0' }), plainAnchor);
    expect(zeroAmount.ok).toBe(false);
    if (!zeroAmount.ok) expect(zeroAmount.errors.amount).toBeTruthy();
  });
});

function anchorValues(overrides: Partial<ServingAnchorFormValues> = {}): ServingAnchorFormValues {
  return { servingLabel: '', servingSizeAmount: '', servingSizeUnit: '', ...overrides };
}

describe('validateServingAnchor', () => {
  it('defaults a blank label to "serving" with no equivalence', () => {
    const result = validateServingAnchor(anchorValues());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.parsed).toEqual({ servingLabel: 'serving', servingSize: undefined });
    }
  });

  it('parses a custom label with a weight equivalence', () => {
    const result = validateServingAnchor(
      anchorValues({ servingLabel: 'can (drained)', servingSizeAmount: '120', servingSizeUnit: 'g' }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.parsed).toEqual({
        servingLabel: 'can (drained)',
        servingSize: { amount: 120, unit: 'g' },
      });
    }
  });

  it('rejects measure unit names as labels', () => {
    for (const label of ['g', 'cup', 'floz']) {
      const result = validateServingAnchor(anchorValues({ servingLabel: label }));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.servingLabel).toBeTruthy();
    }
  });

  it('rejects a half-defined equivalence', () => {
    const noUnit = validateServingAnchor(anchorValues({ servingSizeAmount: '120' }));
    expect(noUnit.ok).toBe(false);
    if (!noUnit.ok) expect(noUnit.errors.servingSizeUnit).toBeTruthy();

    const noAmount = validateServingAnchor(anchorValues({ servingSizeUnit: 'g' }));
    expect(noAmount.ok).toBe(false);
    if (!noAmount.ok) expect(noAmount.errors.servingSizeAmount).toBeTruthy();
  });

  it('rejects a non-positive equivalence amount', () => {
    const zero = validateServingAnchor(
      anchorValues({ servingSizeAmount: '0', servingSizeUnit: 'g' }),
    );
    expect(zero.ok).toBe(false);
    if (!zero.ok) expect(zero.errors.servingSizeAmount).toBeTruthy();
  });
});

describe('validateMealForm', () => {
  const beans: LibraryFood = {
    id: 'beans',
    name: 'Beans',
    servingLabel: 'can',
    servingSize: { amount: 400, unit: 'g' },
    calories: 320,
    carbs: 40,
    protein: 20,
    fat: 2,
    source: 'manual',
  };
  const lettuce: LibraryFood = {
    id: 'lettuce',
    name: 'Lettuce',
    servingLabel: 'cup',
    calories: 5,
    carbs: 1,
    protein: 0,
    fat: 0,
    source: 'manual',
  };

  function component(overrides: Partial<MealComponentFormValue> = {}): MealComponentFormValue {
    return { food: beans, amount: '1', unit: 'can', ...overrides };
  }

  it('parses a valid meal into foodId/amount/unit items', () => {
    const result = validateMealForm({
      name: '  Taco salad ',
      components: [component(), component({ food: lettuce, amount: '2', unit: 'cup' })],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.parsed).toEqual({
        name: 'Taco salad',
        items: [
          { foodId: 'beans', amount: 1, unit: 'can' },
          { foodId: 'lettuce', amount: 2, unit: 'cup' },
        ],
      });
    }
  });

  it('requires a name', () => {
    const result = validateMealForm({ name: '  ', components: [component()] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.name).toBeTruthy();
  });

  it('requires at least one component', () => {
    const result = validateMealForm({ name: 'Empty', components: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.components).toBeTruthy();
  });

  it('rejects a component with a non-positive amount', () => {
    const result = validateMealForm({ name: 'Taco', components: [component({ amount: '0' })] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.componentErrors?.[0]?.amount).toBeTruthy();
  });

  it('rejects a component whose unit the food anchor does not offer', () => {
    // Lettuce is count-only, so "g" is not a valid unit for it
    const result = validateMealForm({
      name: 'Taco',
      components: [component({ food: lettuce, unit: 'g' })],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.componentErrors?.[0]?.unit).toBeTruthy();
  });
});
