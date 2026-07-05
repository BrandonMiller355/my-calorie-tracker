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

  const res = await fetch(`${SEARCH_URL}?${params}`, { signal: options.signal });
  if (!res.ok) throw new Error(`Food search failed (HTTP ${res.status})`);

  const data: { products?: OffProduct[] } = await res.json();
  return (data.products ?? [])
    .map((p, i) => mapProduct(p, i))
    .filter((r): r is FoodSearchResult => r !== null)
    .slice(0, PAGE_SIZE);
}
