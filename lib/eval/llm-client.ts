// Evaluation LLM client - currently Google Gemini free tier (PRD-ERRATA E5;
// PRD says Claude API, swapped for demo cost). PROVIDER-SWAPPABLE: to change
// provider, edit ONLY this file and keep the exported interface intact.
// Server-only by convention: GEMINI_API_KEY must never reach the client
// bundle (runtime guard below instead of `import "server-only"` so the tsx
// test script can exercise this module).

const MODEL = "gemini-3.5-flash";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const TIMEOUT_MS = 30_000;

// Failure classification for the eval pipeline (Phase 3 requirement): any
// LlmEvalError => answer shows "evaluation pending, retrying" + manual retry
// button. NEVER silently hang, NEVER map a failure to "accepted".
export type LlmErrorCode =
  | "rate_limited" // 429 - free-tier quota; auto-retryable
  | "auth" // 401/403 - key missing/invalid; needs config fix, manual retry
  | "timeout" // request exceeded TIMEOUT_MS; auto-retryable
  | "provider_error" // 5xx / network; auto-retryable
  | "bad_response"; // unparseable/blocked output; manual retry

export class LlmEvalError extends Error {
  constructor(
    readonly code: LlmErrorCode,
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "LlmEvalError";
  }
}

// Verdict shape per PRD §3 - kept identical across providers.
export interface LlmVerdict {
  topics: { topic: string; covered: boolean }[];
  overall: boolean;
  reasoning: string;
}

// Gemini structured-output schema mirroring LlmVerdict.
export const VERDICT_SCHEMA = {
  type: "object",
  properties: {
    topics: {
      type: "array",
      items: {
        type: "object",
        properties: {
          topic: { type: "string" },
          covered: { type: "boolean" },
        },
        required: ["topic", "covered"],
      },
    },
    overall: { type: "boolean" },
    reasoning: { type: "string" },
  },
  required: ["topics", "overall", "reasoning"],
} as const;

// Same input/output shape as the previous Claude client: system + user in,
// parsed JSON out. `schema` (optional) enforces provider-side structured
// output; omit for free-form JSON.
export async function callLlm<T = unknown>(args: {
  system: string;
  user: string;
  schema?: object;
}): Promise<T> {
  if (typeof window !== "undefined") {
    throw new Error("llm-client is server-only - never import client-side");
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new LlmEvalError("auth", "GEMINI_API_KEY is not set", false);
  }

  let res: Response;
  try {
    res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: args.system }] },
        contents: [{ role: "user", parts: [{ text: args.user }] }],
        generationConfig: {
          responseMimeType: "application/json",
          ...(args.schema ? { responseSchema: args.schema } : {}),
        },
      }),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new LlmEvalError("timeout", `LLM request exceeded ${TIMEOUT_MS}ms`, true);
    }
    throw new LlmEvalError("provider_error", `network failure: ${err}`, true);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 429) {
      throw new LlmEvalError("rate_limited", `Gemini 429: ${body.slice(0, 300)}`, true);
    }
    if (res.status === 401 || res.status === 403) {
      throw new LlmEvalError("auth", `Gemini ${res.status}: ${body.slice(0, 300)}`, false);
    }
    throw new LlmEvalError(
      "provider_error",
      `Gemini ${res.status}: ${body.slice(0, 300)}`,
      res.status >= 500,
    );
  }

  const data = (await res.json().catch(() => null)) as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
  } | null;

  if (data?.promptFeedback?.blockReason) {
    throw new LlmEvalError(
      "bad_response",
      `Gemini blocked prompt: ${data.promptFeedback.blockReason}`,
      false,
    );
  }
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new LlmEvalError("bad_response", "Gemini returned no text candidate", false);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new LlmEvalError(
      "bad_response",
      `Gemini output is not valid JSON: ${text.slice(0, 200)}`,
      false,
    );
  }
}
