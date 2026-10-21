import type { QuestionStatus } from '../practice/history.ts';

const STYLE: Record<QuestionStatus, { cls: string; label: string }> = {
  new: { cls: 'border-2 border-muted', label: 'Not tried' },
  right: { cls: 'bg-good', label: 'Full marks' },
  partial: { cls: 'bg-listen', label: 'Some marks' },
  wrong: { cls: 'bg-bad', label: 'No marks' },
};

export function StatusDot({ status }: { status: QuestionStatus }) {
  const s = STYLE[status];
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted">
      <span aria-hidden="true" className={`size-3 shrink-0 rounded-full ${s.cls}`} />
      {s.label}
    </span>
  );
}
