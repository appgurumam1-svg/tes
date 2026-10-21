export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'tenggat.theme';
const MEDIA = '(prefers-color-scheme: dark)';

export function storedThemeMode(): ThemeMode {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
  } catch {
    return 'system';
  }
}

export function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode !== 'system') return mode;
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light';
  return window.matchMedia(MEDIA).matches ? 'dark' : 'light';
}

/** Terapkan tema ke <html> + simpan preferensi. */
export function applyTheme(mode: ThemeMode): void {
  const resolved = resolveTheme(mode);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // localStorage diblokir: tema tetap berlaku untuk sesi ini.
  }
}

export function watchSystemTheme(callback: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => undefined;
  }
  const media = window.matchMedia(MEDIA);
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
}
