import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { getLang, getLocale, setCurrentLang, tr } from './lang.js';

// Para código fuera de React (api, utilidades): getLang / getLocale / tr leen el idioma activo.
export { getLang, getLocale, tr };

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(getLang);

  const setLang = useCallback((next) => {
    setLangState(setCurrentLang(next));
  }, []);

  const value = useMemo(
    () => ({
      lang,
      locale: lang === 'en' ? 'en-US' : 'es-MX',
      setLang,
      t: (es, en) => (lang === 'en' ? en : es),
    }),
    [lang, setLang]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

// t('Texto en español', 'English text') devuelve el que corresponde al idioma activo.
export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n debe usarse dentro de I18nProvider');
  return ctx;
}
