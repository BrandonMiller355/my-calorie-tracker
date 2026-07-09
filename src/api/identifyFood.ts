import { supabase } from '../lib/supabase';
import { convertAmount, unitDimension } from '../lib/units';
import type { LibraryFood } from '../types';

// Same plain-fetch pattern as analyzeFood: an AbortSignal can cancel a slow
// identification when the overlay closes; the shared Supabase client still
// supplies the session JWT.
const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/identify-food`;

/** One library food the model considers a plausible match, ranked by confidence. */
export interface IdentifyCandidate {
  /** A LibraryFood id from the submitted list */
  id: string;
  /** 0–1; used for ordering, not thresholding */
  confidence: number;
}

/** A weight read or judged from the photo, always in grams. */
export interface IdentifiedAmount {
  grams: number;
  /** "scale": read off a visible scale display; "estimate": judged visually against the food's known serving weight. */
  source: 'scale' | 'estimate';
}

export interface IdentifyResult {
  /** 0 = nothing in the library matches; 1 = confident; 2–3 = torn between these. */
  candidates: IdentifyCandidate[];
  amount?: IdentifiedAmount;
}

/** The subset of a library food the model needs to match against. */
interface RequestFood {
  id: string;
  name: string;
  description?: string;
  servingLabel: string;
  /** Weight of one serving in grams, when the anchor has a weight equivalence */
  servingGrams?: number;
}

export interface IdentifyRequest {
  /** JPEG data URL of the captured photo */
  image: string;
  /** Optional context note from the pre-send review */
  note?: string;
  foods: RequestFood[];
}

/**
 * Flattens the library for the request: archived foods are dropped, and each
 * weight equivalence is converted to grams so the model compares portions in
 * one unit. Volume equivalences don't help judge a photo, so they're omitted.
 */
export function buildRequestFoods(foods: LibraryFood[]): RequestFood[] {
  return foods
    .filter((f) => !f.archivedAt)
    .map((f) => {
      const food: RequestFood = { id: f.id, name: f.name, servingLabel: f.servingLabel };
      if (f.description) food.description = f.description;
      if (f.servingSize && unitDimension(f.servingSize.unit) === 'weight') {
        food.servingGrams = convertAmount(f.servingSize.amount, f.servingSize.unit, 'g');
      }
      return food;
    });
}

// DOMException doesn't extend Error on all runtimes (e.g. Node/jsdom), so
// this can't be `instanceof Error` alone.
function isAbortError(err: unknown): boolean {
  return (
    (err instanceof DOMException || err instanceof Error) && err.name === 'AbortError'
  );
}

/**
 * The function's response shape, revalidated client-side; null when unusable.
 * Ids are re-checked against the submitted foods so the caller can resolve
 * every candidate to a LibraryFood without a missing-lookup path.
 */
function parseResult(data: unknown, knownIds: Set<string>): IdentifyResult | null {
  if (typeof data !== 'object' || data === null) return null;
  const { candidates, amount } = data as Record<string, unknown>;
  if (!Array.isArray(candidates)) return null;

  const parsed: IdentifyCandidate[] = [];
  for (const item of candidates) {
    if (typeof item !== 'object' || item === null) return null;
    const { id, confidence } = item as Record<string, unknown>;
    if (typeof id !== 'string' || typeof confidence !== 'number' || !Number.isFinite(confidence)) {
      return null;
    }
    if (!knownIds.has(id)) continue; // hallucinated id; drop, don't fail
    parsed.push({ id, confidence });
  }

  const result: IdentifyResult = { candidates: parsed.slice(0, 3) };

  if (amount !== undefined) {
    if (typeof amount !== 'object' || amount === null) return null;
    const { grams, source } = amount as Record<string, unknown>;
    if (
      typeof grams !== 'number' ||
      !Number.isFinite(grams) ||
      grams <= 0 ||
      (source !== 'scale' && source !== 'estimate')
    ) {
      return null;
    }
    result.amount = { grams, source };
  }

  return result;
}

/**
 * Ask the identify-food Edge Function which library food is in the photo.
 * Throws a message-bearing Error on any failure; never resolves to a partial
 * result.
 */
export async function identifyFood(
  request: IdentifyRequest,
  options: { signal?: AbortSignal } = {},
): Promise<IdentifyResult> {
  const { signal } = options;
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('You need to be signed in to identify photos.');

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
    throw new Error('Could not reach the identification service.');
  }

  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      typeof body === 'object' && body !== null && typeof (body as { error?: unknown }).error === 'string'
        ? (body as { error: string }).error
        : `Identification failed (HTTP ${res.status})`;
    throw new Error(message);
  }

  const result = parseResult(body, new Set(request.foods.map((f) => f.id)));
  if (!result) throw new Error('The identification returned an unusable response.');
  return result;
}
