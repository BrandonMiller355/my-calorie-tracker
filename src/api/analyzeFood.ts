import { supabase } from '../lib/supabase';
import { round1 } from '../lib/totals';
import { DEFAULT_SERVING_LABEL, type FoodSearchResult } from '../types';

// The Edge Function is called with plain fetch (not functions.invoke) so an
// AbortSignal can cancel a slow analysis when the overlay closes; the shared
// Supabase client still supplies the session JWT.
const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-food`;

/** One AI guess for a photographed dish; nutrition is for the whole visible portion. */
export interface FoodEstimate {
  name: string;
  calories: number;
  fat: number;
  carbs: number;
  protein: number;
  /** The model's most uncertain assumption, e.g. "assumed ~1 cup of rice". */
  confidenceNote: string;
}

export interface AnalyzeRequest {
  /** JPEG data URL of the captured photo */
  image: string;
  /** User corrections so far, oldest first; resent in full each turn */
  corrections: string[];
}

// DOMException doesn't extend Error on all runtimes (e.g. Node/jsdom), so
// this can't be `instanceof Error` alone.
function isAbortError(err: unknown): boolean {
  return (
    (err instanceof DOMException || err instanceof Error) && err.name === 'AbortError'
  );
}

/** The function's response shape, revalidated client-side; null when unusable. */
function parseEstimate(data: unknown): FoodEstimate | null {
  if (typeof data !== 'object' || data === null) return null;
  const { name, calories, fat, carbs, protein, confidenceNote } = data as Record<string, unknown>;
  if (typeof name !== 'string' || name.trim() === '') return null;
  if (typeof confidenceNote !== 'string') return null;
  for (const n of [calories, fat, carbs, protein]) {
    if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return null;
  }
  return {
    name,
    calories: calories as number,
    fat: fat as number,
    carbs: carbs as number,
    protein: protein as number,
    confidenceNote,
  };
}

/**
 * Ask the analyze-food Edge Function for an estimate. Every call carries the
 * photo plus all corrections so far — the function is stateless. Throws a
 * message-bearing Error on any failure; never resolves to a partial estimate.
 */
export async function analyzeFood(
  request: AnalyzeRequest,
  options: { signal?: AbortSignal } = {},
): Promise<FoodEstimate> {
  const { signal } = options;
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('You need to be signed in to analyze photos.');

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
    throw new Error('Could not reach the analysis service.');
  }

  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      typeof body === 'object' && body !== null && typeof (body as { error?: unknown }).error === 'string'
        ? (body as { error: string }).error
        : `Analysis failed (HTTP ${res.status})`;
    throw new Error(message);
  }

  const estimate = parseEstimate(body);
  if (!estimate) throw new Error('The analysis returned an unusable response.');
  return estimate;
}

/**
 * An accepted estimate enters the app as a search result: one "serving" is
 * the photographed portion, with no weight equivalence (the model can't
 * reliably know weights). Nutrients are always numbers, so the form's
 * missing-value flagging never triggers for AI results.
 */
export function mapEstimateToResult(estimate: FoodEstimate): FoodSearchResult {
  return {
    id: crypto.randomUUID(),
    name: estimate.name.trim(),
    servingLabel: DEFAULT_SERVING_LABEL,
    calories: round1(estimate.calories),
    fat: round1(estimate.fat),
    carbs: round1(estimate.carbs),
    protein: round1(estimate.protein),
  };
}
