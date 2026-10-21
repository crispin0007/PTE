import { useState } from 'react';
import { applyTheme, readTheme, type Theme } from './theme.ts';

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(readTheme);
  return (
    <label className="flex min-h-11 items-center gap-2 text-sm">
      <span>Theme</span>
      <select
        className="rounded-token border border-line bg-surface min-h-11 px-3"
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
