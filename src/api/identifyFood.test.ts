import { buildRequestFoods, identifyFood, type IdentifyResult } from './identifyFood';
import type { LibraryFood } from '../types';

const mockAuth = vi.hoisted(() => ({
  token: 'test-jwt' as string | null,
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({
        data: {
          session: mockAuth.token ? { access_token: mockAuth.token } : null,
        },
      }),
    },
  },
}));

function libraryFood(overrides: Partial<LibraryFood> = {}): LibraryFood {
  return {
    id: 'food-1',
    name: 'Chicken breast',
    servingLabel: 'serving',
    calories: 165,
    carbs: 0,
    protein: 31,
    fat: 4,
    source: 'manual',
    ...overrides,
  };
}

const REQUEST = {
  image: 'data:image/jpeg;base64,abc',
  foods: [{ id: 'food-1', name: 'Chicken breast', servingLabel: 'serving' }],
};

const RESULT: IdentifyResult = {
  candidates: [{ id: 'food-1', confidence: 0.9 }],
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('buildRequestFoods', () => {
  it('excludes archived foods', () => {
    const foods = [
      libraryFood({ id: 'a' }),
      libraryFood({ id: 'b', name: 'Old food', archivedAt: '2026-01-01T00:00:00Z' }),
    ];

    expect(buildRequestFoods(foods).map((f) => f.id)).toEqual(['a']);
  });

  it('flattens weight equivalences to grams', () => {
    const foods = [
      libraryFood({ id: 'a', servingSize: { amount: 100, unit: 'g' } }),
      libraryFood({ id: 'b', servingLabel: 'scoop', servingSize: { amount: 2, unit: 'oz' } }),
    ];

    const built = buildRequestFoods(foods);
    expect(built[0].servingGrams).toBe(100);
    expect(built[1].servingGrams).toBeCloseTo(56.7, 1);
    expect(built[1].servingLabel).toBe('scoop');
  });

  it('omits servingGrams for volume equivalences and plain servings', () => {
    const foods = [
      libraryFood({ id: 'a', servingSize: { amount: 240, unit: 'ml' } }),
      libraryFood({ id: 'b' }),
    ];

    for (const f of buildRequestFoods(foods)) {
      expect(f.servingGrams).toBeUndefined();
    }
  });

  it('includes descriptions only when present', () => {
    const foods = [
      libraryFood({ id: 'a', description: '15g jelly, 16g pbfit' }),
      libraryFood({ id: 'b' }),
    ];

    const built = buildRequestFoods(foods);
    expect(built[0].description).toBe('15g jelly, 16g pbfit');
    expect('description' in built[1]).toBe(false);
  });
});

describe('identifyFood', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    mockAuth.token = 'test-jwt';
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs the photo, note, and foods with the session JWT and returns the result', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, RESULT));

    const result = await identifyFood({ ...REQUEST, note: 'the bowl is tared' });

    expect(result).toEqual(RESULT);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://test.supabase.co/functions/v1/identify-food');
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer test-jwt');
    expect(JSON.parse(init?.body as string)).toEqual({ ...REQUEST, note: 'the bowl is tared' });
  });

  it('returns a valid amount alongside candidates', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, { ...RESULT, amount: { grams: 142, source: 'scale' } }),
    );

    const result = await identifyFood(REQUEST);

    expect(result.amount).toEqual({ grams: 142, source: 'scale' });
  });

  it('drops candidates whose id was not in the request', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        candidates: [
          { id: 'made-up', confidence: 0.9 },
          { id: 'food-1', confidence: 0.6 },
        ],
      }),
    );

    const result = await identifyFood(REQUEST);

    expect(result.candidates).toEqual([{ id: 'food-1', confidence: 0.6 }]);
  });

  it.each([
    ['no candidates array', {}],
    ['non-numeric confidence', { candidates: [{ id: 'food-1', confidence: 'high' }] }],
    ['negative grams', { ...RESULT, amount: { grams: -5, source: 'scale' } }],
    ['unknown amount source', { ...RESULT, amount: { grams: 10, source: 'guess' } }],
    ['not an object', 'ok'],
  ])('rejects a malformed success response (%s)', async (_name, body) => {
    fetchMock.mockResolvedValue(jsonResponse(200, body));

    await expect(identifyFood(REQUEST)).rejects.toThrow(
      'The identification returned an unusable response.',
    );
  });

  it('throws with the function-provided message on an error status', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(502, { error: 'The identification service returned an error (HTTP 500).' }),
    );

    await expect(identifyFood(REQUEST)).rejects.toThrow(
      'The identification service returned an error (HTTP 500).',
    );
  });

  it('throws a generic message when an error response has no JSON error field', async () => {
    fetchMock.mockResolvedValue(new Response('gateway timeout', { status: 504 }));

    await expect(identifyFood(REQUEST)).rejects.toThrow('Identification failed (HTTP 504)');
  });

  it('rethrows aborts untouched so callers can ignore them', async () => {
    fetchMock.mockRejectedValue(new DOMException('Aborted', 'AbortError'));

    await expect(identifyFood(REQUEST)).rejects.toHaveProperty('name', 'AbortError');
  });

  it('maps other network failures to a readable message', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(identifyFood(REQUEST)).rejects.toThrow(
      'Could not reach the identification service.',
    );
  });

  it('fails without a session before any network call', async () => {
    mockAuth.token = null;

    await expect(identifyFood(REQUEST)).rejects.toThrow(
      'You need to be signed in to identify photos.',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
