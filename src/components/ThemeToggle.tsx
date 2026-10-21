import { useEffect, useState } from 'react';
import { applyTheme, storedThemeMode, watchSystemTheme, type ThemeMode } from '../lib/theme';
import { MonitorIcon, MoonIcon, SunIcon } from './Icons';

const OPTIONS = [
  { key: 'light', label: 'Mode terang', Icon: SunIcon },
  { key: 'dark', label: 'Mode gelap', Icon: MoonIcon },
  { key: 'system', label: 'Ikuti sistem', Icon: MonitorIcon },
] as const;

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>(() => storedThemeMode());

  useEffect(() => {
    applyTheme(mode);
    if (mode !== 'system') return;
    return watchSystemTheme(() => applyTheme('system'));
  }, [mode]);

  return (
    <div className="theme-toggle" role="radiogroup" aria-label="Tema tampilan">
      {OPTIONS.map(({ key, label, Icon }) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={mode === key}
          aria-label={label}
          title={label}
          className={`theme-toggle__btn${mode === key ? ' is-active' : ''}`}
          onClick={() => setMode(key)}
        >
          <Icon size={15} />
        </button>
      ))}
    </div>
  );
}
