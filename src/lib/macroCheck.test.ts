import { checkMacroCalories } from './macroCheck';

describe('checkMacroCalories', () => {
  it('returns null when macros roughly add up to the entered calories', () => {
    // 54*4 + 10*4 + 5*9 = 301, close to 300
    expect(checkMacroCalories(300, 54, 10, 5)).toBeNull();
  });

  it('returns null when all macros are zero (nothing to check)', () => {
    expect(checkMacroCalories(200, 0, 0, 0)).toBeNull();
  });

  it('flags a mismatch when calories are far higher than the macros imply', () => {
    // 5*4 + 1*4 + 1*9 = 33, nowhere near 400
    const result = checkMacroCalories(400, 5, 1, 1);
    expect(result).toEqual({ expected: 33, entered: 400 });
  });

  it('flags a mismatch when calories are far lower than the macros imply', () => {
    // 50*4 + 30*4 + 20*9 = 500, nowhere near 50
    const result = checkMacroCalories(50, 50, 30, 20);
    expect(result).toEqual({ expected: 500, entered: 50 });
  });

  it('allows generous rounding slack for small entries', () => {
    // 1*4 + 0*4 + 0*9 = 4, entered 10 — within the 50 kcal floor
    expect(checkMacroCalories(10, 1, 0, 0)).toBeNull();
  });
});
