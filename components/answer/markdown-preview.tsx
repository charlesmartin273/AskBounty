// Minimal, XSS-safe markdown preview: plain text + fenced ``` code blocks
// rendered as <pre>. React escapes all text - no raw HTML, no heavy lib
// (full markdown deferred to Phase 5, matching the question body's rendering).
export function MarkdownPreview({ body }: { body: string }) {
  const segments = body.split("```");
  return (
    <div className="space-y-2 text-sm leading-6">
      {segments.map((seg, i) =>
        i % 2 === 1 ? (
          <pre
            key={i}
            className="overflow-x-auto rounded-md bg-secondary p-3 font-mono text-xs"
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
