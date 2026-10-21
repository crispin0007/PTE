import type { GrammarIssue } from '@openpte/scoring';

/** The answer with each grammar issue underlined and numbered, then the issues with suggestions. */
export function GrammarMarks({ text, issues }: { text: string; issues: GrammarIssue[] }) {
  if (!issues.length) return null;
  const sorted = [...issues].sort((a, b) => a.offset - b.offset);
  const parts: (string | { issue: GrammarIssue; n: number })[] = [];
  let at = 0;
  sorted.forEach((issue, i) => {
    if (issue.offset < at) return; // overlapping issue: listed below, not marked twice
    parts.push(text.slice(at, issue.offset));
    parts.push({ issue, n: i + 1 });
    at = issue.offset + issue.length;
  });
  parts.push(text.slice(at));
  return (
    <div className="flex flex-col gap-2 text-sm" data-testid="grammar-marks">
      <p className="font-semibold">Grammar to check</p>
      <p className="whitespace-pre-line rounded-token bg-sunken p-3 leading-relaxed">
        {parts.map((p, i) =>
          typeof p === 'string' ? (
            p
          ) : (
            <mark
              key={i}
              title={p.issue.message}
              className="rounded-sm bg-bad-soft text-ink underline decoration-bad decoration-2 underline-offset-2"
            >
              {text.slice(p.issue.offset, p.issue.offset + p.issue.length)}
              <sup className="ml-0.5 font-semibold">{p.n}</sup>
            </mark>
          ),
        )}
      </p>
      <ol className="list-decimal pl-5">
        {sorted.map((issue, i) => (
          <li key={i}>
            {issue.message}
            {issue.replacements.length > 0 && (
              <span className="text-muted"> Try: {issue.replacements.join(', ')}.</span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
