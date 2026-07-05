import { validateEntryForm, type EntryFormValues } from './validation';

function values(overrides: Partial<EntryFormValues> = {}): EntryFormValues {
  return {
    name: 'Banana',
    quantity: '1',
    calories: '105',
    carbs: '27',
    protein: '1.3',
    fat: '0.4',
    ...overrides,
  };
}

describe('validateEntryForm', () => {
  it('accepts valid values and parses numbers', () => {
    const result = validateEntryForm(values());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.parsed).toEqual({
        name: 'Banana',
        quantity: 1,
        calories: 105,
        carbs: 27,
        protein: 1.3,
        fat: 0.4,
      });
    }
  });

  it('accepts zero for nutrients', () => {
    expect(validateEntryForm(values({ fat: '0' })).ok).toBe(true);
  });

  it('rejects negative values', () => {
    const result = validateEntryForm(values({ calories: '-5' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.calories).toBeTruthy();
  });

  it('rejects non-numeric values', () => {
    const result = validateEntryForm(values({ carbs: '12abc', protein: 'lots' }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.carbs).toBeTruthy();
      expect(result.errors.protein).toBeTruthy();
    }
  });

  it('defaults blank carbs/protein/fat to 0', () => {
    const result = validateEntryForm(values({ carbs: '', protein: '', fat: '' }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.parsed).toMatchObject({ carbs: 0, protein: 0, fat: 0 });
    }
  });

  it('rejects a blank calories field', () => {
    const result = validateEntryForm(values({ calories: '' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.calories).toBeTruthy();
  });

  it('rejects empty name and non-positive quantity', () => {
    const noName = validateEntryForm(values({ name: '  ' }));
    expect(noName.ok).toBe(false);

    const zeroQty = validateEntryForm(values({ quantity: '0' }));
    expect(zeroQty.ok).toBe(false);
  });
});
