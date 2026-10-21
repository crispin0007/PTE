/** Shown on every screen that displays a score (AGENTS.md, non-negotiable 4). Not configurable. */
export function ScoreDisclaimer() {
  return (
    <p
      role="note"
      data-testid="score-disclaimer"
      className="rounded-token bg-warn-bg px-3 py-2 text-sm text-warn-text"
    >
      Practice estimate only. This is not an official PTE score and may differ from your real test
      result.
    </p>
  );
}
