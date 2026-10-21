import { useState } from 'react';
import { applyTheme, readTheme, type Theme } from './theme.ts';

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(readTheme);
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="sr-only sm:not-sr-only">Theme</span>
      <select
        className="rounded-token border border-border bg-surface px-2 py-1"
        value={theme}
        onChange={(e) => {
          const t = e.target.value as Theme;
          setTheme(t);
          applyTheme(t);
        }}
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  );
}
