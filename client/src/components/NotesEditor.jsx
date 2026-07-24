import React, { useRef } from 'react';
import { colors, fonts } from '../theme.js';

const toolBtnStyle = {
  width: '28px',
  height: '28px',
  border: 'none',
  background: 'transparent',
  borderRadius: '6px',
  cursor: 'pointer',
  color: colors.textMuted,
};

export default function NotesEditor({ initialHtml, attachmentName, onBlurSave, onAttach }) {
  const notesRef = useRef(null);
  const fileInputRef = useRef(null);

  function exec(command) {
    if (notesRef.current) notesRef.current.focus();
    document.execCommand(command, false, null);
  }

  function handleBlur() {
    if (!notesRef.current) return;
    onBlurSave(notesRef.current.innerHTML);
  }

  function handleFileChange(e) {
    const file = e.target.files && e.target.files[0];
    if (file) onAttach(file.name);
  }

  return (
    <div style={{ maxWidth: '640px', marginBottom: '18px' }}>
      <label style={{ display: 'block', font: `600 13px ${fonts.body}`, color: colors.textMuted, marginBottom: '6px' }}>Notas</label>
      <div style={{ border: `1.5px solid ${colors.border}`, borderRadius: '10px', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '6px 8px', background: colors.bg, borderBottom: `1px solid ${colors.border}` }}>
          <button onMouseDown={(e) => { e.preventDefault(); exec('bold'); }} title="Negritas" style={{ ...toolBtnStyle, font: `700 14px ${fonts.body}`, color: colors.text }}>B</button>
          <button onMouseDown={(e) => { e.preventDefault(); exec('italic'); }} title="Cursiva" style={{ ...toolBtnStyle, font: `italic 700 14px ${fonts.body}`, color: colors.text }}>I</button>
          <button onMouseDown={(e) => { e.preventDefault(); exec('underline'); }} title="Subrayado" style={{ ...toolBtnStyle, font: `700 14px ${fonts.body}`, color: colors.text, textDecoration: 'underline' }}>U</button>
          <div style={{ width: '1px', height: '18px', background: colors.border, margin: '0 4px' }} />
          <button onMouseDown={(e) => { e.preventDefault(); exec('justifyLeft'); }} title="Alinear izquierda" style={toolBtnStyle}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><line x1="2" y1="4" x2="14" y2="4" /><line x1="2" y1="8" x2="10" y2="8" /><line x1="2" y1="12" x2="12" y2="12" /></svg>
          </button>
          <button onMouseDown={(e) => { e.preventDefault(); exec('justifyCenter'); }} title="Centrar" style={toolBtnStyle}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><line x1="2" y1="4" x2="14" y2="4" /><line x1="4" y1="8" x2="12" y2="8" /><line x1="3" y1="12" x2="13" y2="12" /></svg>
          </button>
          <button onMouseDown={(e) => { e.preventDefault(); exec('justifyRight'); }} title="Alinear derecha" style={toolBtnStyle}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><line x1="2" y1="4" x2="14" y2="4" /><line x1="6" y1="8" x2="14" y2="8" /><line x1="4" y1="12" x2="14" y2="12" /></svg>
          </button>
          <button onMouseDown={(e) => { e.preventDefault(); exec('justifyFull'); }} title="Justificar" style={toolBtnStyle}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><line x1="2" y1="4" x2="14" y2="4" /><line x1="2" y1="8" x2="14" y2="8" /><line x1="2" y1="12" x2="14" y2="12" /></svg>
          </button>
          <div style={{ width: '1px', height: '18px', background: colors.border, margin: '0 4px' }} />
          <button onMouseDown={(e) => { e.preventDefault(); exec('insertUnorderedList'); }} title="Viñetas" style={toolBtnStyle}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              <circle cx="3" cy="4" r="1" fill="currentColor" stroke="none" /><line x1="6" y1="4" x2="14" y2="4" />
              <circle cx="3" cy="8" r="1" fill="currentColor" stroke="none" /><line x1="6" y1="8" x2="14" y2="8" />
              <circle cx="3" cy="12" r="1" fill="currentColor" stroke="none" /><line x1="6" y1="12" x2="14" y2="12" />
            </svg>
          </button>
          <div style={{ flex: 1 }} />
          <button onClick={() => fileInputRef.current && fileInputRef.current.click()} title="Cargar archivo" style={toolBtnStyle}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M11 6.5V11a3 3 0 0 1-6 0V4.5a2 2 0 0 1 4 0V10" /></svg>
          </button>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} />
        </div>
        <div
          contentEditable
          ref={notesRef}
          onBlur={handleBlur}
          suppressContentEditableWarning
          dangerouslySetInnerHTML={{ __html: initialHtml || '' }}
          style={{ minHeight: '100px', padding: '12px 14px', fontFamily: fonts.body, fontSize: '14px', color: colors.text, outline: 'none' }}
          data-placeholder="Escribe notas del proyecto..."
        />
        {attachmentName && (
          <div style={{ padding: '6px 14px 10px', fontFamily: fonts.body, fontSize: '12px', color: colors.textMuted }}>
            Adjunto: {attachmentName}
          </div>
        )}
      </div>
    </div>
  );
}
