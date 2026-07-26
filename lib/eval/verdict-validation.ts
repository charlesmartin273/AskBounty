import type { LlmVerdict } from "./llm-client";

// M3 fail-closed: the LLM verdict is untrusted output. ANY shape violation
// throws, and the caller maps that to "evaluation error" - NEVER to accepted.
// Gemini's responseSchema usually guarantees the shape, but a provider swap,
// API drift or partial output must not be able to slip a truthy blob through.

export class VerdictValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VerdictValidationError";
  }
}

function fail(reason: string): never {
  throw new VerdictValidationError(`invalid LLM verdict: ${reason}`);
}

export function validateVerdict(raw: unknown): LlmVerdict {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    fail("not an object");
  }
  const v = raw as Record<string, unknown>;
  if (typeof v.overall !== "boolean") fail("overall must be a boolean");
  if (typeof v.reasoning !== "string" || v.reasoning.trim() === "") {
    fail("reasoning must be a non-empty string");
  }
  if (!Array.isArray(v.topics)) fail("topics must be an array");
  // Review L1: [].every() is vacuously true - an empty topics list must never
  // be able to carry a pass.
  if (v.topics.length === 0) fail("topics must not be empty");
  for (const entry of v.topics) {
    if (typeof entry !== "object" || entry === null) {
      fail("topics entries must be objects");
    }
    const t = entry as Record<string, unknown>;
    if (typeof t.topic !== "string" || t.topic.trim() === "") {
      fail("topic name must be a non-empty string");
    }
    if (typeof t.covered !== "boolean") fail("covered must be a boolean");
  }
  return {
    topics: v.topics as LlmVerdict["topics"],
    overall: v.overall,
    reasoning: v.reasoning,
  };
}
