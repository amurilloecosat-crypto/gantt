import React from 'react';
import { useAuth } from '../AuthContext.jsx';
import { colors, fonts } from '../theme.js';

export default function Header() {
  const { user, logout } = useAuth();
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        padding: '20px 32px',
        background: colors.surface,
        borderBottom: `1px solid ${colors.border}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: colors.primary }} />
        <div style={{ fontFamily: fonts.heading, fontWeight: 700, fontSize: '18px', color: colors.primaryDark }}>GanttNoso</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {user && <span style={{ fontFamily: fonts.body, fontSize: '14px', color: colors.textMuted }}>{user.name}</span>}
        <button
          onClick={logout}
          style={{
            background: 'transparent',
            border: `1.5px solid ${colors.border}`,
            color: colors.textMuted,
            borderRadius: '10px',
            padding: '8px 14px',
            font: `600 13px ${fonts.body}`,
            cursor: 'pointer',
          }}
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
