import { NavLink, Outlet } from 'react-router';
import { Footer } from '../components/Footer.tsx';
import { Icon, type IconName } from '../components/Icon.tsx';
import { ThemeToggle } from '../components/ThemeToggle.tsx';
import { useBranding } from '../practice/branding.ts';

const TABS: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: 'Today', icon: 'today' },
  { to: '/practice', label: 'Practice', icon: 'practice' },
  { to: '/progress', label: 'Progress', icon: 'progress' },
  { to: '/more', label: 'More', icon: 'more' },
];

function Logo() {
  const brand = useBranding();
  return (
    <NavLink to="/" className="flex min-w-0 items-center gap-2 font-display text-lg font-bold">
      {brand?.logoUrl ? (
        <img src={brand.logoUrl} alt="" className="size-8 shrink-0 rounded-lg object-contain" />
      ) : (
        <span
          aria-hidden="true"
          className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand text-brand-ink"
        >
          {brand ? brand.name.charAt(0).toUpperCase() : 'P'}
        </span>
      )}
      {brand ? (
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate">{brand.name}</span>
          <span className="text-xs font-normal text-muted">on openpte</span>
        </span>
      ) : (
        'openpte'
      )}
    </NavLink>
  );
}

/**
 * App shell from the UI plan: bottom tabs on phones, a side rail from the md breakpoint up.
 * Both navs render the same links; CSS shows one of them.
 */
export function Layout() {
  return (
    <div className="min-h-screen md:flex">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:bg-surface focus:p-2"
      >
        Skip to content
      </a>

      <aside className="hidden shrink-0 print:hidden border-r border-line bg-surface md:sticky md:top-0 md:flex md:h-screen md:w-56 md:flex-col md:gap-6 md:p-4">
        <Logo />
        <nav aria-label="Main" className="flex flex-col gap-1">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.to === '/'}
              className={({ isActive }) =>
                `flex min-h-11 items-center gap-3 rounded-token px-3 font-semibold ${
                  isActive ? 'bg-brand-soft text-ink' : 'text-muted hover:bg-sunken hover:text-ink'
                }`
              }
            >
              <Icon name={t.icon} />
              {t.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto">
          <ThemeToggle />
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="flex items-center print:hidden border-b border-line bg-surface px-4 py-2 md:hidden">
          <Logo />
        </header>
        <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 md:px-8">
          <Outlet />
        </main>
        <Footer />
        {/* Space so the fixed tab bar never covers the footer on phones. */}
        <div aria-hidden="true" className="h-16 md:hidden" />
      </div>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 grid print:hidden grid-cols-4 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.to === '/'}
            className={({ isActive }) =>
              `flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${
                isActive ? 'text-brand' : 'text-muted'
              }`
            }
          >
            <Icon name={t.icon} />
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
