import type { LibraryFood, MeasureUnit, ServingAnchor, VolumeUnit, WeightUnit } from '../types';

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

/** Every unit of the equivalence's dimension, or none for a count-only food. */
export function measureUnitsFor(anchor: ServingAnchor): readonly MeasureUnit[] {
  if (!anchor.servingSize) return [];
  return unitDimension(anchor.servingSize.unit) === 'weight' ? WEIGHT_UNITS : VOLUME_UNITS;
}

/**
 * Units the user may log this food in: always the count label, plus every
 * unit of the equivalence's dimension when an equivalence exists.
 */
export function availableUnits(anchor: ServingAnchor): string[] {
  return [anchor.servingLabel, ...measureUnitsFor(anchor)];
}

/**
 * A default logging unit as it applies under `anchor`: the unit when the
 * anchor offers it, else undefined — the count label. A stored default goes
 * stale when the equivalence is removed or switched to the other dimension,
 * and then quietly falls back to counting rather than failing.
 */
export function resolveDefaultUnit(
  unit: string | undefined,
  anchor: ServingAnchor,
): MeasureUnit | undefined {
  return measureUnitsFor(anchor).find((u) => u === unit);
}

export interface Portion {
  amount: number;
  /** A unit from availableUnits of the food's anchor */
  unit: string;
}

/**
 * Where logging a food starts when the amount isn't known yet: 1 of its count
 * label, or — for a food that defaults to a weight or volume unit — what one
 * count equals, in that unit (118 g for "1 banana = 118 g"). Rounded to 2dp so
 * a converted amount stays readable in the field.
 */
export function defaultPortion(
  food: Pick<LibraryFood, 'servingLabel' | 'servingSize' | 'defaultUnit'>,
): Portion {
  const unit = resolveDefaultUnit(food.defaultUnit, food);
  if (unit === undefined || !food.servingSize) return { amount: 1, unit: food.servingLabel };
  const { amount, unit: from } = food.servingSize;
  return { amount: Math.round(convertAmount(amount, from, unit) * 100) / 100, unit };
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
