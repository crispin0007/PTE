import { Link } from 'react-router';

/** Required on every page (AGENTS.md, non-negotiable 5). */
export const TRADEMARK_NOTICE =
  'Independent open-source project. Not affiliated with, endorsed by, or connected to Pearson. PTE is a trademark of Pearson.';

export function Footer() {
  return (
    <footer className="border-t border-line bg-surface px-4 py-6 text-sm text-muted">
      <div className="mx-auto flex max-w-5xl flex-col gap-2">
        <p data-testid="trademark-notice">{TRADEMARK_NOTICE}</p>
        <p>
          Code under AGPL-3.0, questions and media under CC BY-SA 4.0.{' '}
          <Link className="underline" to="/about">
            About and licences
          </Link>{' '}
          ·{' '}
          <Link className="underline" to="/privacy">
            Privacy
          </Link>
        </p>
      </div>
    </footer>
  );
}
