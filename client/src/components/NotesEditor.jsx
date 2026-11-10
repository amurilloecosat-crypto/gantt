import React, { useEffect, useRef, useState } from 'react';
import { colors, fonts } from '../theme.js';
import { useI18n } from '../i18n.jsx';
import { api } from '../api';
import { stripHtml } from '../collab.js';
import ConfirmDialog from './ConfirmDialog.jsx';

// Compara notas y plantilla ignorando espacios y saltos de línea sobrantes.
const normalize = (html) =>
  String(html || '')
    .replace(/\u00a0/g, ' ')
    .replace(/>\s+</g, '><')
    .replace(/\s+/g, ' ')
    .replace(/(<br\s*\/?>)+$/i, '')
    .trim();

// Si las notas ya terminan en un bloque (lista, párrafo…), no hace falta un salto antes de agregar la plantilla.
const endsWithBlock = /(<\/(ul|ol|p|div|h[1-6])>|<br\s*\/?>)\s*$/i;

const pillStyle = (kind, disabled) => ({
  padding: '5px 12px',
  borderRadius: '8px',
  font: `600 13px ${fonts.body}`,
  cursor: disabled ? 'default' : 'pointer',
  opacity: disabled ? 0.5 : 1,
  whiteSpace: 'nowrap',
  ...(kind === 'primary'
    ? { background: colors.primaryStrong, color: '#fff', border: 'none' }
    : { background: 'transparent', color: colors.primaryDark, border: `1.5px solid ${colors.primary}` }),
});

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
  const [template, setTemplate] = useState(undefined); // undefined = cargando, null = sin plantilla
  const [current, setCurrent] = useState(initialHtml || '');
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState(null);
  const [askInsert, setAskInsert] = useState(false);
  const [askSave, setAskSave] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .getNotesTemplate()
      .then((html) => !cancelled && setTemplate(html))
      .catch(() => !cancelled && setTemplate(null));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setCurrent(initialHtml || '');
  }, [initialHtml]);

  useEffect(() => {
    if (!note) return undefined;
    const timer = setTimeout(() => setNote(null), 4500);
    return () => clearTimeout(timer);
  }, [note]);

  useEffect(() => {
    if (!askInsert) return undefined;
    const onKey = (e) => e.key === 'Escape' && setAskInsert(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [askInsert]);

  const hasTemplate = typeof template === 'string' && stripHtml(template).length > 0;
  const hasText = stripHtml(current).length > 0;
  const dirty = hasTemplate && normalize(current) !== normalize(template);
  // Con notas vacías nunca se puede guardar: evita borrar la plantilla por accidente.
  const canSave = !saving && template !== undefined && hasText && (hasTemplate ? dirty : true);

  function applyHtml(html) {
    const el = notesRef.current;
    if (!el) return;
    el.innerHTML = html;
    setCurrent(html);
    onBlurSave(html);
  }

  function onUseTemplate() {
    if (!hasTemplate) return;
    if (hasText) setAskInsert(true);
    else applyHtml(template);
  }

  async function doSave() {
    const html = notesRef.current ? notesRef.current.innerHTML : current;
    setSaving(true);
    setNote(null);
    try {
      await api.saveNotesTemplate(html);
      setTemplate(html);
      setNote({ type: 'ok', text: t('Plantilla guardada', 'Template saved') });
    } catch (err) {
      setNote({ type: 'error', text: t('No se pudo guardar la plantilla', "Couldn't save the template") });
    } finally {
      setSaving(false);
      setAskSave(false);
    }
  }

  function onSave() {
    if (hasTemplate) setAskSave(true);
    else doSave();
  }

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
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <span
              role="status"
              aria-live="polite"
              data-testid="notes-template-status"
              style={{ font: `500 12px ${fonts.body}`, color: note && note.type === 'error' ? colors.danger : colors.primaryDark }}
            >
              {note ? note.text : ''}
            </span>
            <button
              type="button"
              data-testid="notes-use-template"
              disabled={!hasTemplate}
              onClick={onUseTemplate}
              title={
                hasTemplate
                  ? t('Inserta tu plantilla de notas', 'Insert your notes template')
                  : t('Aún no tienes plantilla: escribe tus notas y usa «Guardar como plantilla».', 'You have no template yet: write your notes and use "Save as template".')
              }
              style={pillStyle('secondary', !hasTemplate)}
            >
              {t('Utilizar plantilla', 'Use template')}
            </button>
            <button
              type="button"
              data-testid="notes-save-template"
              disabled={!canSave}
              onClick={onSave}
              title={
                hasTemplate
                  ? dirty
                    ? t('Reemplaza tu plantilla con estas notas', 'Replace your template with these notes')
                    : t('Las notas coinciden con tu plantilla', 'The notes match your template')
                  : t('Guarda estas notas como tu plantilla', 'Save these notes as your template')
              }
              style={pillStyle('primary', !canSave)}
            >
              {saving ? t('Guardando…', 'Saving…') : hasTemplate ? t('Guardar', 'Save') : t('Guardar como plantilla', 'Save as template')}
            </button>
          </div>
        </div>
        <div
          contentEditable
          ref={notesRef}
          onBlur={handleBlur}
          onInput={(e) => setCurrent(e.currentTarget.innerHTML)}
          suppressContentEditableWarning
          dangerouslySetInnerHTML={{ __html: initialHtml || '' }}
          style={{ minHeight: '100px', padding: '12px 14px', fontFamily: fonts.body, fontSize: '14px', color: colors.text }}
          data-placeholder={t('Alcance, supuestos, exclusiones...', 'Scope, assumptions, exclusions...')}
        />
      </div>

      {askInsert && (
        <div
          onClick={() => setAskInsert(false)}
          style={{ position: 'fixed', inset: 0, background: colors.overlay, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 140 }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t('Utilizar plantilla', 'Use template')}
            data-testid="notes-insert-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{ background: colors.surface, borderRadius: '14px', padding: '28px', width: '420px', maxWidth: 'calc(100vw - 32px)', boxShadow: `0 8px 24px ${colors.shadow}` }}
          >
            <div style={{ fontFamily: fonts.heading, fontWeight: 700, fontSize: '18px', color: colors.text, marginBottom: '10px' }}>{t('Utilizar plantilla', 'Use template')}</div>
            <div style={{ fontFamily: fonts.body, fontSize: '14px', color: colors.textMuted, marginBottom: '22px', lineHeight: 1.5 }}>
              {t('Tus notas ya tienen texto. ¿Qué quieres hacer?', 'Your notes already have text. What do you want to do?')}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setAskInsert(false)} style={{ ...pillStyle('secondary', false), padding: '9px 16px', fontSize: '14px' }}>{t('Cancelar', 'Cancel')}</button>
              <button
                type="button"
                data-testid="notes-insert-append"
                onClick={() => {
                  setAskInsert(false);
                  applyHtml(current + (endsWithBlock.test(current) ? '' : '<br>') + template);
                }}
                style={{ ...pillStyle('secondary', false), padding: '9px 16px', fontSize: '14px' }}
              >
                {t('Agregar al final', 'Add at the end')}
              </button>
              <button
                type="button"
                data-testid="notes-insert-replace"
                onClick={() => {
                  setAskInsert(false);
                  applyHtml(template);
                }}
                style={{ ...pillStyle('primary', false), padding: '10px 16px', fontSize: '14px' }}
              >
                {t('Reemplazar', 'Replace')}
              </button>
            </div>
          </div>
        </div>
      )}

      {askSave && (
        <ConfirmDialog
          title={t('Actualizar plantilla', 'Update template')}
          message={t('Esto reemplaza tu plantilla actual con las notas de este proyecto.', "This replaces your current template with this project's notes.")}
          confirmLabel={t('Guardar', 'Save')}
          danger={false}
          busy={saving}
          onConfirm={doSave}
          onCancel={() => setAskSave(false)}
        />
      )}
    </div>
  );
}
