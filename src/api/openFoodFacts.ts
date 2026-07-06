import { round1 } from '../lib/totals';
import { DEFAULT_SERVING_LABEL, type FoodSearchResult, type ServingSize } from '../types';

const SEARCH_URL = 'https://world.openfoodfacts.org/cgi/search.pl';
const PRODUCT_URL = 'https://world.openfoodfacts.org/api/v2/product';
const FIELDS =
  'code,product_name,brands,serving_quantity,serving_quantity_unit,nutrition_data_per,nutriments,categories_tags,unique_scans_n';
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

/** Fetch that surfaces network failures as retryable; HTTP status handling stays with the caller. */
async function fetchOff(url: string, signal?: AbortSignal): Promise<Response> {
  try {
    return await fetch(url, { signal });
  } catch (err) {
    if (isAbortError(err)) throw err;
    throw new RetryableError(err instanceof Error ? err.message : 'Network error');
  }
}

function throwForStatus(res: Response, label: string): never {
  const message = `${label} failed (HTTP ${res.status})`;
  if (res.status === 429 || res.status >= 500) throw new RetryableError(message);
  throw new Error(message);
}

async function attemptSearch(
  url: string,
  query: string,
  signal?: AbortSignal,
): Promise<FoodSearchResult[]> {
  const res = await fetchOff(url, signal);
  if (!res.ok) throwForStatus(res, 'Food search');

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
    fields: FIELDS,
  });
  if (country) {
    params.set('tagtype_0', 'countries');
    params.set('tag_contains_0', 'contains');
    params.set('tag_0', country);
  }
  return `${SEARCH_URL}?${params}`;
}

async function withRetry<T>(attempt: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  for (let n = 1; ; n++) {
    try {
      return await attempt();
    } catch (err) {
      if (!(err instanceof RetryableError) || n >= MAX_ATTEMPTS) throw err;
      await sleep(RETRY_DELAY_MS * n, signal);
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
  const { signal } = options;
  const region = localeRegion();
  if (region) {
    const local = await withRetry(() => attemptSearch(buildSearchUrl(query, region), query, signal), signal);
    if (local.length > 0) return local;
  }
  return withRetry(() => attemptSearch(buildSearchUrl(query, undefined), query, signal), signal);
}

async function attemptProductLookup(
  code: string,
  signal?: AbortSignal,
): Promise<FoodSearchResult | null> {
  const url = `${PRODUCT_URL}/${encodeURIComponent(code)}?${new URLSearchParams({ fields: FIELDS })}`;
  const res = await fetchOff(url, signal);
  // OFF answers an unknown barcode with a 404 (carrying a status:0 body).
  if (res.status === 404) return null;
  if (!res.ok) throwForStatus(res, 'Barcode lookup');

  const data: { status?: number; product?: OffProduct } = await res.json();
  if (data.status !== 1 || !data.product) return null;
  return mapProduct(data.product, 0);
}

/**
 * Look up a scanned barcode. Resolves to null when OFF has no such product —
 * distinct from a thrown error, which means the lookup itself failed. Some US
 * products are stored under the zero-padded 13-digit EAN form, so a miss on a
 * 12-digit UPC-A code is retried once with a leading zero.
 */
export async function getProductByBarcode(
  code: string,
  options: { signal?: AbortSignal } = {},
): Promise<FoodSearchResult | null> {
  const { signal } = options;
  const trimmed = code.trim();
  const direct = await withRetry(() => attemptProductLookup(trimmed, signal), signal);
  if (direct) return direct;
  if (/^\d{12}$/.test(trimmed)) {
    return withRetry(() => attemptProductLookup(`0${trimmed}`, signal), signal);
  }
  return null;
}
