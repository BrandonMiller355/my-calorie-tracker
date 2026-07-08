import { analyzeFood, mapEstimateToResult, type FoodEstimate } from './analyzeFood';

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

const ESTIMATE: FoodEstimate = {
  name: 'Chicken and rice',
  calories: 550,
  fat: 12,
  carbs: 60,
  protein: 45,
  confidenceNote: 'Assumed about 1 cup of rice.',
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('analyzeFood', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    mockAuth.token = 'test-jwt';
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs the photo and corrections with the session JWT and returns the estimate', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, ESTIMATE));

    const result = await analyzeFood({
      image: 'data:image/jpeg;base64,abc',
      corrections: ['there is rice under it too'],
    });

    expect(result).toEqual(ESTIMATE);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://test.supabase.co/functions/v1/analyze-food');
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer test-jwt');
    expect(JSON.parse(init?.body as string)).toEqual({
      image: 'data:image/jpeg;base64,abc',
      corrections: ['there is rice under it too'],
    });
  });

  it('throws with the function-provided message on an error status', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(502, { error: 'The analysis service returned an error (HTTP 500).' }),
    );

    await expect(analyzeFood({ image: 'data:image/jpeg;base64,abc', corrections: [] })).rejects.toThrow(
      'The analysis service returned an error (HTTP 500).',
    );
  });

  it('throws a generic message when an error response has no JSON error field', async () => {
    fetchMock.mockResolvedValue(new Response('gateway timeout', { status: 504 }));

    await expect(analyzeFood({ image: 'data:image/jpeg;base64,abc', corrections: [] })).rejects.toThrow(
      'Analysis failed (HTTP 504)',
    );
  });

  it.each([
    ['missing nutrient', { ...ESTIMATE, calories: undefined }],
    ['non-numeric nutrient', { ...ESTIMATE, protein: 'lots' }],
    ['negative nutrient', { ...ESTIMATE, fat: -1 }],
    ['blank name', { ...ESTIMATE, name: ' ' }],
    ['not an object', 'ok'],
  ])('rejects a malformed success response (%s)', async (_name, body) => {
    fetchMock.mockResolvedValue(jsonResponse(200, body));

    await expect(analyzeFood({ image: 'data:image/jpeg;base64,abc', corrections: [] })).rejects.toThrow(
      'The analysis returned an unusable response.',
    );
  });

  it('rethrows aborts untouched so callers can ignore them', async () => {
    fetchMock.mockRejectedValue(new DOMException('Aborted', 'AbortError'));

    await expect(
      analyzeFood({ image: 'data:image/jpeg;base64,abc', corrections: [] }),
    ).rejects.toHaveProperty('name', 'AbortError');
  });

  it('maps other network failures to a readable message', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(analyzeFood({ image: 'data:image/jpeg;base64,abc', corrections: [] })).rejects.toThrow(
      'Could not reach the analysis service.',
    );
  });

  it('fails without a session before any network call', async () => {
    mockAuth.token = null;

    await expect(analyzeFood({ image: 'data:image/jpeg;base64,abc', corrections: [] })).rejects.toThrow(
      'You need to be signed in to analyze photos.',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('mapEstimateToResult', () => {
  it('maps an estimate to a one-serving search result with rounded numbers', () => {
    const result = mapEstimateToResult({
      ...ESTIMATE,
      name: '  Chicken and rice  ',
      calories: 550.34,
    });

    expect(result).toMatchObject({
      name: 'Chicken and rice',
      servingLabel: 'serving',
      calories: 550.3,
      fat: 12,
      carbs: 60,
      protein: 45,
    });
    expect(result.servingSize).toBeUndefined();
    expect(result.id).not.toBe(mapEstimateToResult(ESTIMATE).id);
  });
});
