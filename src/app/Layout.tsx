import { NavLink, Outlet } from 'react-router';
import { Footer } from '../components/Footer.tsx';
import { ThemeToggle } from '../components/ThemeToggle.tsx';

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-token px-2 py-1 ${isActive ? 'bg-accent-soft font-semibold' : 'hover:underline'}`;

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:bg-surface focus:p-2"
      >
        Skip to content
      </a>
      <header className="border-b border-border bg-surface px-4 py-3">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
          <NavLink to="/" className="text-lg font-bold">
            openpte
          </NavLink>
          <nav aria-label="Main" className="flex items-center gap-2 text-sm">
            <NavLink to="/practice" className={navClass}>
              Practice
            </NavLink>
            <NavLink to="/about" className={navClass}>
              About
            </NavLink>
            <ThemeToggle />
          </nav>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
