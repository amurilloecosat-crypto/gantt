import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

const THEME_KEY = 'ariadna.theme';

function readStoredTheme() {
  try {
    return window.localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
  } catch (err) {
    return 'light';
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

applyTheme(readStoredTheme());

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readStoredTheme);

  // persist=false permite forzar el tema claro un momento (p. ej. al exportar) sin cambiar la preferencia guardada.
  const setTheme = useCallback((next, persist = true) => {
    const value = next === 'dark' ? 'dark' : 'light';
    applyTheme(value);
    if (persist) {
      try {
        window.localStorage.setItem(THEME_KEY, value);
      } catch (err) {
        // Sin almacenamiento: el tema no se recuerda.
      }
    }
    setThemeState(value);
  }, []);

  const value = useMemo(() => ({ theme, isDark: theme === 'dark', setTheme }), [theme, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme debe usarse dentro de ThemeProvider');
  return ctx;
}
