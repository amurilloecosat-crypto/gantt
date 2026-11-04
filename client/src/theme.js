// Los colores son variables CSS: cambian solas con data-theme (ver styles/global.css).
export const colors = {
  bg: 'var(--c-bg)',
  surface: 'var(--c-surface)',
  border: 'var(--c-border)',
  inputBorder: 'var(--c-input-border)',
  primary: 'var(--c-primary)',
  primaryDark: 'var(--c-primary-dark)',
  primaryStrong: 'var(--c-primary-strong)',
  primaryTint: 'var(--c-primary-tint)',
  text: 'var(--c-text)',
  textMuted: 'var(--c-text-muted)',
  textFaint: 'var(--c-text-faint)',
  danger: 'var(--c-danger)',
  dangerBg: 'var(--c-danger-bg)',
  overlay: 'var(--c-overlay)',
  hover: 'var(--c-hover)',
  shadow: 'var(--c-shadow)',
};

// Valores reales de la superficie, para mezclas calculadas en JS (tintes de filas).
export const surfaceHex = { light: '#FFFFFF', dark: '#151E1A' };

export const fonts = {
  heading: "'Montserrat', sans-serif",
  body: "'Inter', system-ui, sans-serif",
};

export const BAR_COLORS = ['#00A887', '#2563EB', '#7C3AED', '#D97706', '#DC2626', '#0EA5E9'];
