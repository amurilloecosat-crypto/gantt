import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { colors, fonts } from '../theme.js';
import Logo, { PRODUCT_NAME } from '../components/Logo.jsx';
import { useI18n, tr } from '../i18n.jsx';

function friendlyAuthError(message) {
  const m = String(message || '').toLowerCase();
  if (m.includes('invalid login credentials')) return tr('Correo o contraseña incorrectos.', 'Incorrect email or password.');
  if (m.includes('already registered') || m.includes('already been registered')) return tr('Ese correo ya tiene cuenta. Inicia sesión.', 'That email already has an account. Sign in.');
  if (m.includes('email not confirmed')) return tr('Confirma tu correo para entrar. Si no lo ves, revisa tu carpeta de spam.', "Confirm your email to sign in. If you don't see it, check your spam folder.");
  if (m.includes('rate limit') || m.includes('too many')) return tr('Hay demasiados intentos. Espera unos minutos e inténtalo de nuevo.', 'Too many attempts. Wait a few minutes and try again.');
  if (m.includes('failed to fetch') || m.includes('network')) return tr('No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.', "We couldn't connect. Check your connection and try again.");
  if (m.includes('password should be at least')) return tr('La contraseña debe tener al menos 6 caracteres.', 'The password must be at least 6 characters long.');
  return tr('No pudimos completar la acción. Inténtalo de nuevo.', "We couldn't complete the action. Please try again.");
}

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 14px',
  border: `1.5px solid ${colors.inputBorder}`,
  borderRadius: '10px',
  fontFamily: fonts.body,
  fontSize: '15px',
  color: colors.text,
  marginBottom: '16px',
};

const labelStyle = {
  display: 'block',
  font: `600 13px ${fonts.body}`,
  color: colors.textMuted,
  marginBottom: '6px',
};

export default function Login() {
  const { t } = useI18n();
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setInfo('');
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(email, password);
        navigate('/', { replace: true });
      } else {
        const { needsEmailConfirmation } = await register(name, email, password);
        if (needsEmailConfirmation) {
          setInfo(t(`Te enviamos un correo a ${email}. Confírmalo para entrar. Si no lo ves, revisa tu carpeta de spam.`, `We sent an email to ${email}. Confirm it to sign in. If you don't see it, check your spam folder.`));
          setMode('login');
        } else {
          navigate('/', { replace: true });
        }
      }
    } catch (err) {
      setError(friendlyAuthError(err.message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: colors.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: fonts.body,
        padding: '20px',
      }}
    >
      <div style={{ width: '100%', maxWidth: '380px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'center', marginBottom: '28px' }}>
          <Logo size={40} />
          <div style={{ fontFamily: fonts.heading, fontWeight: 700, fontSize: '22px', color: colors.primaryDark }}>{PRODUCT_NAME}</div>
        </div>

        <div
          style={{
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: '14px',
            padding: '28px',
            boxShadow: '0 1px 3px rgba(15,26,22,.06)',
          }}
        >
          <div style={{ fontFamily: fonts.heading, fontWeight: 700, fontSize: '20px', color: colors.text, marginBottom: '4px' }}>
            {mode === 'login' ? t('Iniciar sesión', 'Sign in') : t('Crear cuenta', 'Create account')}
          </div>
          <div style={{ fontSize: '14px', color: colors.textMuted, marginBottom: '22px' }}>
            {mode === 'login' ? t('Arma el cronograma de tu propuesta y expórtalo listo para el SOW.', 'Build your proposal timeline and export it ready for the SOW.') : t('Crea tu cuenta en menos de un minuto.', 'Create your account in less than a minute.')}
          </div>

          <form onSubmit={onSubmit}>
            {mode === 'register' && (
              <div>
                <label htmlFor="login-name" style={labelStyle}>{t('Nombre', 'Name')}</label>
                <input id="login-name" style={inputStyle} type="text" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
            )}
            <div>
              <label htmlFor="login-email" style={labelStyle}>{t('Correo', 'Email')}</label>
              <input id="login-email" style={inputStyle} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label htmlFor="login-password" style={labelStyle}>{t('Contraseña', 'Password')}</label>
              <input
                id="login-password"
                style={{ ...inputStyle, marginBottom: '4px' }}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>

            {error && (
              <div style={{ color: colors.danger, fontSize: '13px', marginBottom: '12px', marginTop: '8px' }}>{error}</div>
            )}
            {info && (
              <div style={{ color: colors.primaryDark, fontSize: '13px', marginBottom: '12px', marginTop: '8px' }}>{info}</div>
            )}

            <button
              type="submit"
              disabled={busy}
              style={{
                width: '100%',
                background: colors.primaryStrong,
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                padding: '11px 0',
                font: `600 15px ${fonts.body}`,
                cursor: busy ? 'default' : 'pointer',
                opacity: busy ? 0.7 : 1,
                marginTop: '10px',
              }}
            >
              {busy ? t('Un momento...', 'One moment...') : mode === 'login' ? t('Entrar', 'Sign in') : t('Crear cuenta', 'Create account')}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '18px', fontSize: '14px', color: colors.textMuted }}>
            {mode === 'login' ? (
              <>
                {t('¿No tienes cuenta?', "Don't have an account?")}{' '}
                <button
                  onClick={() => setMode('register')}
                  style={{ background: 'none', border: 'none', color: colors.primaryDark, fontWeight: 600, cursor: 'pointer', padding: 0 }}
                >
                  {t('Regístrate', 'Sign up')}
                </button>
              </>
            ) : (
              <>
                {t('¿Ya tienes cuenta?', 'Already have an account?')}{' '}
                <button
                  onClick={() => setMode('login')}
                  style={{ background: 'none', border: 'none', color: colors.primaryDark, fontWeight: 600, cursor: 'pointer', padding: 0 }}
                >
                  {t('Inicia sesión', 'Sign in')}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
