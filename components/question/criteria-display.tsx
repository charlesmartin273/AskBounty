import type { Criteria } from "@/lib/questions/criteria-schema";

// Read-only render of the acceptance criteria - answerers see exactly what
// the evaluation agent will check, before writing a word.
export function CriteriaDisplay({ criteria }: { criteria: Criteria }) {
  return (
    <div className="rounded-xl bg-paper p-6">
      <h3 className="t-display-20 mb-3 text-ink">Acceptance criteria</h3>
      <ul className="t-body-14 space-y-2 text-ink">
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
            <span className="text-muted-ink">(checked by the AI reviewer)</span>
          </li>
        )}
        {criteria.minWords === 0 && !criteria.mustIncludeCode && criteria.topics.length === 0 && (
          <li className="text-muted-ink">No explicit criteria - any substantive answer.</li>
        )}
      </ul>
      <p className="t-body-14 mt-4 border-t border-line-2 pt-3 text-muted-ink">
        First answer that passes ALL checks wins the bounty. Answers are evaluated in
        submission order.
      </p>
    </div>
  );
}
