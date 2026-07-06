import type { ServingAnchor } from '../types';
import {
  availableUnits,
  convertAmount,
  deriveQuantity,
  isMeasureUnit,
  unitDimension,
  unitLabel,
} from './units';

const countOnly: ServingAnchor = { servingLabel: 'bowl' };
const perServing100g: ServingAnchor = {
  servingLabel: 'serving',
  servingSize: { amount: 100, unit: 'g' },
};
const canDrained: ServingAnchor = {
  servingLabel: 'can (drained)',
  servingSize: { amount: 120, unit: 'g' },
};
const volumeAnchor: ServingAnchor = {
  servingLabel: 'serving',
  servingSize: { amount: 240, unit: 'ml' },
};

describe('convertAmount', () => {
  it('converts within weight', () => {
    expect(convertAmount(1, 'oz', 'g')).toBeCloseTo(28.3495, 4);
    expect(convertAmount(1, 'lb', 'oz')).toBeCloseTo(16, 2);
    expect(convertAmount(1000, 'g', 'kg')).toBe(1);
  });

  it('converts within volume', () => {
    expect(convertAmount(1, 'cup', 'ml')).toBeCloseTo(236.588, 3);
    expect(convertAmount(1, 'tbsp', 'tsp')).toBeCloseTo(3, 2);
  });

  it('never converts across dimensions', () => {
    expect(() => convertAmount(1, 'g', 'ml')).toThrow();
    expect(() => convertAmount(1, 'cup', 'oz')).toThrow();
  });
});

describe('availableUnits', () => {
  it('offers only the label for count-only foods', () => {
    expect(availableUnits(countOnly)).toEqual(['bowl']);
  });

  it('offers the label plus weight units for weight anchors, never volume', () => {
    const units = availableUnits(canDrained);
    expect(units).toEqual(['can (drained)', 'g', 'oz', 'lb', 'kg']);
    expect(units).not.toContain('ml');
    expect(units).not.toContain('cup');
  });

  it('offers the label plus volume units for volume anchors, never weight', () => {
    const units = availableUnits(volumeAnchor);
    expect(units).toEqual(['serving', 'ml', 'floz', 'cup', 'tbsp', 'tsp']);
    expect(units).not.toContain('g');
  });
});

describe('deriveQuantity', () => {
  it('passes counts through as the multiplier', () => {
    expect(deriveQuantity(2, 'can (drained)', canDrained)).toBe(2);
    expect(deriveQuantity(1.5, 'bowl', countOnly)).toBe(1.5);
  });

  it('derives 0.45 for 45 g of a 100 g serving', () => {
    expect(deriveQuantity(45, 'g', perServing100g)).toBeCloseTo(0.45, 10);
  });

  it('derives 1 for 1 oz of a 28.3495 g serving', () => {
    const anchor: ServingAnchor = {
      servingLabel: 'serving',
      servingSize: { amount: 28.3495, unit: 'g' },
    };
    expect(deriveQuantity(1, 'oz', anchor)).toBeCloseTo(1, 10);
  });

  it('converts through the base unit across the dimension', () => {
    // 1 cup = 16 tbsp, so 2 tbsp per serving → 8 servings
    const anchor: ServingAnchor = {
      servingLabel: 'serving',
      servingSize: { amount: 2, unit: 'tbsp' },
    };
    expect(deriveQuantity(1, 'cup', anchor)).toBeCloseTo(8, 2);
  });

  it('throws for a measure unit when the food has no equivalence', () => {
    expect(() => deriveQuantity(45, 'g', countOnly)).toThrow();
  });
});

describe('unit helpers', () => {
  it('classifies dimensions', () => {
    expect(unitDimension('kg')).toBe('weight');
    expect(unitDimension('tsp')).toBe('volume');
  });

  it('recognizes measure units vs labels', () => {
    expect(isMeasureUnit('g')).toBe(true);
    expect(isMeasureUnit('can (drained)')).toBe(false);
  });

  it('renders display labels', () => {
    expect(unitLabel('floz')).toBe('fl oz');
    expect(unitLabel('can (drained)')).toBe('can (drained)');
  });
});
