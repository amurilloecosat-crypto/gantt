import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../AuthContext.jsx';
import { useI18n } from '../i18n.jsx';
import { useTheme } from '../ThemeContext.jsx';
import { useOnboarding } from '../onboarding/OnboardingContext.jsx';
import { colors, fonts } from '../theme.js';

function Segmented({ label, options, value, onChange }) {
  return (
    <div style={{ padding: '10px 14px 4px' }}>
      <div style={{ font: `600 12px ${fonts.body}`, color: colors.textMuted, marginBottom: '6px' }}>{label}</div>
      <div role="group" aria-label={label} style={{ display: 'flex', gap: '4px', padding: '3px', borderRadius: '10px', background: colors.bg }}>
        {options.map((opt) => {
          const selected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={selected}
              data-testid={opt.testId}
              onClick={() => onChange(opt.value)}
              style={{
                flex: 1,
                padding: '7px 10px',
                border: 'none',
                borderRadius: '8px',
                background: selected ? colors.surface : 'transparent',
                boxShadow: selected ? `0 1px 3px ${colors.shadow}` : 'none',
                color: selected ? colors.primaryDark : colors.textMuted,
                font: `600 13px ${fonts.body}`,
                cursor: 'pointer',
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function UserMenu() {
  const { user, logout } = useAuth();
  const { lang, setLang, t } = useI18n();
  const { theme, setTheme } = useTheme();
  const { active: tourActive, startTour } = useOnboarding();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    // Durante el tutorial el menú se queda abierto: lo cierra el propio recorrido al terminar.
    const onMouseDown = (e) => {
      if (tourActive) return;
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => {
      if (tourActive) return;
      if (e.key === 'Escape') {
        setOpen(false);
        if (buttonRef.current) buttonRef.current.focus();
      }
    };
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, tourActive]);

  useEffect(() => {
    if (!tourActive) setOpen(false);
  }, [tourActive]);

  if (!user) return null;

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        ref={buttonRef}
        type="button"
        data-testid="user-menu-button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          background: open ? colors.hover : 'transparent',
          border: `1.5px solid ${colors.inputBorder}`,
          borderRadius: '10px',
          color: colors.text,
          font: `600 14px ${fonts.body}`,
          cursor: 'pointer',
          maxWidth: '240px',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .12s ease' }}>
          <path d="M2.5 4.5 L6 8 L9.5 4.5" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          data-testid="user-menu"
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 8px)',
            width: '260px',
            maxWidth: 'calc(100vw - 32px)',
            padding: '6px 0 6px',
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: '12px',
            boxShadow: `0 8px 24px ${colors.shadow}`,
            zIndex: 150,
          }}
        >
          <div style={{ padding: '8px 14px 10px', borderBottom: `1px solid ${colors.border}` }}>
            <div style={{ font: `700 14px ${fonts.body}`, color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
            <div style={{ font: `400 12px ${fonts.body}`, color: colors.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
          </div>
          <Segmented
            label={t('Idioma', 'Language')}
            value={lang}
            onChange={setLang}
            options={[
              { value: 'es', label: 'Español', testId: 'lang-es' },
              { value: 'en', label: 'English', testId: 'lang-en' },
            ]}
          />
          <Segmented
            label={t('Tema', 'Theme')}
            value={theme}
            onChange={(v) => setTheme(v)}
            options={[
              { value: 'light', label: t('Claro', 'Light'), testId: 'theme-light' },
              { value: 'dark', label: t('Oscuro', 'Dark'), testId: 'theme-dark' },
            ]}
          />
          <div style={{ height: '1px', background: colors.border, margin: '10px 0 6px' }} />
          <button
            type="button"
            role="menuitem"
            data-tour="repeat-tutorial"
            data-testid="repeat-tutorial"
            onClick={() => {
              setOpen(false);
              startTour();
            }}
            style={{ display: 'block', width: '100%', padding: '9px 14px', border: 'none', background: 'transparent', textAlign: 'left', font: `500 14px ${fonts.body}`, color: colors.text, cursor: 'pointer' }}
          >
            {t('Repetir tutorial', 'Repeat tutorial')}
          </button>
          <button
            type="button"
            role="menuitem"
            data-testid="logout"
            onClick={logout}
            style={{ display: 'block', width: '100%', padding: '9px 14px', border: 'none', background: 'transparent', textAlign: 'left', font: `500 14px ${fonts.body}`, color: colors.text, cursor: 'pointer' }}
          >
            {t('Cerrar sesión', 'Sign out')}
          </button>
        </div>
      )}
    </div>
  );
}
