import type { Criteria } from "../questions/criteria-schema";

// Objective checks run FIRST, in code, for free - they are immune to prompt
// injection and gate the (costly) LLM call (PRD §6). Isomorphic: no secrets,
// safe to import from UI for type sharing.

export interface CheckResult {
  check: string;
  pass: boolean;
  detail: string;
}

export function wordCount(body: string): number {
  return body.trim().split(/\s+/).filter(Boolean).length;
}

// A fenced ``` block marker anywhere counts - the markdown preview renders
// the same fences, so what passes here is what the asker sees as code.
export function hasCodeBlock(body: string): boolean {
  return /```/.test(body);
}

export function runObjectiveChecks(
  body: string,
  criteria: Criteria,
): CheckResult[] {
  const results: CheckResult[] = [];
  if (criteria.minWords > 0) {
    const words = wordCount(body);
    results.push({
      check: "min_words",
      pass: words >= criteria.minWords,
      detail: `${words}/${criteria.minWords} words`,
    });
  }
  if (criteria.mustIncludeCode) {
    const found = hasCodeBlock(body);
    results.push({
      check: "has_code_block",
      pass: found,
      detail: found
        ? "fenced ``` code block found"
        : "no fenced ``` code block",
    });
  }
  return results;
}
