// Idioma activo para código que no es un componente (api, utilidades). Sin dependencias de React.
const LANG_KEY = 'ariadna.lang';

function readStoredLang() {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'es';
  } catch (err) {
    return 'es';
  }
}

let currentLang = readStoredLang();

export function setCurrentLang(lang) {
  currentLang = lang === 'en' ? 'en' : 'es';
  try {
    if (typeof document !== 'undefined') document.documentElement.lang = currentLang;
    if (typeof window !== 'undefined') window.localStorage.setItem(LANG_KEY, currentLang);
  } catch (err) {
    // Sin almacenamiento: el idioma no se recuerda.
  }
  return currentLang;
}

export function getLang() {
  return currentLang;
}

export function getLocale() {
  return currentLang === 'en' ? 'en-US' : 'es-MX';
}

export function tr(es, en) {
  return currentLang === 'en' ? en : es;
}

if (typeof document !== 'undefined') document.documentElement.lang = currentLang;
