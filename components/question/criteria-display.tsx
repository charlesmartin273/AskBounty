import type { Criteria } from "@/lib/questions/criteria-schema";

// Read-only render of the acceptance criteria - answerers see exactly what
// the evaluation agent will check, before writing a word.
export function CriteriaDisplay({ criteria }: { criteria: Criteria }) {
  return (
    <div className="rounded-lg border p-4">
      <h3 className="mb-2 font-medium">Acceptance criteria</h3>
      <ul className="space-y-1 text-sm">
        {criteria.minWords > 0 && <li>• Minimum {criteria.minWords} words</li>}
        {criteria.mustIncludeCode && (
          <li>
            • Must include a code sample
            {criteria.codeLanguage ? ` (${criteria.codeLanguage})` : ""}
          </li>
        )}
        {criteria.topics.length > 0 && (
          <li>
            • Must substantively cover: {criteria.topics.map((t) => `"${t}"`).join(", ")}{" "}
            <span className="text-muted-foreground">(checked by the AI reviewer)</span>
          </li>
        )}
        {criteria.minWords === 0 && !criteria.mustIncludeCode && criteria.topics.length === 0 && (
          <li className="text-muted-foreground">No explicit criteria - any substantive answer.</li>
        )}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        First answer that passes ALL checks wins the bounty. Answers are evaluated in
        submission order.
      </p>
    </div>
  );
}
