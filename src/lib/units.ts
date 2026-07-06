import type { MeasureUnit, ServingAnchor, VolumeUnit, WeightUnit } from '../types';

export const WEIGHT_UNITS: readonly WeightUnit[] = ['g', 'oz', 'lb', 'kg'];
export const VOLUME_UNITS: readonly VolumeUnit[] = ['ml', 'floz', 'cup', 'tbsp', 'tsp'];
export const MEASURE_UNITS: readonly MeasureUnit[] = [...WEIGHT_UNITS, ...VOLUME_UNITS];

export const UNIT_LABELS: Record<MeasureUnit, string> = {
  g: 'g',
  oz: 'oz',
  lb: 'lb',
  kg: 'kg',
  ml: 'ml',
  floz: 'fl oz',
  cup: 'cup',
  tbsp: 'tbsp',
  tsp: 'tsp',
};

export type Dimension = 'weight' | 'volume';

/** Factor to the dimension's base unit: grams for weight, milliliters for volume. */
const TO_BASE: Record<MeasureUnit, number> = {
  g: 1,
  oz: 28.3495,
  lb: 453.592,
  kg: 1000,
  ml: 1,
  floz: 29.5735,
  cup: 236.588,
  tbsp: 14.7868,
  tsp: 4.92892,
};

export function isMeasureUnit(unit: string): unit is MeasureUnit {
  return (MEASURE_UNITS as readonly string[]).includes(unit);
}

export function unitDimension(unit: MeasureUnit): Dimension {
  return (WEIGHT_UNITS as readonly string[]).includes(unit) ? 'weight' : 'volume';
}

/** Convert between units of the same dimension. Never converts across dimensions. */
export function convertAmount(amount: number, from: MeasureUnit, to: MeasureUnit): number {
  if (unitDimension(from) !== unitDimension(to)) {
    throw new Error(`Cannot convert ${from} to ${to}: different dimensions`);
  }
  return (amount * TO_BASE[from]) / TO_BASE[to];
}

/**
 * Units the user may log this food in: always the count label, plus every
 * unit of the equivalence's dimension when an equivalence exists.
 */
export function availableUnits(anchor: ServingAnchor): string[] {
  if (!anchor.servingSize) return [anchor.servingLabel];
  const dimension = unitDimension(anchor.servingSize.unit);
  const units = dimension === 'weight' ? WEIGHT_UNITS : VOLUME_UNITS;
  return [anchor.servingLabel, ...units];
}

/**
 * Servings multiplier for a logged amount+unit. Counts pass through; measure
 * amounts are the ratio to the anchor's equivalence via the base unit. Only
 * call with a unit from availableUnits(anchor).
 */
export function deriveQuantity(amount: number, unit: string, anchor: ServingAnchor): number {
  if (unit === anchor.servingLabel || !isMeasureUnit(unit)) return amount;
  const size = anchor.servingSize;
  if (!size) {
    throw new Error(`Food has no equivalence; cannot log in ${unit}`);
  }
  return (amount * TO_BASE[unit]) / (size.amount * TO_BASE[size.unit]);
}

/** Human-readable unit for display, e.g. "floz" → "fl oz"; labels pass through. */
export function unitLabel(unit: string): string {
  return isMeasureUnit(unit) ? UNIT_LABELS[unit] : unit;
}
