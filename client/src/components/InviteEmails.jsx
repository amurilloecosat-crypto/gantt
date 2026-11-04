import React, { useState } from 'react';
import { api } from '../api';
import { colors, fonts } from '../theme.js';
import { useI18n } from '../i18n.jsx';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function InviteEmails({ invitees, onChange, excludeEmails = [], disabled = false }) {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  async function onAdd() {
    const value = email.trim().toLowerCase();
    if (!value || checking) return;
    setError('');
    if (!EMAIL_RE.test(value)) {
      setError(t('Escribe un correo electrónico válido.', 'Enter a valid email address.'));
      return;
    }
    if (excludeEmails.some((e) => e.toLowerCase() === value)) {
      setError(t('Ese usuario ya forma parte de este proyecto.', 'That user is already part of this project.'));
      return;
    }
    if (invitees.some((i) => i.email.toLowerCase() === value)) {
      setError(t('Ese correo ya está en la lista.', 'That email is already in the list.'));
      return;
    }
    setChecking(true);
    try {
      const user = await api.lookupUserByEmail(value);
      if (!user) {
        setError(t(`No se encontró un usuario con el correo ${value}.`, `No user found with the email ${value}.`));
        return;
      }
      onChange([...invitees, { userId: user.id, name: user.name, email: user.email }]);
      setEmail('');
    } catch (err) {
      setError(err.message);
    } finally {
      setChecking(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          type="email"
          placeholder={t('correo@ejemplo.com', 'email@example.com')}
          value={email}
          disabled={disabled}
          onChange={(e) => {
            setEmail(e.target.value);
            setError('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onAdd();
            }
          }}
          style={{
            flex: 1,
            minWidth: 0,
            boxSizing: 'border-box',
            padding: '9px 12px',
            border: `1.5px solid ${error ? colors.danger : colors.inputBorder}`,
            borderRadius: '10px',
            fontFamily: fonts.body,
            fontSize: '14px',
            color: colors.text,
          }}
        />
        <button
          type="button"
          onClick={onAdd}
          disabled={disabled || checking || !email.trim()}
          style={{
            background: colors.primaryStrong,
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            padding: '9px 16px',
            font: `600 14px ${fonts.body}`,
            cursor: disabled || checking || !email.trim() ? 'default' : 'pointer',
            opacity: disabled || checking || !email.trim() ? 0.6 : 1,
            whiteSpace: 'nowrap',
          }}
        >
          {checking ? t('Buscando...', 'Searching...') : t('Agregar', 'Add')}
        </button>
      </div>
      {error && <div style={{ color: colors.danger, fontFamily: fonts.body, fontSize: '13px', marginTop: '6px' }}>{error}</div>}

      {invitees.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '12px', maxHeight: '160px', overflowY: 'auto' }}>
          {invitees.map((i) => (
            <div
              key={i.userId}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 10px', background: colors.primaryTint, borderRadius: '8px' }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontFamily: fonts.body, fontWeight: 600, fontSize: '13px', color: colors.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{i.name}</div>
                <div style={{ fontFamily: fonts.body, fontSize: '12px', color: colors.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{i.email}</div>
              </div>
              <button
                type="button"
                title={t('Quitar', 'Remove')}
                disabled={disabled}
                onClick={() => onChange(invitees.filter((x) => x.userId !== i.userId))}
                style={{ border: 'none', background: 'transparent', color: colors.textMuted, cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '2px 6px' }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
