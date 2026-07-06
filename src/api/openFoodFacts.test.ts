import { mapProduct, searchFoods, type OffProduct } from './openFoodFacts';

describe('mapProduct', () => {
  it('prefers per-serving nutrients and keeps serving size', () => {
    const p: OffProduct = {
      code: '123',
      product_name: 'Greek Yogurt',
      brands: 'Fage',
      serving_size: '170 g',
      nutriments: {
        'energy-kcal_serving': 90,
        carbohydrates_serving: 5,
        proteins_serving: 17,
        fat_serving: 0,
        'energy-kcal_100g': 53,
      },
    };
    expect(mapProduct(p, 0)).toEqual({
      id: '123',
      name: 'Greek Yogurt',
      brand: 'Fage',
      servingDesc: '170 g',
      calories: 90,
      carbs: 5,
      protein: 17,
      fat: 0,
    });
  });

  it('falls back to per-100g values with a "100 g" serving label', () => {
    const p: OffProduct = {
      code: '456',
      product_name: 'Oats',
      nutriments: {
        'energy-kcal_100g': 379,
        carbohydrates_100g: 67.7,
        proteins_100g: 13.2,
        fat_100g: 6.5,
      },
    };
    const result = mapProduct(p, 0)!;
    expect(result.servingDesc).toBe('100 g');
    expect(result.calories).toBe(379);
  });

  it('leaves missing nutrients undefined, never 0', () => {
    const p: OffProduct = {
      code: '789',
      product_name: 'Mystery Snack',
      nutriments: { 'energy-kcal_100g': 200 },
    };
    const result = mapProduct(p, 0)!;
    expect(result.calories).toBe(200);
    expect(result.carbs).toBeUndefined();
    expect(result.protein).toBeUndefined();
    expect(result.fat).toBeUndefined();
  });

  it('coerces string nutrient values and rejects junk', () => {
    const p: OffProduct = {
      code: '111',
      product_name: 'String Food',
      nutriments: {
        'energy-kcal_100g': '250',
        carbohydrates_100g: 'n/a',
        proteins_100g: -3,
      },
    };
    const result = mapProduct(p, 0)!;
    expect(result.calories).toBe(250);
    expect(result.carbs).toBeUndefined();
    expect(result.protein).toBeUndefined();
  });

  it('returns null for products without a name', () => {
    expect(mapProduct({ code: '999' }, 0)).toBeNull();
    expect(mapProduct({ product_name: '  ' }, 0)).toBeNull();
  });
});

describe('searchFoods', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('queries OFF, maps products, and drops unusable ones', async () => {
    const products: OffProduct[] = [
      { code: '1', product_name: 'Apple', nutriments: { 'energy-kcal_100g': 52 } },
      { code: '2' }, // no name -> dropped
    ];
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ products }), { status: 200 }),
    );

    const results = await searchFoods('apple');
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Apple');

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('search_terms=apple');
    expect(url).toContain('page_size=20');
  });

  it('throws immediately on non-retryable HTTP errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('oops', { status: 400 }));
    await expect(searchFoods('apple')).rejects.toThrow('HTTP 400');
  });

  it('retries transient 5xx errors and succeeds once OFF recovers', async () => {
    vi.useFakeTimers();
    const products: OffProduct[] = [
      { code: '1', product_name: 'Apple', nutriments: { 'energy-kcal_100g': 52 } },
    ];
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('unavailable', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ products }), { status: 200 }));

    const promise = searchFoods('apple');
    await vi.runAllTimersAsync();
    const results = await promise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(results[0].name).toBe('Apple');
    vi.useRealTimers();
  });

  it('retries a network failure ("Failed to fetch") and gives up after max attempts', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new TypeError('Failed to fetch'));

    const promise = searchFoods('apple');
    // Prevent an unhandled-rejection warning while timers are advanced below.
    promise.catch(() => {});
    await vi.runAllTimersAsync();
    await expect(promise).rejects.toThrow('Failed to fetch');

    expect(fetchMock).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it('does not retry once the request is aborted', async () => {
    const controller = new AbortController();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      const err = new DOMException('Aborted', 'AbortError');
      return Promise.reject(err);
    });

    controller.abort();
    await expect(searchFoods('apple', { signal: controller.signal })).rejects.toThrow('Aborted');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
