import React, { useEffect, useRef } from 'react';
import { colors, fonts } from '../theme.js';
import { useI18n } from '../i18n.jsx';

export default function ConfirmDialog({ title, message, confirmLabel, danger = true, busy = false, onConfirm, onCancel }) {
  const { t } = useI18n();
  const cancelRef = useRef(null);

  useEffect(() => {
    if (cancelRef.current) cancelRef.current.focus();
    const onKeyDown = (e) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: colors.overlay, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 140 }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid="confirm-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{ background: colors.surface, borderRadius: '14px', padding: '28px', width: '400px', maxWidth: 'calc(100vw - 32px)', boxShadow: `0 8px 24px ${colors.shadow}` }}
      >
        <div style={{ fontFamily: fonts.heading, fontWeight: 700, fontSize: '18px', color: colors.text, marginBottom: '10px' }}>{title}</div>
        <div style={{ fontFamily: fonts.body, fontSize: '14px', color: colors.textMuted, marginBottom: '22px', lineHeight: 1.5 }}>{message}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            ref={cancelRef}
            onClick={onCancel}
            disabled={busy}
            style={{ background: 'transparent', color: colors.primaryDark, border: `1.5px solid ${colors.primary}`, borderRadius: '10px', padding: '9px 17px', font: `600 15px ${fonts.body}`, cursor: 'pointer' }}
          >
            {t('Cancelar', 'Cancel')}
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            style={{ background: danger ? '#B91C1C' : colors.primaryStrong, color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 18px', font: `600 15px ${fonts.body}`, cursor: 'pointer', opacity: busy ? 0.7 : 1 }}
          >
            {confirmLabel || t('Eliminar', 'Delete')}
          </button>
        </div>
      </div>
    </div>
  );
}
