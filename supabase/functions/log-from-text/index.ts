// log-from-text: parses a free-text meal description ("2 slices of sara lee
// bread with 1 serving of pbfit") into logged-entry proposals — library
// matches with amounts where the text names a saved food, nutrition estimates
// (analyze-food style) where it doesn't.
//
// Deployed with verify_jwt enabled, so only signed-in users of this Supabase
// project can call it. GEMINI_API_KEY is a function secret — it never reaches
// the browser. Stateless by design: the text, library payload, and result
// live only for the duration of the request. See
// openspec/changes/log-food-from-text/design.md.

// 2.5-flash started returning 404 in July 2026 (retired from the API ahead
// of the published date); 3.5-flash is the current Flash-tier model.
const GEMINI_MODEL = 'gemini-3.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// The SPA origin (GitHub Pages) differs from the functions origin, so CORS
// headers are required on every response, including errors.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MEALS = ['breakfast', 'lunch', 'dinner', 'snacks'] as const;
type Meal = (typeof MEALS)[number];

const SYSTEM_PROMPT =
  'You turn a short description of what someone ate into a list of food ' +
  'items to log. You are given their saved food list as JSON: each entry has ' +
  'an id, name, optional description, servingLabel (what one serving is ' +
  'called, e.g. "slice"), and optionally servingGrams (the weight of one ' +
  'serving). You may also be told which meal they are currently logging, as ' +
  'context only.\n\n' +
  'Return one item per distinct food in the description.\n\n' +
  'Matching: when a described food plausibly refers to a saved food (by name ' +
  'or description, including brands, abbreviations, and casual phrasing like ' +
  '"my normal protein shake"), return that entry\'s foodId — ONLY ids from ' +
  'the provided list. Pick the single best match; never force one.\n\n' +
  'Estimating: when nothing in the list plausibly matches, instead return a ' +
  'short name plus estimated calories (kcal), fat (g), carbs (g), and ' +
  'protein (g) for the described portion, and in confidenceNote state your ' +
  'single most uncertain assumption in one short sentence.\n\n' +
  'Amounts (matched items only): when the description counts servings of the ' +
  'food\'s servingLabel (e.g. "2 slices" for servingLabel "slice"), set ' +
  'servings to that count. When it states a weight, set grams (converting ' +
  'from other weight units). When no quantity is stated — including habitual ' +
  'phrasing like "my usual" — omit both.\n\n' +
  'Meal: set meal only when the description states one (e.g. "for ' +
  'breakfast"); otherwise omit it.';

// Gemini's responseSchema can't express a union, so every item field is
// optional here and classifyItems sorts matches from estimates after the fact.
const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          foodId: { type: 'STRING' },
          servings: { type: 'NUMBER' },
          grams: { type: 'NUMBER' },
          name: { type: 'STRING' },
          calories: { type: 'NUMBER' },
          fat: { type: 'NUMBER' },
          carbs: { type: 'NUMBER' },
          protein: { type: 'NUMBER' },
          confidenceNote: { type: 'STRING' },
          meal: { type: 'STRING', enum: [...MEALS] },
        },
      },
    },
  },
  required: ['items'],
};

interface LogFromTextRequest {
  /** The user's free-text description of what they ate */
  text?: unknown;
  /** The meal currently selected in the dialog; context only */
  meal?: unknown;
  /** The user's non-archived library foods */
  foods?: unknown;
}

interface RequestFood {
  id: string;
  name: string;
  description?: string;
  servingLabel?: string;
  servingGrams?: number;
}

/** A described food resolved to a saved library food. */
interface MatchItem {
  kind: 'match';
  foodId: string;
  servings?: number;
  grams?: number;
  meal?: Meal;
}

/** A described food the library doesn't contain; nutrition is for the described portion. */
interface EstimateItem {
  kind: 'estimate';
  name: string;
  calories: number;
  fat: number;
  carbs: number;
  protein: number;
  confidenceNote: string;
  meal?: Meal;
}

type ParsedItem = MatchItem | EstimateItem;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function errorResponse(status: number, message: string): Response {
  return json(status, { error: message });
}

/**
 * Validates and strips each submitted food down to the fields the model
 * needs. An empty list is valid — a new user's description simply comes back
 * as all estimates — but a malformed entry rejects the request.
 */
function parseFoods(raw: unknown): RequestFood[] | null {
  if (!Array.isArray(raw)) return null;
  const foods: RequestFood[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) return null;
    const { id, name, description, servingLabel, servingGrams } = item as Record<string, unknown>;
    if (typeof id !== 'string' || id.trim() === '') return null;
    if (typeof name !== 'string' || name.trim() === '') return null;
    const food: RequestFood = { id, name };
    if (typeof description === 'string' && description.trim() !== '') {
      food.description = description;
    }
    if (typeof servingLabel === 'string' && servingLabel.trim() !== '') {
      food.servingLabel = servingLabel;
    }
    if (typeof servingGrams === 'number' && Number.isFinite(servingGrams) && servingGrams > 0) {
      food.servingGrams = servingGrams;
    }
    foods.push(food);
  }
  return foods;
}

function parseMeal(raw: unknown): Meal | undefined {
  return typeof raw === 'string' && (MEALS as readonly string[]).includes(raw)
    ? (raw as Meal)
    : undefined;
}

function positiveOrUndefined(raw: unknown): number | undefined {
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : undefined;
}

/**
 * Classifies each of the model's flat items as a match (known foodId wins) or
 * an estimate (name plus complete nutrition), dropping unusable items rather
 * than failing. Returns null only when the response isn't the demanded shape.
 */
function classifyItems(raw: string, knownIds: Set<string>): ParsedItem[] | null {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null || !Array.isArray(data.items)) return null;

  const items: ParsedItem[] = [];
  for (const entry of data.items) {
    if (typeof entry !== 'object' || entry === null) continue;
    const { foodId, servings, grams, name, calories, fat, carbs, protein, confidenceNote, meal } =
      entry as Record<string, unknown>;

    if (typeof foodId === 'string' && knownIds.has(foodId)) {
      items.push({
        kind: 'match',
        foodId,
        servings: positiveOrUndefined(servings),
        grams: positiveOrUndefined(grams),
        meal: parseMeal(meal),
      });
      continue;
    }

    if (
      typeof name === 'string' &&
      name.trim() !== '' &&
      [calories, fat, carbs, protein].every(
        (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0,
      )
    ) {
      items.push({
        kind: 'estimate',
        name,
        calories: calories as number,
        fat: fat as number,
        carbs: carbs as number,
        protein: protein as number,
        confidenceNote: typeof confidenceNote === 'string' ? confidenceNote : '',
        meal: parseMeal(meal),
      });
    }
    // Neither a known match nor a complete estimate: hallucinated id with no
    // nutrition, or nutrition gaps — drop the item, keep the rest.
  }
  return items;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return errorResponse(405, 'Method not allowed');
  }

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    return errorResponse(500, 'The logging service is not configured (missing API key).');
  }

  let body: LogFromTextRequest;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, 'Request body must be JSON.');
  }

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (text === '') {
    return errorResponse(400, 'Request must include a description of what you ate.');
  }

  const foods = parseFoods(body.foods);
  if (!foods) {
    return errorResponse(400, 'Request must include the food library to match against.');
  }

  const currentMeal = parseMeal(body.meal);

  const geminiRequest = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [
      {
        role: 'user',
        parts: [
          { text: `Saved foods:\n${JSON.stringify(foods)}` },
          ...(currentMeal ? [{ text: `Currently logging: ${currentMeal}` }] : []),
          { text: `What I ate: ${text}` },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      // Splitting a sentence into list picks doesn't need extended reasoning;
      // the floor keeps the response fast and the free-tier token spend
      // minimal. (Gemini 3.x takes thinkingLevel; the 2.x thinkingBudget
      // field is rejected.)
      thinkingConfig: { thinkingLevel: 'minimal' },
    },
  };

  let res: Response;
  try {
    res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(geminiRequest),
    });
  } catch {
    return errorResponse(502, 'Could not reach the logging service.');
  }

  if (!res.ok) {
    // 429 = free-tier rate limit; worth naming since it's the one plausible
    // failure the user can act on (wait a minute).
    if (res.status === 429) {
      return errorResponse(
        502,
        'The logging service is rate-limited right now — try again in a minute.',
      );
    }
    return errorResponse(502, `The logging service returned an error (HTTP ${res.status}).`);
  }

  const completion = await res.json();
  const content: unknown = completion?.candidates?.[0]?.content?.parts?.[0]?.text;
  const items =
    typeof content === 'string'
      ? classifyItems(content, new Set(foods.map((f) => f.id)))
      : null;
  if (!items) {
    return errorResponse(502, 'The logging service returned an unusable response.');
  }
  // An empty item list is a comprehension failure, not a success: tell the
  // user their words weren't understood rather than silently logging nothing.
  if (items.length === 0) {
    return errorResponse(422, "That description couldn't be understood — try rephrasing it.");
  }

  return json(200, { items });
});
