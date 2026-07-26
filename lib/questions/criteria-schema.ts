// Criteria JSON stored on the question row (PRD §3 shape). Hand-rolled
// validation (no zod dep): returns typed value + hard errors + soft warnings.

export interface Criteria {
  minWords: number;
  mustIncludeCode: boolean;
  codeLanguage?: string;
  topics: string[];
}

export interface CriteriaValidation {
  criteria?: Criteria;
  errors: string[];
  warnings: string[]; // soft - shown in UI, do not block (PRD "impossible criteria" risk)
}

const MAX_TOPICS = 10;
const IMPOSSIBLE_MIN_WORDS = 5000;

export function validateCriteria(input: unknown): CriteriaValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (typeof input !== "object" || input === null) {
    return { errors: ["criteria must be an object"], warnings };
  }
  const c = input as Record<string, unknown>;

  const minWords = Number(c.minWords ?? 0);
  if (!Number.isInteger(minWords) || minWords < 0) {
    errors.push("minWords must be a non-negative integer");
  } else if (minWords > IMPOSSIBLE_MIN_WORDS) {
    warnings.push(
      `minWords ${minWords} is likely impossible - no answer may ever pass; budget would ride to expiry/refund`,
    );
  }

  const mustIncludeCode = Boolean(c.mustIncludeCode);
  let codeLanguage: string | undefined;
  if (c.codeLanguage !== undefined && c.codeLanguage !== "") {
    if (typeof c.codeLanguage !== "string" || c.codeLanguage.length > 30) {
      errors.push("codeLanguage must be a short string");
    } else {
      codeLanguage = c.codeLanguage.trim();
    }
  }

  let topics: string[] = [];
  if (c.topics !== undefined) {
    if (
      !Array.isArray(c.topics) ||
      c.topics.some((t) => typeof t !== "string" || t.trim() === "" || t.length > 100)
    ) {
      errors.push("topics must be an array of short non-empty strings");
    } else if (c.topics.length > MAX_TOPICS) {
      errors.push(`at most ${MAX_TOPICS} topics`);
    } else {
      topics = (c.topics as string[]).map((t) => t.trim());
    }
  }

  if (errors.length > 0) return { errors, warnings };
  return { criteria: { minWords, mustIncludeCode, codeLanguage, topics }, errors, warnings };
}
