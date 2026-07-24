import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { colors, fonts } from '../theme.js';

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 14px',
  border: `1.5px solid ${colors.border}`,
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
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(name, email, password);
      }
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Ocurrió un error');
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
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: colors.primary }} />
          <div style={{ fontFamily: fonts.heading, fontWeight: 700, fontSize: '20px', color: colors.primaryDark }}>Sidón</div>
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
            {mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
          </div>
          <div style={{ fontSize: '14px', color: colors.textMuted, marginBottom: '22px' }}>
            {mode === 'login' ? 'Gestiona tus Gantts en un solo lugar.' : 'Regístrate para empezar a crear tus Gantts.'}
          </div>

          <form onSubmit={onSubmit}>
            {mode === 'register' && (
              <div>
                <label style={labelStyle}>Nombre</label>
                <input style={inputStyle} type="text" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
            )}
            <div>
              <label style={labelStyle}>Correo</label>
              <input style={inputStyle} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label style={labelStyle}>Contraseña</label>
              <input
                style={{ ...inputStyle, marginBottom: '4px' }}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>

            {error && (
              <div style={{ color: '#DC2626', fontSize: '13px', marginBottom: '12px', marginTop: '8px' }}>{error}</div>
            )}

            <button
              type="submit"
              disabled={busy}
              style={{
                width: '100%',
                background: colors.primary,
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
              {busy ? 'Un momento...' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '18px', fontSize: '14px', color: colors.textMuted }}>
            {mode === 'login' ? (
              <>
                ¿No tienes cuenta?{' '}
                <button
                  onClick={() => setMode('register')}
                  style={{ background: 'none', border: 'none', color: colors.primaryDark, fontWeight: 600, cursor: 'pointer', padding: 0 }}
                >
                  Regístrate
                </button>
              </>
            ) : (
              <>
                ¿Ya tienes cuenta?{' '}
                <button
                  onClick={() => setMode('login')}
                  style={{ background: 'none', border: 'none', color: colors.primaryDark, fontWeight: 600, cursor: 'pointer', padding: 0 }}
                >
                  Inicia sesión
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
