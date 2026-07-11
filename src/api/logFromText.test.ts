import {
  logFromText,
  resolveTextLogItems,
  type LogFromTextRequest,
  type TextLogItem,
} from './logFromText';
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
    name: 'Sara Lee bread',
    servingLabel: 'slice',
    calories: 70,
    carbs: 13,
    protein: 3,
    fat: 1,
    source: 'manual',
    ...overrides,
  };
}

const REQUEST: LogFromTextRequest = {
  text: '2 slices of sara lee bread',
  meal: 'breakfast',
  foods: [{ id: 'food-1', name: 'Sara Lee bread', servingLabel: 'slice' }],
};

const MATCH: TextLogItem = { kind: 'match', foodId: 'food-1', servings: 2 };

const ESTIMATE: TextLogItem = {
  kind: 'estimate',
  name: 'Peanut butter toast',
  calories: 250,
  fat: 12,
  carbs: 28,
  protein: 9,
  confidenceNote: 'assumed 1 tbsp of peanut butter',
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('logFromText', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    mockAuth.token = 'test-jwt';
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs the text, meal, and foods with the session JWT and returns the items', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { items: [MATCH, ESTIMATE] }));

    const items = await logFromText(REQUEST);

    expect(items).toEqual([MATCH, ESTIMATE]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://test.supabase.co/functions/v1/log-from-text');
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer test-jwt');
    expect(JSON.parse(init?.body as string)).toEqual(REQUEST);
  });

  it('drops match items whose id was not in the request', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, { items: [{ kind: 'match', foodId: 'made-up' }, MATCH] }),
    );

    const items = await logFromText(REQUEST);

    expect(items).toEqual([MATCH]);
  });

  it('drops invalid amounts and meals but keeps the match', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        items: [{ kind: 'match', foodId: 'food-1', servings: -2, grams: 'lots', meal: 'brunch' }],
      }),
    );

    const items = await logFromText(REQUEST);

    expect(items).toEqual([{ kind: 'match', foodId: 'food-1' }]);
  });

  it.each([
    ['no items array', {}],
    ['unknown item kind', { items: [{ kind: 'guess' }] }],
    ['estimate missing nutrition', { items: [{ kind: 'estimate', name: 'Toast', calories: 250 }] }],
    ['estimate with negative nutrition', { items: [{ ...ESTIMATE, protein: -1 }] }],
    ['empty items despite success status', { items: [] }],
    ['only stray ids', { items: [{ kind: 'match', foodId: 'made-up' }] }],
    ['not an object', 'ok'],
  ])('rejects an unusable success response (%s)', async (_name, body) => {
    fetchMock.mockResolvedValue(jsonResponse(200, body));

    await expect(logFromText(REQUEST)).rejects.toThrow(
      'The logging service returned an unusable response.',
    );
  });

  it('throws with the function-provided message on an error status', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(422, { error: "That description couldn't be understood — try rephrasing it." }),
    );

    await expect(logFromText(REQUEST)).rejects.toThrow(
      "That description couldn't be understood — try rephrasing it.",
    );
  });

  it('throws a generic message when an error response has no JSON error field', async () => {
    fetchMock.mockResolvedValue(new Response('gateway timeout', { status: 504 }));

    await expect(logFromText(REQUEST)).rejects.toThrow('Logging failed (HTTP 504)');
  });

  it('rethrows aborts untouched so callers can ignore them', async () => {
    fetchMock.mockRejectedValue(new DOMException('Aborted', 'AbortError'));

    await expect(logFromText(REQUEST)).rejects.toHaveProperty('name', 'AbortError');
  });

  it('maps other network failures to a readable message', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(logFromText(REQUEST)).rejects.toThrow('Could not reach the logging service.');
  });

  it('fails without a session before any network call', async () => {
    mockAuth.token = null;

    await expect(logFromText(REQUEST)).rejects.toThrow('You need to be signed in to log from text.');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('resolveTextLogItems', () => {
  const FOODS: LibraryFood[] = [
    libraryFood(),
    libraryFood({
      id: 'food-2',
      name: 'Jasmine rice',
      description: 'cooked',
      servingLabel: 'serving',
      servingSize: { amount: 100, unit: 'g' },
      calories: 130,
      carbs: 28,
      protein: 3,
      fat: 0,
    }),
  ];

  it('resolves a serving-count match in the food serving label', () => {
    const [item] = resolveTextLogItems([MATCH], FOODS, 'lunch');

    expect(item).toMatchObject({
      name: 'Sara Lee bread',
      amount: 2,
      unit: 'slice',
      meal: 'lunch',
      foodId: 'food-1',
      source: 'manual',
      calories: 70,
    });
    expect(item.anchor).toEqual({ servingLabel: 'slice', servingSize: undefined });
  });

  it('applies grams when the anchor has a weight equivalence', () => {
    const [item] = resolveTextLogItems(
      [{ kind: 'match', foodId: 'food-2', grams: 150 }],
      FOODS,
      'dinner',
    );

    expect(item).toMatchObject({ amount: 150, unit: 'g', description: 'cooked' });
  });

  it('falls back to 1 serving for grams without a weight equivalence', () => {
    const [item] = resolveTextLogItems(
      [{ kind: 'match', foodId: 'food-1', grams: 60 }],
      FOODS,
      'dinner',
    );

    expect(item).toMatchObject({ amount: 1, unit: 'slice' });
  });

  it('defaults to 1 serving when no amount was stated', () => {
    const [item] = resolveTextLogItems([{ kind: 'match', foodId: 'food-1' }], FOODS, 'snacks');

    expect(item).toMatchObject({ amount: 1, unit: 'slice' });
  });

  it('prefers a stated meal over the fallback', () => {
    const [item] = resolveTextLogItems(
      [{ kind: 'match', foodId: 'food-1', meal: 'breakfast' }],
      FOODS,
      'snacks',
    );

    expect(item.meal).toBe('breakfast');
  });

  it('resolves estimates as one-serving foods with rounded nutrition', () => {
    const [item] = resolveTextLogItems(
      [{ ...ESTIMATE, kind: 'estimate', calories: 250.55 }],
      FOODS,
      'snacks',
    );

    expect(item).toMatchObject({
      name: 'Peanut butter toast',
      amount: 1,
      unit: 'serving',
      meal: 'snacks',
      source: 'search',
      calories: 250.6,
      confidenceNote: 'assumed 1 tbsp of peanut butter',
    });
    expect(item.foodId).toBeUndefined();
  });

  it('drops matches that no longer resolve to a library food', () => {
    const items = resolveTextLogItems(
      [{ kind: 'match', foodId: 'gone' }, MATCH],
      FOODS,
      'lunch',
    );

    expect(items).toHaveLength(1);
    expect(items[0].foodId).toBe('food-1');
  });
});
