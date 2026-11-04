import React from 'react';

export const PRODUCT_NAME = 'Ariadna';

// Los colores vienen de variables (--logo-a / --logo-b) para que el logo se lea también en el tema oscuro.
export default function Logo({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label={PRODUCT_NAME} style={{ display: 'block', flexShrink: 0 }}>
      <rect x="3" y="9" width="13" height="6" rx="3" fill="var(--logo-a, #00A887)" />
      <rect x="9" y="18" width="12" height="6" rx="3" fill="var(--logo-b, #0C5641)" />
      <rect x="24" y="7" width="3" height="21" rx="1.5" fill="var(--logo-b, #0C5641)" />
      <circle cx="25.5" cy="6.5" r="3.5" fill="var(--logo-b, #0C5641)" />
    </svg>
  );
}
