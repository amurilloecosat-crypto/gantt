import React from 'react';
import { BAR_COLORS } from '../ganttUtils.js';

export default function ColorPicker({ position, onSelect, onClose }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 150 }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: position.y + 'px',
          left: position.x + 'px',
          background: '#FFFFFF',
          border: '1px solid #E2E8E5',
          borderRadius: '10px',
          padding: '10px',
          boxShadow: '0 8px 20px rgba(15,26,22,.18)',
          zIndex: 200,
          display: 'flex',
          gap: '6px',
        }}
      >
        {BAR_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => onSelect(c)}
            style={{ width: '22px', height: '22px', borderRadius: '50%', background: c, border: 'none', cursor: 'pointer' }}
          />
        ))}
      </div>
    </div>
  );
}
