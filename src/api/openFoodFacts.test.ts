import { getProductByBarcode, mapProduct, searchFoods, type OffProduct } from './openFoodFacts';

describe('mapProduct', () => {
  it('prefers per-serving nutrients and derives a weight equivalence', () => {
    const p: OffProduct = {
      code: '123',
      product_name: 'Greek Yogurt',
      brands: 'Fage',
      serving_quantity: 170,
      serving_quantity_unit: 'g',
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
      servingLabel: 'serving',
      servingSize: { amount: 170, unit: 'g' },
      calories: 90,
      carbs: 5,
      protein: 17,
      fat: 0,
    });
  });

  it('treats a blank serving_quantity_unit as grams and coerces string quantities', () => {
    const p: OffProduct = {
      code: '124',
      product_name: 'Granola',
      serving_quantity: '55',
      nutriments: { 'energy-kcal_serving': 260 },
    };
    expect(mapProduct(p, 0)!.servingSize).toEqual({ amount: 55, unit: 'g' });
  });

  it('falls back to per-100g values anchored at 1 serving = 100 g', () => {
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
    expect(result.servingLabel).toBe('serving');
    expect(result.servingSize).toEqual({ amount: 100, unit: 'g' });
    expect(result.calories).toBe(379);
  });

  it('anchors the per-100g fallback at 100 ml when nutrition_data_per is 100ml', () => {
    const p: OffProduct = {
      code: '457',
      product_name: 'Oat Milk',
      nutrition_data_per: '100ml',
      nutriments: { 'energy-kcal_100g': 46 },
    };
    expect(mapProduct(p, 0)!.servingSize).toEqual({ amount: 100, unit: 'ml' });
  });

  it.each([
    ['missing quantity', {}],
    ['zero quantity', { serving_quantity: 0 }],
    ['junk quantity', { serving_quantity: 'about a cup' }],
    ['odd unit', { serving_quantity: 2, serving_quantity_unit: 'unit' }],
  ])('degrades per-serving results with %s to a count-only anchor', (_name, servingFields) => {
    const p: OffProduct = {
      code: '458',
      product_name: 'Mystery Bar',
      ...servingFields,
      nutriments: { 'energy-kcal_serving': 190 },
    };
    const result = mapProduct(p, 0)!;
    expect(result.servingLabel).toBe('serving');
    expect(result.servingSize).toBeUndefined();
    expect(result.calories).toBe(190);
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

  it('rounds ugly floating-point nutrient values to 1 decimal place', () => {
    const p: OffProduct = {
      code: '222',
      product_name: 'Maxi pavo finas lonchas',
      nutriments: { 'energy-kcal_100g': 53.2982791586997 },
    };
    expect(mapProduct(p, 0)!.calories).toBe(53.3);
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

  function stubLanguage(lang: string) {
    vi.spyOn(window.navigator, 'language', 'get').mockReturnValue(lang);
  }

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
  });

  it('filters by the locale country so local products rank first', async () => {
    stubLanguage('en-US');
    const products: OffProduct[] = [
      { code: '1', product_name: 'Turkey Breast', nutriments: { 'energy-kcal_100g': 100 } },
    ];
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ products }), { status: 200 }),
    );

    const results = await searchFoods('turkey');
    expect(results.map((r) => r.name)).toEqual(['Turkey Breast']);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('tagtype_0=countries');
    expect(url).toContain('tag_0=us');
  });

  it('falls back to the world index when the local search finds nothing', async () => {
    stubLanguage('en-US');
    const localJunk: OffProduct[] = [
      { code: '1', product_name: 'Croissant' }, // no mention of the query -> filtered out
    ];
    const worldMatch: OffProduct[] = [
      { code: '2', product_name: 'Vegemite', nutriments: { 'energy-kcal_100g': 189 } },
    ];
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ products: localJunk }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ products: worldMatch }), { status: 200 }),
      );

    const results = await searchFoods('vegemite');
    expect(results.map((r) => r.name)).toEqual(['Vegemite']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain('tag_0=us');
    expect(String(fetchMock.mock.calls[1][0])).not.toContain('tag_0');
  });

  it('skips the country filter when the locale has no region', async () => {
    stubLanguage('en');
    const products: OffProduct[] = [
      { code: '1', product_name: 'Apple', nutriments: { 'energy-kcal_100g': 52 } },
    ];
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ products }), { status: 200 }),
    );

    await searchFoods('apple');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('tagtype_0');
  });

  it('drops results that only match on unrelated fields, keeping real matches', async () => {
    const products: OffProduct[] = [
      { code: '1', product_name: 'Turkey Breast', nutriments: { 'energy-kcal_100g': 100 } },
      // No mention of "turkey" anywhere OFF's loose search still returned this.
      { code: '2', product_name: 'Dubai Chocolate', nutriments: { 'energy-kcal_100g': 500 } },
      // Only matches via an unrelated tag, e.g. countries sold in — still junk.
      { code: '3', product_name: 'Gherkins', categories_tags: ['en:pickles'] },
    ];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ products }), { status: 200 }),
    );

    const results = await searchFoods('turkey');
    expect(results.map((r) => r.name)).toEqual(['Turkey Breast']);
  });

  it('ranks name matches above category-only matches, using popularity as a tiebreaker', async () => {
    const products: OffProduct[] = [
      {
        code: '1',
        product_name: 'Cordon bleu de dinde',
        categories_tags: ['en:turkey-and-its-products'],
        unique_scans_n: 500,
      },
      { code: '2', product_name: 'Turkey Sausage', unique_scans_n: 1 },
      { code: '3', product_name: 'Turkey Breast', unique_scans_n: 50 },
    ];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ products }), { status: 200 }),
    );

    const results = await searchFoods('turkey');
    expect(results.map((r) => r.name)).toEqual(['Turkey Breast', 'Turkey Sausage', 'Cordon bleu de dinde']);
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

describe('getProductByBarcode', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const yogurt: OffProduct = {
    code: '0123456789012',
    product_name: 'Greek Yogurt',
    nutriments: { 'energy-kcal_100g': 53 },
  };

  function foundResponse(product: OffProduct): Response {
    return new Response(JSON.stringify({ status: 1, product }), { status: 200 });
  }

  function notFoundResponse(): Response {
    return new Response(JSON.stringify({ status: 0, status_verbose: 'product not found' }), {
      status: 404,
    });
  }

  it('returns the mapped product for a known barcode', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(foundResponse(yogurt));

    const result = await getProductByBarcode('4056489098478');
    expect(result?.name).toBe('Greek Yogurt');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/v2/product/4056489098478');
  });

  it('returns null for an unknown 13-digit barcode without a zero-pad retry', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(notFoundResponse());

    await expect(getProductByBarcode('4056489098478')).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries a missed 12-digit UPC-A code with the zero-padded form', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(notFoundResponse())
      .mockResolvedValueOnce(foundResponse(yogurt));

    const result = await getProductByBarcode('123456789012');
    expect(result?.name).toBe('Greek Yogurt');
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/v2/product/123456789012');
    expect(String(fetchMock.mock.calls[1][0])).toContain('/api/v2/product/0123456789012');
  });

  it('returns null when both the raw and zero-padded forms miss', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(notFoundResponse());

    await expect(getProductByBarcode('123456789012')).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('treats a status-0 body on a 200 response as not found', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 0 }), { status: 200 }),
    );

    await expect(getProductByBarcode('4056489098478')).resolves.toBeNull();
  });

  it('retries transient 5xx errors and succeeds once OFF recovers', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('unavailable', { status: 503 }))
      .mockResolvedValueOnce(foundResponse(yogurt));

    const promise = getProductByBarcode('4056489098478');
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result?.name).toBe('Greek Yogurt');
    vi.useRealTimers();
  });

  it('throws once retries are exhausted', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new TypeError('Failed to fetch'));

    const promise = getProductByBarcode('4056489098478');
    promise.catch(() => {});
    await vi.runAllTimersAsync();
    await expect(promise).rejects.toThrow('Failed to fetch');

    expect(fetchMock).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it('does not retry once the request is aborted', async () => {
    const controller = new AbortController();
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new DOMException('Aborted', 'AbortError'));

    controller.abort();
    await expect(
      getProductByBarcode('4056489098478', { signal: controller.signal }),
    ).rejects.toThrow('Aborted');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
