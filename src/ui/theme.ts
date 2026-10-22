import { THEME_STORAGE_KEY } from '../config';

export type ThemeMode = 'auto' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const media = window.matchMedia('(prefers-color-scheme: dark)');

function readMode(): ThemeMode {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

export function createTheme(onChange: (theme: ResolvedTheme) => void) {
  let mode = readMode();
  let forced: ResolvedTheme | null = null;

  const resolved = (): ResolvedTheme => forced ?? (mode === 'auto' ? (media.matches ? 'dark' : 'light') : mode);

  const apply = () => {
    const theme = resolved();
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#000000' : '#f5f5f7');
    document.querySelectorAll<HTMLButtonElement>('#theme-toggle [data-value]').forEach((btn) => {
      const active = btn.dataset.value === mode;
      btn.setAttribute('aria-checked', String(active));
      btn.classList.toggle('is-active', active);
    });
    onChange(theme);
  };

  document.querySelectorAll<HTMLButtonElement>('#theme-toggle [data-value]').forEach((btn) => {
    btn.addEventListener('click', () => {
      mode = btn.dataset.value as ThemeMode;
      try {
        localStorage.setItem(THEME_STORAGE_KEY, mode);
      } catch {
        /* ignore */
      }
      apply();
    });
  });
  media.addEventListener('change', () => mode === 'auto' && apply());

  apply();

  return {
    get: resolved,
    /** Temporarily force a theme (used for printing); pass null to restore. */
    force(theme: ResolvedTheme | null) {
      forced = theme;
      apply();
    },
  };
}
