import { Link } from 'react-router';
import { ThemeToggle } from '../../components/ThemeToggle.tsx';

export function More() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold">More</h1>
      <section
        aria-labelledby="settings-heading"
        className="flex flex-col gap-3 rounded-token border border-line bg-surface p-5"
      >
        <h2 id="settings-heading" className="text-xl font-semibold">
          Settings
        </h2>
        <ThemeToggle />
      </section>
      <ul className="flex flex-col divide-y divide-line rounded-token border border-line bg-surface">
        <li>
          <Link to="/about" className="flex min-h-12 items-center px-5 font-semibold">
            About, licences and trademark
          </Link>
        </li>
        <li>
          <a
            href="https://github.com/crispin0007/PTE"
            className="flex min-h-12 items-center px-5 font-semibold"
          >
            Source code on GitHub
          </a>
        </li>
      </ul>
    </div>
  );
}
