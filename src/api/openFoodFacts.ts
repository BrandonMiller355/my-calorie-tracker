import type { FoodSearchResult } from '../types';

const SEARCH_URL = 'https://world.openfoodfacts.org/cgi/search.pl';
const PAGE_SIZE = 20;

export interface OffNutriments {
  'energy-kcal_serving'?: number | string;
  carbohydrates_serving?: number | string;
  proteins_serving?: number | string;
  fat_serving?: number | string;
  'energy-kcal_100g'?: number | string;
  carbohydrates_100g?: number | string;
  proteins_100g?: number | string;
  fat_100g?: number | string;
}

export interface OffProduct {
  code?: string;
  product_name?: string;
  brands?: string;
  serving_size?: string;
  nutriments?: OffNutriments;
}

/** Coerce OFF's mixed number/string nutrient values; undefined when absent/invalid. */
function toNum(value: number | string | undefined): number | undefined {
  if (value === undefined || value === '') return undefined;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/**
 * Map an OFF product to a search result. Prefers per-serving nutrients;
 * falls back to per-100g. Missing nutrients stay undefined — never 0.
 * Returns null for unusable products (no name).
 */
export function mapProduct(p: OffProduct, index: number): FoodSearchResult | null {
  const name = p.product_name?.trim();
  if (!name) return null;

  const n = p.nutriments ?? {};
  const perServing = {
    calories: toNum(n['energy-kcal_serving']),
    carbs: toNum(n.carbohydrates_serving),
    protein: toNum(n.proteins_serving),
    fat: toNum(n.fat_serving),
  };
  const hasServingData = Object.values(perServing).some((v) => v !== undefined);

  const nutrients = hasServingData
    ? perServing
    : {
        calories: toNum(n['energy-kcal_100g']),
        carbs: toNum(n.carbohydrates_100g),
        protein: toNum(n.proteins_100g),
        fat: toNum(n.fat_100g),
      };
  const servingDesc = hasServingData ? p.serving_size?.trim() || '1 serving' : '100 g';

  return {
    id: p.code || `result-${index}`,
    name,
    brand: p.brands?.trim() || undefined,
    servingDesc,
    ...nutrients,
  };
}

// OFF intermittently 503s (and error responses sometimes omit CORS headers,
// which surfaces to callers as a generic "Failed to fetch" network error
// rather than a visible status). Retrying a couple of times clears most of these.
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 300;

class RetryableError extends Error {}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}

async function attemptSearch(url: string, signal?: AbortSignal): Promise<FoodSearchResult[]> {
  let res: Response;
  try {
    res = await fetch(url, { signal });
  } catch (err) {
    if (isAbortError(err)) throw err;
    throw new RetryableError(err instanceof Error ? err.message : 'Network error');
  }

  if (!res.ok) {
    const message = `Food search failed (HTTP ${res.status})`;
    if (res.status === 429 || res.status >= 500) throw new RetryableError(message);
    throw new Error(message);
  }

  const data: { products?: OffProduct[] } = await res.json();
  return (data.products ?? [])
    .map((p, i) => mapProduct(p, i))
    .filter((r): r is FoodSearchResult => r !== null)
    .slice(0, PAGE_SIZE);
}

export async function searchFoods(
  query: string,
  options: { signal?: AbortSignal } = {},
): Promise<FoodSearchResult[]> {
  const params = new URLSearchParams({
    search_terms: query,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: String(PAGE_SIZE),
    fields: 'code,product_name,brands,serving_size,nutriments',
  });
  const url = `${SEARCH_URL}?${params}`;

  for (let attempt = 1; ; attempt++) {
    try {
      return await attemptSearch(url, options.signal);
    } catch (err) {
      if (!(err instanceof RetryableError) || attempt >= MAX_ATTEMPTS) throw err;
      await sleep(RETRY_DELAY_MS * attempt, options.signal);
    }
  }
}
