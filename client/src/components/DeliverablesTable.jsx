import React from 'react';
import { colors, fonts } from '../theme.js';

function autosizeTextarea(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

export default function DeliverablesTable({
  deliverables,
  draggingDeliverableId,
  headerBg,
  headerFg,
  onChangeAllDeliverableColors,
  allDelivColorDot,
  onAddDeliverable,
  onUpdateDeliverable,
  onRowDragStart,
  onRowDragOver,
  onRowDrop,
  onRowDragEnd,
}) {
  return (
    <div style={{ marginTop: '32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ fontFamily: fonts.heading, fontWeight: 700, fontSize: '18px', color: colors.text }}>Entregables</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            data-export="add-row-btn"
            onClick={onChangeAllDeliverableColors}
            style={{ display: 'flex', alignItems: 'center', gap: '7px', background: 'transparent', color: colors.primaryDark, border: `1.5px solid ${colors.primary}`, borderRadius: '10px', padding: '8px 14px', font: `600 14px ${fonts.body}`, cursor: 'pointer' }}
          >
            <span style={{ width: '13px', height: '13px', borderRadius: '50%', background: allDelivColorDot, display: 'inline-block', flexShrink: 0 }} />
            Cambiar color
          </button>
          <button
            data-export="add-row-btn"
            onClick={onAddDeliverable}
            style={{ background: 'transparent', color: colors.primaryDark, border: `1.5px solid ${colors.primary}`, borderRadius: '10px', padding: '8px 14px', font: `600 14px ${fonts.body}`, cursor: 'pointer' }}
          >
            + Agregar fila
          </button>
        </div>
      </div>

      <div style={{ border: `1px solid ${colors.border}`, borderRadius: '14px', overflow: 'hidden', background: colors.surface }}>
        <div style={{ display: 'grid', gridTemplateColumns: '24px 56px 1fr', background: headerBg, color: headerFg, borderBottom: `1px solid ${colors.border}` }}>
          <div />
          <div style={{ padding: '10px 4px 10px 12px', font: `700 12px ${fonts.body}`, textTransform: 'uppercase', letterSpacing: '.03em' }}>No.</div>
          <div style={{ padding: '10px 4px', font: `700 12px ${fonts.body}`, textTransform: 'uppercase', letterSpacing: '.03em' }}>Descripción Entregable</div>
        </div>

        {(deliverables || []).map((d, i) => {
          const isDragging = draggingDeliverableId === d.id;
          return (
            <div
              key={d.id}
              onDragOver={(e) => onRowDragOver(i, e)}
              onDrop={onRowDrop}
              style={{
                display: 'grid',
                gridTemplateColumns: '24px 56px 1fr',
                borderBottom: `1px solid ${colors.border}`,
                alignItems: 'flex-start',
                opacity: isDragging ? 0.4 : 1,
                transform: isDragging ? 'scale(1.01)' : 'none',
                boxShadow: isDragging ? '0 6px 14px rgba(15,26,22,.15)' : 'none',
                transition: 'transform .15s ease, opacity .15s ease, box-shadow .15s ease',
                background: isDragging ? colors.surface : 'transparent',
              }}
            >
              <div
                data-export="drag-handle"
                draggable
                onDragStart={(e) => onRowDragStart(i, e)}
                onDragEnd={onRowDragEnd}
                style={{ cursor: 'grab', padding: '10px 6px', color: colors.textFaint }}
              >
                <svg width="14" height="24" viewBox="0 0 14 24" fill="currentColor">
                  <circle cx="4" cy="6" r="1.5" /><circle cx="10" cy="6" r="1.5" />
                  <circle cx="4" cy="12" r="1.5" /><circle cx="10" cy="12" r="1.5" />
                  <circle cx="4" cy="18" r="1.5" /><circle cx="10" cy="18" r="1.5" />
                </svg>
              </div>
              <div style={{ padding: '10px 4px 10px 4px', fontFamily: fonts.body, fontSize: '14px', color: colors.textMuted, fontWeight: 600, alignSelf: 'center', textAlign: 'center' }}>
                {i + 1}
              </div>
              <div style={{ padding: '6px 8px' }}>
                <textarea
                  data-export="task-name"
                  rows={1}
                  ref={autosizeTextarea}
                  value={d.description}
                  placeholder="Describe el entregable..."
                  onChange={(e) => onUpdateDeliverable(i, { description: e.target.value })}
                  onInput={(e) => autosizeTextarea(e.target)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '6px 8px',
                    border: `1.5px solid ${colors.border}`,
                    borderRadius: '8px',
                    fontFamily: fonts.body,
                    fontSize: '14px',
                    color: colors.text,
                    resize: 'none',
                    overflow: 'hidden',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    lineHeight: '1.3',
                    minHeight: '32px',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
