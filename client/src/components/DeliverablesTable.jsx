import React from 'react';
import { colors, fonts } from '../theme.js';
import { useI18n } from '../i18n.jsx';

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
  onDeleteDeliverable,
  onRowDragStart,
  onRowDragOver,
  onRowDrop,
  onRowDragEnd,
}) {
  const { t } = useI18n();
  return (
    <div style={{ marginTop: '32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ fontFamily: fonts.heading, fontWeight: 700, fontSize: '18px', color: colors.text }}>{t('Entregables', 'Deliverables')}</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            data-export="add-row-btn"
            onClick={onChangeAllDeliverableColors}
            style={{ display: 'flex', alignItems: 'center', gap: '7px', background: 'transparent', color: colors.primaryDark, border: `1.5px solid ${colors.primary}`, borderRadius: '10px', padding: '8px 14px', font: `600 14px ${fonts.body}`, cursor: 'pointer' }}
          >
            <span style={{ width: '13px', height: '13px', borderRadius: '50%', background: allDelivColorDot, display: 'inline-block', flexShrink: 0 }} />
            {t('Cambiar color', 'Change color')}
          </button>
          <button
            data-export="add-row-btn"
            data-tour="add-deliverable"
            onClick={onAddDeliverable}
            style={{ background: 'transparent', color: colors.primaryDark, border: `1.5px solid ${colors.primary}`, borderRadius: '10px', padding: '8px 14px', font: `600 14px ${fonts.body}`, cursor: 'pointer' }}
          >
            {t('+ Agregar fila', '+ Add row')}
          </button>
        </div>
      </div>

      <div style={{ border: `1px solid ${colors.border}`, borderRadius: '14px', overflow: 'hidden', background: colors.surface }}>
        <div style={{ display: 'grid', gridTemplateColumns: '24px 56px 1fr', background: headerBg, color: headerFg, borderBottom: `1px solid ${colors.border}` }}>
          <div />
          <div style={{ padding: '10px 4px 10px 12px', font: `700 12px ${fonts.body}`, textTransform: 'uppercase', letterSpacing: '.03em' }}>No.</div>
          <div style={{ padding: '10px 4px', font: `700 12px ${fonts.body}`, textTransform: 'uppercase', letterSpacing: '.03em' }}>{t('Descripción Entregable', 'Deliverable Description')}</div>
        </div>

        {(deliverables || []).map((d, i) => {
          const isDragging = draggingDeliverableId === d.id;
          return (
            <div
              key={d.id}
              data-tour="deliverable-row"
              onDragOver={(e) => onRowDragOver(i, e)}
              onDrop={onRowDrop}
              style={{
                display: 'grid',
                gridTemplateColumns: '24px 56px 1fr',
                borderBottom: `1px solid ${colors.border}`,
                alignItems: 'flex-start',
                opacity: isDragging ? 0.4 : 1,
                transform: isDragging ? 'scale(1.01)' : 'none',
                boxShadow: isDragging ? `0 6px 14px ${colors.shadow}` : 'none',
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
              <div style={{ padding: '6px 8px', display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                <textarea
                  data-export="task-name"
                  rows={1}
                  ref={autosizeTextarea}
                  value={d.description}
                  placeholder={t('Describe el entregable...', 'Describe the deliverable...')}
                  onChange={(e) => onUpdateDeliverable(i, { description: e.target.value })}
                  onInput={(e) => autosizeTextarea(e.target)}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    boxSizing: 'border-box',
                    padding: '6px 8px',
                    border: `1.5px solid ${colors.inputBorder}`,
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
                <button
                  data-export="delete-row-btn"
                  className="delete-row-btn"
                  onClick={() => onDeleteDeliverable(i)}
                  title={t('Eliminar fila', 'Delete row')}
                  style={{ flexShrink: 0, width: '20px', height: '20px', padding: 0, marginTop: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', color: colors.textFaint, cursor: 'pointer', borderRadius: '5px' }}
                >
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2.5 4h11" /><path d="M6.5 4V2.5h3V4" /><path d="M4 4l.7 9h6.6L12 4" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
