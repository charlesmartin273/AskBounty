import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// Thin wrapper around the Anthropic Messages API for the evaluation agent.
// Returns parsed JSON; retries once with a corrective nudge on parse failure.
// Answer bodies are untrusted — callers must delimit them (PRD §6 prompt
// injection defense); this module never mixes roles or elevates user text.

const MODEL = "claude-opus-4-8";
const MAX_TOKENS = 1024;

let cached: Anthropic | null = null;

function getClient(): Anthropic {
  if (cached) return cached;
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  cached = new Anthropic();
  return cached;
}

// Strip markdown code fences if the model wrapped its JSON in them.
function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return (fenced ? fenced[1] : text).trim();
}

export async function callClaude<T = unknown>(args: {
  system: string;
  user: string;
}): Promise<T> {
  const client = getClient();

  async function attempt(userContent: string): Promise<string> {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: args.system,
      messages: [{ role: "user", content: userContent }],
    });
    if (response.stop_reason === "refusal") {
      throw new Error("Claude refused the evaluation request");
    }
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("Claude returned no text content");
    }
    return textBlock.text;
  }

  const first = await attempt(args.user);
  try {
    return JSON.parse(extractJson(first)) as T;
  } catch {
    // One retry: repeat the request with an explicit JSON-only reminder.
    const second = await attempt(
      `${args.user}\n\nYour previous reply was not valid JSON. Respond with ONLY a single valid JSON object, no prose, no code fences.`,
    );
    return JSON.parse(extractJson(second)) as T;
  }
}
