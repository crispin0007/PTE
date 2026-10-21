import { Link } from 'react-router';
import { SECTION_LABELS, questionCount, typesBySection } from '../../content/catalog.ts';

export function Practice() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Practice by question type</h1>
      {typesBySection().map(({ section, types }) => (
        <section
          key={section}
          aria-labelledby={`section-${section}`}
          className="flex flex-col gap-2"
        >
          <h2 id={`section-${section}`} className="text-lg font-semibold">
            {SECTION_LABELS[section]}
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {types.map((t) => (
              <li key={t.id}>
                <Link
                  to={`/practice/${t.id}`}
                  className="flex items-center justify-between gap-2 rounded-token border border-line bg-surface px-3 py-2 hover:border-brand"
                >
                  <span>{t.label}</span>
                  <span className="text-sm text-muted">{questionCount(t.id)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
