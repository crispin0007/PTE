import { Fragment } from 'react';

/** Renders text with `{{bN}}` blank markers as numbered gaps. Interactive blanks arrive in Phase 1. */
export function TextWithBlanks({ text }: { text: string }) {
  const parts = text.split(/\{\{(b\d+)\}\}/);
  return (
    <p className="leading-relaxed">
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <span
            key={i}
            className="mx-1 inline-block min-w-16 rounded-token border border-dashed border-line bg-sunken px-2 text-center text-sm text-muted"
            aria-label={`Blank ${part.slice(1)}`}
          >
            {part.slice(1)}
          </span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </p>
  );
}
