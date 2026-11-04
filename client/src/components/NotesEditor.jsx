import React, { useRef } from 'react';
import { colors, fonts } from '../theme.js';
import { useI18n } from '../i18n.jsx';

const toolBtnStyle = {
  width: '28px',
  height: '28px',
  border: 'none',
  background: 'transparent',
  borderRadius: '6px',
  cursor: 'pointer',
  color: colors.textMuted,
};

export default function NotesEditor({ initialHtml, onBlurSave }) {
  const { t } = useI18n();
  const notesRef = useRef(null);

  function exec(command) {
    if (notesRef.current) notesRef.current.focus();
    document.execCommand(command, false, null);
  }

  function handleBlur() {
    if (!notesRef.current) return;
    onBlurSave(notesRef.current.innerHTML);
  }

  return (
    <div data-export="notes-wrap" style={{ maxWidth: '1150px', marginBottom: '18px' }}>
      <label style={{ display: 'block', font: `600 13px ${fonts.body}`, color: colors.textMuted, marginBottom: '6px' }}>{t('Notas', 'Notes')}<span data-export="notes-hint" style={{ fontWeight: 400 }}> {t('(se incluyen en la exportación)', '(included in the export)')}</span></label>
      <div data-export="notes-box" style={{ border: `1.5px solid ${colors.inputBorder}`, borderRadius: '10px', overflow: 'hidden' }}>
        <div data-export="notes-toolbar" style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '6px 8px', background: colors.bg, borderBottom: `1px solid ${colors.border}` }}>
          <button onMouseDown={(e) => { e.preventDefault(); exec('bold'); }} title={t('Negritas', 'Bold')} style={{ ...toolBtnStyle, font: `700 14px ${fonts.body}`, color: colors.text }}>B</button>
          <button onMouseDown={(e) => { e.preventDefault(); exec('italic'); }} title={t('Cursiva', 'Italic')} style={{ ...toolBtnStyle, font: `italic 700 14px ${fonts.body}`, color: colors.text }}>I</button>
          <button onMouseDown={(e) => { e.preventDefault(); exec('underline'); }} title={t('Subrayado', 'Underline')} style={{ ...toolBtnStyle, font: `700 14px ${fonts.body}`, color: colors.text, textDecoration: 'underline' }}>U</button>
          <div style={{ width: '1px', height: '18px', background: colors.border, margin: '0 4px' }} />
          <button onMouseDown={(e) => { e.preventDefault(); exec('justifyLeft'); }} title={t('Alinear izquierda', 'Align left')} style={toolBtnStyle}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><line x1="2" y1="4" x2="14" y2="4" /><line x1="2" y1="8" x2="10" y2="8" /><line x1="2" y1="12" x2="12" y2="12" /></svg>
          </button>
          <button onMouseDown={(e) => { e.preventDefault(); exec('justifyCenter'); }} title={t('Centrar', 'Center')} style={toolBtnStyle}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><line x1="2" y1="4" x2="14" y2="4" /><line x1="4" y1="8" x2="12" y2="8" /><line x1="3" y1="12" x2="13" y2="12" /></svg>
          </button>
          <button onMouseDown={(e) => { e.preventDefault(); exec('justifyRight'); }} title={t('Alinear derecha', 'Align right')} style={toolBtnStyle}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><line x1="2" y1="4" x2="14" y2="4" /><line x1="6" y1="8" x2="14" y2="8" /><line x1="4" y1="12" x2="14" y2="12" /></svg>
          </button>
          <button onMouseDown={(e) => { e.preventDefault(); exec('justifyFull'); }} title={t('Justificar', 'Justify')} style={toolBtnStyle}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><line x1="2" y1="4" x2="14" y2="4" /><line x1="2" y1="8" x2="14" y2="8" /><line x1="2" y1="12" x2="14" y2="12" /></svg>
          </button>
          <div style={{ width: '1px', height: '18px', background: colors.border, margin: '0 4px' }} />
          <button onMouseDown={(e) => { e.preventDefault(); exec('insertUnorderedList'); }} title={t('Viñetas', 'Bullets')} style={toolBtnStyle}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              <circle cx="3" cy="4" r="1" fill="currentColor" stroke="none" /><line x1="6" y1="4" x2="14" y2="4" />
              <circle cx="3" cy="8" r="1" fill="currentColor" stroke="none" /><line x1="6" y1="8" x2="14" y2="8" />
              <circle cx="3" cy="12" r="1" fill="currentColor" stroke="none" /><line x1="6" y1="12" x2="14" y2="12" />
            </svg>
          </button>
        </div>
        <div
          contentEditable
          ref={notesRef}
          onBlur={handleBlur}
          suppressContentEditableWarning
          dangerouslySetInnerHTML={{ __html: initialHtml || '' }}
          style={{ minHeight: '100px', padding: '12px 14px', fontFamily: fonts.body, fontSize: '14px', color: colors.text }}
          data-placeholder={t('Alcance, supuestos, exclusiones...', 'Scope, assumptions, exclusions...')}
        />
      </div>
    </div>
  );
}
