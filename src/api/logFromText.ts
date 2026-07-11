import { supabase } from '../lib/supabase';
import { round1 } from '../lib/totals';
import { availableUnits } from '../lib/units';
import {
  DEFAULT_SERVING_LABEL,
  MEALS,
  type LibraryFood,
  type Meal,
  type ServingAnchor,
} from '../types';
import { buildRequestFoods, type IdentifyRequest } from './identifyFood';

// Same plain-fetch pattern as identifyFood: an AbortSignal can cancel a slow
// parse when the overlay closes; the shared Supabase client still supplies
// the session JWT.
const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/log-from-text`;

/** A described food resolved to a saved library food. */
export interface TextLogMatchItem {
  kind: 'match';
  /** A LibraryFood id from the submitted list */
  foodId: string;
  /** Count of the food's serving label, when the text counted servings */
  servings?: number;
  /** Weight in grams, when the text stated one */
  grams?: number;
  /** Only present when the description stated a meal */
  meal?: Meal;
}

/** A described food the library doesn't contain; nutrition is for the described portion. */
export interface TextLogEstimateItem {
  kind: 'estimate';
  name: string;
  calories: number;
  fat: number;
  carbs: number;
  protein: number;
  /** The model's most uncertain assumption, e.g. "assumed 2 tbsp of peanut butter". */
  confidenceNote: string;
  /** Only present when the description stated a meal */
  meal?: Meal;
}

export type TextLogItem = TextLogMatchItem | TextLogEstimateItem;

export interface LogFromTextRequest {
  /** The user's free-text description of what they ate */
  text: string;
  /** The meal currently selected in the dialog; context only */
  meal: Meal;
  foods: IdentifyRequest['foods'];
}

// DOMException doesn't extend Error on all runtimes (e.g. Node/jsdom), so
// this can't be `instanceof Error` alone.
function isAbortError(err: unknown): boolean {
  return (
    (err instanceof DOMException || err instanceof Error) && err.name === 'AbortError'
  );
}

function parseMeal(raw: unknown): Meal | undefined {
  return typeof raw === 'string' && (MEALS as readonly string[]).includes(raw)
    ? (raw as Meal)
    : undefined;
}

function positiveOrUndefined(raw: unknown): number | undefined {
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : undefined;
}

/**
 * The function's response shape, revalidated client-side; null when unusable.
 * Match ids are re-checked against the submitted foods (dropping strays, as
 * the server does) so every surviving match resolves to a LibraryFood.
 */
function parseItems(data: unknown, knownIds: Set<string>): TextLogItem[] | null {
  if (typeof data !== 'object' || data === null) return null;
  const { items } = data as Record<string, unknown>;
  if (!Array.isArray(items)) return null;

  const parsed: TextLogItem[] = [];
  for (const item of items) {
    if (typeof item !== 'object' || item === null) return null;
    const record = item as Record<string, unknown>;

    if (record.kind === 'match') {
      if (typeof record.foodId !== 'string') return null;
      if (!knownIds.has(record.foodId)) continue; // stray id; drop, don't fail
      parsed.push({
        kind: 'match',
        foodId: record.foodId,
        servings: positiveOrUndefined(record.servings),
        grams: positiveOrUndefined(record.grams),
        meal: parseMeal(record.meal),
      });
      continue;
    }

    if (record.kind === 'estimate') {
      const { name, calories, fat, carbs, protein, confidenceNote } = record;
      if (typeof name !== 'string' || name.trim() === '') return null;
      for (const n of [calories, fat, carbs, protein]) {
        if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return null;
      }
      parsed.push({
        kind: 'estimate',
        name,
        calories: calories as number,
        fat: fat as number,
        carbs: carbs as number,
        protein: protein as number,
        confidenceNote: typeof confidenceNote === 'string' ? confidenceNote : '',
        meal: parseMeal(record.meal),
      });
      continue;
    }

    return null;
  }
  return parsed;
}

/**
 * Ask the log-from-text Edge Function to parse a meal description. Throws a
 * message-bearing Error on any failure — including a description the model
 * couldn't understand — and never resolves to an empty item list.
 */
export async function logFromText(
  request: LogFromTextRequest,
  options: { signal?: AbortSignal } = {},
): Promise<TextLogItem[]> {
  const { signal } = options;
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('You need to be signed in to log from text.');

  let res: Response;
  try {
    res = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      signal,
    });
  } catch (err) {
    if (isAbortError(err)) throw err;
    throw new Error('Could not reach the logging service.');
  }

  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      typeof body === 'object' && body !== null && typeof (body as { error?: unknown }).error === 'string'
        ? (body as { error: string }).error
        : `Logging failed (HTTP ${res.status})`;
    throw new Error(message);
  }

  const items = parseItems(body, new Set(request.foods.map((f) => f.id)));
  // The function reports an incomprehensible description as an error, so an
  // empty list here is a broken response, not a valid "nothing found".
  if (!items || items.length === 0) {
    throw new Error('The logging service returned an unusable response.');
  }
  return items;
}

export { buildRequestFoods };

/**
 * A parsed item resolved against the local library and dialog context:
 * everything the review list needs to display, edit, and save one entry.
 * Nutrition is per one serving of `anchor`, like the entry form's fields.
 */
export interface ResolvedTextLogItem {
  /** Client-generated key for list rendering and removal */
  key: string;
  name: string;
  /** The matched food's description, for the secondary display line */
  description?: string;
  anchor: ServingAnchor;
  calories: number;
  fat: number;
  carbs: number;
  protein: number;
  amount: number;
  /** A unit from availableUnits(anchor) */
  unit: string;
  meal: Meal;
  /** Present for matches; links the created entry to the library food */
  foodId?: string;
  /** Matches log like a combobox pick, estimates like an accepted AI estimate */
  source: 'manual' | 'search';
  /** The model's most uncertain assumption, for estimate items */
  confidenceNote?: string;
}

/**
 * Resolves parsed items for review: matches join back to their library food
 * (dropping any that no longer resolve), amounts follow the same rule as the
 * identify flow — grams only when the food's anchor can convert them, else
 * 1 serving — and an unstated meal falls back to the dialog's meal.
 */
export function resolveTextLogItems(
  items: TextLogItem[],
  foods: LibraryFood[],
  fallbackMeal: Meal,
): ResolvedTextLogItem[] {
  const resolved: ResolvedTextLogItem[] = [];
  for (const item of items) {
    if (item.kind === 'match') {
      const food = foods.find((f) => f.id === item.foodId);
      if (!food) continue; // parseItems guarantees this; belt-and-braces
      const anchor: ServingAnchor = {
        servingLabel: food.servingLabel,
        servingSize: food.servingSize,
      };
      let amount = item.servings ?? 1;
      let unit = food.servingLabel;
      if (item.servings === undefined && item.grams !== undefined && availableUnits(anchor).includes('g')) {
        amount = round1(item.grams);
        unit = 'g';
      }
      resolved.push({
        key: crypto.randomUUID(),
        name: food.name,
        description: food.description,
        anchor,
        calories: food.calories,
        fat: food.fat,
        carbs: food.carbs,
        protein: food.protein,
        amount,
        unit,
        meal: item.meal ?? fallbackMeal,
        foodId: food.id,
        source: 'manual',
      });
    } else {
      resolved.push({
        key: crypto.randomUUID(),
        name: item.name.trim(),
        anchor: { servingLabel: DEFAULT_SERVING_LABEL },
        calories: round1(item.calories),
        fat: round1(item.fat),
        carbs: round1(item.carbs),
        protein: round1(item.protein),
        amount: 1,
        unit: DEFAULT_SERVING_LABEL,
        meal: item.meal ?? fallbackMeal,
        source: 'search',
        confidenceNote: item.confidenceNote || undefined,
      });
    }
  }
  return resolved;
}
