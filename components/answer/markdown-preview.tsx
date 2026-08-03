// Minimal, XSS-safe markdown preview: plain text + fenced ``` code blocks
// rendered as <pre>. React escapes all text - no raw HTML, no heavy lib
// (full markdown deferred to Phase 5, matching the question body's rendering).
export function MarkdownPreview({ body }: { body: string }) {
  const segments = body.split("```");
  return (
    <div className="t-body-14 space-y-2">
      {segments.map((seg, i) =>
        i % 2 === 1 ? (
          // bg-muted (black/4%): visible on both cream page and white cards -
          // bg-secondary is now pure white and would vanish on paper.
          <pre
            key={i}
            className="t-code overflow-x-auto rounded-lg bg-muted p-4"
          >
            {stripLanguageHint(seg)}
          </pre>
        ) : seg.trim() === "" ? null : (
          <p key={i} className="whitespace-pre-wrap">
            {seg.trim()}
          </p>
        ),
      )}
    </div>
  );
}

// Drops the "typescript" language tag on the opening fence line, if any.
function stripLanguageHint(code: string): string {
  const firstNewline = code.indexOf("\n");
  if (firstNewline >= 0 && firstNewline <= 20) {
    return code.slice(firstNewline + 1).replace(/\n$/, "");
  }
  return code;
}
