import React from 'react';
import { colors, fonts } from '../theme.js';
import Logo, { PRODUCT_NAME } from './Logo.jsx';
import UserMenu from './UserMenu.jsx';

export default function Header() {
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
        <Logo size={34} />
        <div style={{ fontFamily: fonts.heading, fontWeight: 700, fontSize: '18px', color: colors.primaryDark }}>{PRODUCT_NAME}</div>
      </div>
      <UserMenu />
    </div>
  );
}
