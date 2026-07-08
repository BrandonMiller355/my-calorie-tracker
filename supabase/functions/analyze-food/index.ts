// analyze-food: estimates a dish's name, calories, and macros from a photo.
//
// Deployed with verify_jwt enabled, so only signed-in users of this Supabase
// project can call it; the platform rejects anonymous requests before this
// code runs. GEMINI_API_KEY is a function secret (npx supabase secrets set) —
// it never reaches the browser.
//
// Stateless by design: every request carries the photo and all correction
// turns so far, so nothing about a conversation exists server-side. See
// openspec/changes/ai-analyze-photo/design.md.

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
  'You are a nutrition estimator. The user sends a photo of a dish and may ' +
  'follow up with corrections about what is in it. Estimate the food shown: ' +
  'a short dish name, and calories (kcal), fat (g), carbs (g), and protein (g) ' +
  'for the entire visible portion. Corrections describe the same dish — revise ' +
  'the whole estimate to account for all of them. In confidenceNote, state your ' +
  'single most uncertain assumption in one short sentence (e.g. portion size or ' +
  'a hidden ingredient).';

// Gemini's responseSchema is an OpenAPI-style subset; the model's JSON is
// revalidated in parseEstimate regardless.
const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    name: { type: 'STRING' },
    calories: { type: 'NUMBER' },
    fat: { type: 'NUMBER' },
    carbs: { type: 'NUMBER' },
    protein: { type: 'NUMBER' },
    confidenceNote: { type: 'STRING' },
  },
  required: ['name', 'calories', 'fat', 'carbs', 'protein', 'confidenceNote'],
};

interface AnalyzeRequest {
  /** JPEG data URL of the captured photo */
  image?: unknown;
  /** User corrections so far, oldest first */
  corrections?: unknown;
}

interface FoodEstimate {
  name: string;
  calories: number;
  fat: number;
  carbs: number;
  protein: number;
  confidenceNote: string;
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

/** Validates the model's JSON against the schema we demanded of it. */
function parseEstimate(raw: string): FoodEstimate | null {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  const { name, calories, fat, carbs, protein, confidenceNote } = data;
  if (typeof name !== 'string' || name.trim() === '') return null;
  if (typeof confidenceNote !== 'string') return null;
  for (const n of [calories, fat, carbs, protein]) {
    if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return null;
  }
  return { name, calories, fat, carbs, protein, confidenceNote } as FoodEstimate;
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
    return errorResponse(500, 'The analysis service is not configured (missing API key).');
  }

  let body: AnalyzeRequest;
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
  const corrections = Array.isArray(body.corrections)
    ? body.corrections.filter((c): c is string => typeof c === 'string' && c.trim() !== '')
    : [];

  // Everything goes in one user turn (photo, then corrections as extra text
  // parts): Gemini rejects multiturn requests that don't alternate user/model,
  // and the request is stateless anyway.
  const geminiRequest = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [
      {
        role: 'user',
        parts: [
          { text: 'Estimate the nutrition of the food in this photo.' },
          { inline_data: { mime_type: mimeType, data: base64Data } },
          ...corrections.map((text) => ({ text: `Correction: ${text}` })),
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      // A nutrition guess doesn't need extended reasoning; skipping it keeps
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
    return errorResponse(502, 'Could not reach the analysis service.');
  }

  if (!res.ok) {
    // 429 = free-tier rate limit; worth naming since it's the one plausible
    // failure the user can act on (wait a minute).
    if (res.status === 429) {
      return errorResponse(502, 'The analysis service is rate-limited right now — try again in a minute.');
    }
    return errorResponse(502, `The analysis service returned an error (HTTP ${res.status}).`);
  }

  const completion = await res.json();
  const content: unknown = completion?.candidates?.[0]?.content?.parts?.[0]?.text;
  const estimate = typeof content === 'string' ? parseEstimate(content) : null;
  if (!estimate) {
    return errorResponse(502, 'The analysis service returned an unusable response.');
  }

  return json(200, estimate);
});
