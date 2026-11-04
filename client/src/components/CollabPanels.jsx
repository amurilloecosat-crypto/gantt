import React, { useCallback, useEffect, useState } from 'react';
import InviteEmails from './InviteEmails.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import { api } from '../api';
import { supabase } from '../supabaseClient';
import { colors, fonts } from '../theme.js';
import { useI18n } from '../i18n.jsx';

const overlayStyle = { position: 'fixed', inset: 0, background: colors.overlay, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 130 };
const dialogStyle = { background: colors.surface, borderRadius: '14px', padding: '28px', width: '460px', maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column', boxShadow: `0 8px 24px ${colors.shadow}` };
const titleStyle = { fontFamily: fonts.heading, fontWeight: 700, fontSize: '18px', color: colors.text, marginBottom: '16px' };
const closeButtonStyle = { background: 'transparent', color: colors.primaryDark, border: `1.5px solid ${colors.primary}`, borderRadius: '10px', padding: '9px 17px', font: `600 15px ${fonts.body}`, cursor: 'pointer' };

function formatWhen(iso, locale) {
  const d = new Date(iso);
  return d.toLocaleString(locale, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function MembersModal({ projectId, isOwner, onClose, onChanged }) {
  const { t } = useI18n();
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !document.querySelector('[data-testid="confirm-dialog"]') && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [invitees, setInvitees] = useState([]);
  const [saving, setSaving] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);

  const load = useCallback(() => {
    return api
      .listMembers(projectId)
      .then((list) => {
        setMembers(list);
        if (onChanged) onChanged(list);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [projectId, onChanged]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function onAddInvitees() {
    if (!invitees.length) return;
    setSaving(true);
    setError('');
    try {
      await api.addMembers(projectId, invitees.map((i) => i.userId));
      setInvitees([]);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function onRemove() {
    const member = removeTarget;
    if (!member) return;
    setError('');
    try {
      await api.removeMember(projectId, member.userId);
      setRemoveTarget(null);
      await load();
    } catch (err) {
      setRemoveTarget(null);
      setError(err.message);
    }
  }

  return (
    <div onClick={onClose} style={overlayStyle}>
      <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} style={dialogStyle}>
        <div style={titleStyle}>{t('Colaboradores', 'Collaborators')}</div>
        {loading ? (
          <div style={{ color: colors.textMuted, fontFamily: fonts.body }}>{t('Cargando...', 'Loading...')}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto', marginBottom: '16px' }}>
            {members.map((m) => (
              <div key={m.userId} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: colors.primaryTint, borderRadius: '8px' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontFamily: fonts.body, fontWeight: 600, fontSize: '13px', color: colors.text }}>
                    {m.name}
                    {m.isOwner && <span style={{ marginLeft: '8px', fontWeight: 600, fontSize: '11px', color: colors.primaryDark }}>{t('PROPIETARIO', 'OWNER')}</span>}
                  </div>
                  <div style={{ fontFamily: fonts.body, fontSize: '12px', color: colors.textMuted }}>{m.email}</div>
                </div>
                {isOwner && !m.isOwner && (
                  <button
                    onClick={() => setRemoveTarget(m)}
                    style={{ border: 'none', background: 'transparent', color: colors.danger, font: `600 12px ${fonts.body}`, cursor: 'pointer' }}
                  >
                    {t('Quitar', 'Remove')}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {isOwner && (
          <div style={{ marginBottom: '8px' }}>
            <div style={{ font: `600 13px ${fonts.body}`, color: colors.textMuted, marginBottom: '6px' }}>{t('Agregar personas', 'Add people')}</div>
            <InviteEmails invitees={invitees} onChange={setInvitees} excludeEmails={members.map((m) => m.email)} disabled={saving} />
          </div>
        )}
        {error && <div style={{ color: colors.danger, fontFamily: fonts.body, fontSize: '13px', marginTop: '8px' }}>{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '18px' }}>
          <button onClick={onClose} style={closeButtonStyle}>{t('Cerrar', 'Close')}</button>
          {isOwner && invitees.length > 0 && (
            <button
              onClick={onAddInvitees}
              disabled={saving}
              style={{ background: colors.primaryStrong, color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 18px', font: `600 15px ${fonts.body}`, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}
            >
              {saving ? t('Agregando...', 'Adding...') : t(`Agregar ${invitees.length}`, `Add ${invitees.length}`)}
            </button>
          )}
        </div>
      </div>
      {removeTarget && (
        <ConfirmDialog
          title={t('Quitar acceso', 'Remove access')}
          message={t(`${removeTarget.name} perderá acceso a este proyecto.`, `${removeTarget.name} will lose access to this project.`)}
          confirmLabel={t('Quitar acceso', 'Remove access')}
          onConfirm={onRemove}
          onCancel={() => setRemoveTarget(null)}
        />
      )}
    </div>
  );
}

export function ChangesModal({ projectId, onClose }) {
  const { t, locale } = useI18n();
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const [changes, setChanges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    return api
      .listChanges(projectId)
      .then(setChanges)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`changes-${projectId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'project_changes', filter: `project_id=eq.${projectId}` }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, load]);

  return (
    <div onClick={onClose} style={overlayStyle}>
      <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} style={{ ...dialogStyle, width: '560px' }}>
        <div style={titleStyle}>{t('Bitácora de cambios', 'Change log')}</div>
        <div data-testid="changes-list" style={{ overflowY: 'auto', flex: 1, minHeight: '120px' }}>
          {loading && <div style={{ color: colors.textMuted, fontFamily: fonts.body }}>{t('Cargando...', 'Loading...')}</div>}
          {!loading && changes.length === 0 && (
            <div style={{ color: colors.textMuted, fontFamily: fonts.body, fontSize: '14px' }}>{t('Aún no hay cambios registrados.', 'No changes recorded yet.')}</div>
          )}
          {changes.map((c) => (
            <div key={c.id} style={{ padding: '10px 0', borderBottom: `1px solid ${colors.border}` }}>
              <div style={{ fontFamily: fonts.body, fontSize: '14px', color: colors.text }}>
                <span style={{ fontWeight: 600 }}>{c.user_name || t('Alguien', 'Someone')}</span> {c.summary.charAt(0).toLowerCase() + c.summary.slice(1)}
              </div>
              <div style={{ fontFamily: fonts.body, fontSize: '12px', color: colors.textMuted, marginTop: '2px' }}>{formatWhen(c.created_at, locale)}</div>
            </div>
          ))}
        </div>
        {error && <div style={{ color: colors.danger, fontFamily: fonts.body, fontSize: '13px', marginTop: '8px' }}>{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '18px' }}>
          <button onClick={onClose} style={closeButtonStyle}>{t('Cerrar', 'Close')}</button>
        </div>
      </div>
    </div>
  );
}
