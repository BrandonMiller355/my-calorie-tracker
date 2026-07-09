// identify-food: matches a photographed food against the user's food library
// and optionally reads its weight off a visible kitchen scale.
//
// Unlike analyze-food (which estimates nutrition for unknown dishes), this
// function only picks candidates from the library list sent with the request —
// the library already holds ground-truth nutrition.
//
// Deployed with verify_jwt enabled, so only signed-in users of this Supabase
// project can call it. GEMINI_API_KEY is a function secret — it never reaches
// the browser. Stateless by design: the photo, note, and library payload live
// only for the duration of the request. See
// openspec/changes/identify-food-from-photo/design.md.

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// The SPA origin (GitHub Pages) differs from the functions origin, so CORS
// headers are required on every response, including errors.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SYSTEM_PROMPT =
  'You identify which food from the user\'s saved food list appears in a photo, ' +
  'typically sitting on a kitchen scale. You are given the list as JSON: each ' +
  'entry has an id, name, optional description, and optionally servingGrams ' +
  '(the weight of one serving). An optional user note gives extra context.\n\n' +
  'Candidates: return ids ONLY from the provided list, ranked by confidence ' +
  '(0-1). Return exactly one candidate when you are confident which food it is, ' +
  'two or three when you are torn between plausible entries, and an empty list ' +
  'when nothing in the list plausibly matches the photographed food. Never ' +
  'force a match.\n\n' +
  'Amount: if a scale display is clearly legible, read it verbatim as the net ' +
  'weight (the user tares, so do not subtract containers) and report it in ' +
  'grams, converting if the display shows ounces or pounds; set source to ' +
  '"scale". If no display is legible but the top candidate has servingGrams, ' +
  'you may judge the visible portion against that known serving weight and ' +
  'report approximate grams with source "estimate". If the display is blurry, ' +
  'glared, or ambiguous and you cannot judge the portion, omit amount entirely ' +
  '— never guess.';

// Gemini's responseSchema is an OpenAPI-style subset; the model's JSON is
// revalidated in parseResult regardless.
const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    candidates: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'STRING' },
          confidence: { type: 'NUMBER' },
        },
        required: ['id', 'confidence'],
      },
    },
    amount: {
      type: 'OBJECT',
      properties: {
        grams: { type: 'NUMBER' },
        source: { type: 'STRING', enum: ['scale', 'estimate'] },
      },
      required: ['grams', 'source'],
    },
  },
  required: ['candidates'],
};

const MAX_CANDIDATES = 3;

interface IdentifyRequest {
  /** JPEG data URL of the captured photo */
  image?: unknown;
  /** Optional context note from the pre-send review */
  note?: unknown;
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

interface Candidate {
  id: string;
  confidence: number;
}

interface IdentifyResult {
  candidates: Candidate[];
  amount?: { grams: number; source: 'scale' | 'estimate' };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function errorResponse(status: number, message: string): Response {
  return json(status, { error: message });
}

/** Validates and strips each submitted food down to the fields the model needs. */
function parseFoods(raw: unknown): RequestFood[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
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

/**
 * Validates the model's JSON against the schema we demanded of it, dropping
 * hallucinated candidate ids and any unusable amount rather than failing.
 */
function parseResult(raw: string, knownIds: Set<string>): IdentifyResult | null {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null || !Array.isArray(data.candidates)) return null;

  const seen = new Set<string>();
  const candidates: Candidate[] = [];
  for (const item of data.candidates) {
    if (typeof item !== 'object' || item === null) continue;
    const { id, confidence } = item as Record<string, unknown>;
    if (typeof id !== 'string' || !knownIds.has(id) || seen.has(id)) continue;
    if (typeof confidence !== 'number' || !Number.isFinite(confidence)) continue;
    seen.add(id);
    candidates.push({ id, confidence: Math.min(1, Math.max(0, confidence)) });
    if (candidates.length === MAX_CANDIDATES) break;
  }

  const result: IdentifyResult = { candidates };

  const amount = data.amount;
  if (typeof amount === 'object' && amount !== null) {
    const { grams, source } = amount as Record<string, unknown>;
    if (
      typeof grams === 'number' &&
      Number.isFinite(grams) &&
      grams > 0 &&
      (source === 'scale' || source === 'estimate')
    ) {
      result.amount = { grams, source };
    }
  }

  return result;
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
    return errorResponse(500, 'The identification service is not configured (missing API key).');
  }

  let body: IdentifyRequest;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, 'Request body must be JSON.');
  }

  const image = body.image;
  const dataUrlMatch =
    typeof image === 'string' ? image.match(/^data:(image\/\w+);base64,(.+)$/s) : null;
  if (!dataUrlMatch) {
    return errorResponse(400, 'Request must include a captured photo.');
  }
  const [, mimeType, base64Data] = dataUrlMatch;

  const foods = parseFoods(body.foods);
  if (!foods) {
    return errorResponse(400, 'Request must include the food library to match against.');
  }

  const note = typeof body.note === 'string' ? body.note.trim() : '';

  const geminiRequest = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [
      {
        role: 'user',
        parts: [
          {
            text:
              'Identify which of these saved foods is in the photo:\n' +
              JSON.stringify(foods),
          },
          { inline_data: { mime_type: mimeType, data: base64Data } },
          ...(note ? [{ text: `Note from the user: ${note}` }] : []),
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      // Picking from a list doesn't need extended reasoning; skipping it keeps
      // the response fast and the free-tier token spend minimal.
      thinkingConfig: { thinkingBudget: 0 },
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
    return errorResponse(502, 'Could not reach the identification service.');
  }

  if (!res.ok) {
    // 429 = free-tier rate limit; worth naming since it's the one plausible
    // failure the user can act on (wait a minute).
    if (res.status === 429) {
      return errorResponse(
        502,
        'The identification service is rate-limited right now — try again in a minute.',
      );
    }
    return errorResponse(502, `The identification service returned an error (HTTP ${res.status}).`);
  }

  const completion = await res.json();
  const content: unknown = completion?.candidates?.[0]?.content?.parts?.[0]?.text;
  const result =
    typeof content === 'string'
      ? parseResult(content, new Set(foods.map((f) => f.id)))
      : null;
  if (!result) {
    return errorResponse(502, 'The identification service returned an unusable response.');
  }

  return json(200, result);
});
