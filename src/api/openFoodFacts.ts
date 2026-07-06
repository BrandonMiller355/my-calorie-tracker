import { round1 } from '../lib/totals';
import { DEFAULT_SERVING_LABEL, type FoodSearchResult, type ServingSize } from '../types';

const SEARCH_URL = 'https://world.openfoodfacts.org/cgi/search.pl';
const PAGE_SIZE = 20;
// OFF's search_simple matches loosely across many fields (categories, tags in
// other languages, etc.), so a chunk of what it returns has nothing to do
// with the query. Over-fetch, then filter/rank client-side to a relevant top
// PAGE_SIZE — see rankAndFilter below.
const FETCH_PAGE_SIZE = 50;

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
  serving_quantity?: number | string;
  serving_quantity_unit?: string;
  /** '100g' or '100ml' — what the _100g nutrient fields are actually per */
  nutrition_data_per?: string;
  nutriments?: OffNutriments;
  /** e.g. "en:turkey-and-its-products" — used only for relevance ranking. */
  categories_tags?: string[];
  /** Popularity signal used as a ranking tiebreaker. */
  unique_scans_n?: number;
}

/**
 * ISO 3166-1 alpha-2 region from the browser locale ("en-US" → "us").
 * Products popular in the user's own country rank far better and carry names
 * in their language; the world index buries them under products from
 * everywhere. Undefined when the locale has no region part.
 */
function localeRegion(): string | undefined {
  const lang = typeof navigator !== 'undefined' ? navigator.language : undefined;
  const region = lang?.split('-')[1];
  return region && /^[A-Za-z]{2}$/.test(region) ? region.toLowerCase() : undefined;
}

/** True if `haystack` (a free-text field or an "en:some-tag" facet) mentions `query`. */
function mentions(haystack: string, query: string): boolean {
  return haystack.toLowerCase().replace(/^[a-z]{2,3}:/, '').replace(/-/g, ' ').includes(query);
}

/**
 * OFF's search_simple matches across product name, brand, and tags in every
 * product language, so a "Turkey" search returns plenty of results whose only
 * connection is an unrelated tag or a totally different field. Drop anything
 * that doesn't actually mention the query in a field a user would recognize,
 * then rank name/brand matches above category-only matches, and use scan
 * popularity as a tiebreaker.
 */
function rankAndFilter(products: OffProduct[], query: string): OffProduct[] {
  const q = query.trim().toLowerCase();
  if (!q) return products;

  function score(p: OffProduct): number {
    if (p.product_name && mentions(p.product_name, q)) return 3;
    if (p.brands && mentions(p.brands, q)) return 2;
    if (p.categories_tags?.some((tag) => mentions(tag, q))) return 1;
    return 0;
  }

  return products
    .map((p) => ({ p, s: score(p) }))
    .filter(({ s }) => s > 0)
    .sort((a, b) => b.s - a.s || (b.p.unique_scans_n ?? 0) - (a.p.unique_scans_n ?? 0))
    .map(({ p }) => p);
}

/** Coerce OFF's mixed number/string nutrient values; undefined when absent/invalid. */
function toNum(value: number | string | undefined): number | undefined {
  if (value === undefined || value === '') return undefined;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n >= 0 ? round1(n) : undefined;
}

/**
 * Serving equivalence for a product whose nutrients are per serving. OFF's
 * serving_quantity is in grams by convention when the unit is blank; only
 * g/ml are trusted — anything else degrades to no equivalence rather than
 * risking a wrong conversion.
 */
function servingEquivalence(p: OffProduct): ServingSize | undefined {
  const amount = toNum(p.serving_quantity);
  if (amount === undefined || amount <= 0) return undefined;
  const unit = p.serving_quantity_unit?.trim().toLowerCase() || 'g';
  if (unit !== 'g' && unit !== 'ml') return undefined;
  return { amount, unit };
}

/**
 * Map an OFF product to a search result. Prefers per-serving nutrients
 * (equivalence from serving_quantity when parseable); falls back to per-100g
 * treated as one serving of 100 g — or 100 ml when nutrition_data_per says
 * so. Missing nutrients stay undefined — never 0. Returns null for unusable
 * products (no name).
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
  const servingSize: ServingSize | undefined = hasServingData
    ? servingEquivalence(p)
    : { amount: 100, unit: p.nutrition_data_per?.trim() === '100ml' ? 'ml' : 'g' };

  return {
    id: p.code || `result-${index}`,
    name,
    brand: p.brands?.trim() || undefined,
    servingLabel: DEFAULT_SERVING_LABEL,
    servingSize,
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

async function attemptSearch(
  url: string,
  query: string,
  signal?: AbortSignal,
): Promise<FoodSearchResult[]> {
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
  return rankAndFilter(data.products ?? [], query)
    .map((p, i) => mapProduct(p, i))
    .filter((r): r is FoodSearchResult => r !== null)
    .slice(0, PAGE_SIZE);
}

function buildSearchUrl(query: string, country: string | undefined): string {
  const params = new URLSearchParams({
    search_terms: query,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: String(FETCH_PAGE_SIZE),
    fields:
      'code,product_name,brands,serving_quantity,serving_quantity_unit,nutrition_data_per,nutriments,categories_tags,unique_scans_n',
  });
  if (country) {
    params.set('tagtype_0', 'countries');
    params.set('tag_contains_0', 'contains');
    params.set('tag_0', country);
  }
  return `${SEARCH_URL}?${params}`;
}

async function searchWithRetry(
  url: string,
  query: string,
  signal?: AbortSignal,
): Promise<FoodSearchResult[]> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await attemptSearch(url, query, signal);
    } catch (err) {
      if (!(err instanceof RetryableError) || attempt >= MAX_ATTEMPTS) throw err;
      await sleep(RETRY_DELAY_MS * attempt, signal);
    }
  }
}

export async function searchFoods(
  query: string,
  options: { signal?: AbortSignal } = {},
): Promise<FoodSearchResult[]> {
  // Prefer products sold in the user's country: the world index ranks purely
  // by global popularity, which buries local-language matches under products
  // from everywhere else. Fall back to the whole index when the local search
  // finds nothing (e.g. a foreign product, or a locale without a region).
  const region = localeRegion();
  if (region) {
    const local = await searchWithRetry(buildSearchUrl(query, region), query, options.signal);
    if (local.length > 0) return local;
  }
  return searchWithRetry(buildSearchUrl(query, undefined), query, options.signal);
}
