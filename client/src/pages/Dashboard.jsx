import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header.jsx';
import InviteEmails from '../components/InviteEmails.jsx';
import { useAuth } from '../AuthContext.jsx';
import { useOnboarding } from '../onboarding/OnboardingContext.jsx';
import { api } from '../api';
import { colors, fonts } from '../theme.js';
import { computeProjectSpan, durationLabel, formatShortDate } from '../ganttUtils.js';
import { useI18n } from '../i18n.jsx';

const overlayStyle = { position: 'fixed', inset: 0, background: colors.overlay, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 };
const dialogStyle = { background: colors.surface, borderRadius: '14px', padding: '28px', width: '360px', maxWidth: 'calc(100vw - 32px)', boxShadow: `0 8px 24px ${colors.shadow}` };
const dialogTitleStyle = { fontFamily: fonts.heading, fontWeight: 700, fontSize: '18px', color: colors.text, marginBottom: '16px' };
const textInputStyle = { width: '100%', boxSizing: 'border-box', padding: '10px 14px', border: `1.5px solid ${colors.inputBorder}`, borderRadius: '10px', fontFamily: fonts.body, fontSize: '15px', color: colors.text };
const cancelButtonStyle = { background: 'transparent', color: colors.primaryDark, border: `1.5px solid ${colors.primary}`, borderRadius: '10px', padding: '9px 17px', font: `600 15px ${fonts.body}`, cursor: 'pointer' };
const fieldLabelStyle = { display: 'block', font: `600 13px ${fonts.body}`, color: colors.textMuted, marginBottom: '6px' };

function primaryButtonStyle(disabled) {
  return { background: colors.primaryStrong, color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 18px', font: `600 15px ${fonts.body}`, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1 };
}

const MENU_WIDTH = 190;

function buildPhaseStrip(tasks) {
  const phases = (tasks || []).filter((t) => !t.parentId);
  if (!phases.length) return [];
  return phases.map((t) => ({ id: t.id, weight: Math.max(1, Number(t.duration) || 1), color: t.color || '#00A887' }));
}

function InfoItem({ label, value }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontFamily: fonts.body, fontWeight: 600, fontSize: '11px', letterSpacing: '.04em', textTransform: 'uppercase', color: colors.textMuted }}>{label}</div>
      <div style={{ fontFamily: fonts.body, fontSize: '14px', color: colors.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
    </div>
  );
}

function menuItemStyle(danger) {
  return { display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '9px 14px', border: 'none', background: 'transparent', textAlign: 'left', font: `500 14px ${fonts.body}`, color: danger ? colors.danger : colors.text, cursor: 'pointer' };
}

export default function Dashboard() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { maybeAutoStart } = useOnboarding();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filterText, setFilterText] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [menu, setMenu] = useState(null);
  const [tip, setTip] = useState(null);
  const [duplicateTarget, setDuplicateTarget] = useState(null);
  const [duplicateName, setDuplicateName] = useState('');
  const [duplicating, setDuplicating] = useState(false);
  const [shareTarget, setShareTarget] = useState(null);
  const [shareName, setShareName] = useState('');
  const [shareInvitees, setShareInvitees] = useState([]);
  const [sharing, setSharing] = useState(false);
  const [ownerNames, setOwnerNames] = useState({});
  const [activeTab, setActiveTab] = useState(() => {
    try {
      return window.localStorage.getItem('ariadna.dashboardTab') === 'shared' ? 'shared' : 'mine';
    } catch (err) {
      return 'mine';
    }
  });
  const requestedOwners = useRef(new Set());
  const menuRef = useRef(null);
  const noticeTimer = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!menu) return undefined;
    const close = () => setMenu(null);
    const onMouseDown = (e) => {
      if (menuRef.current && menuRef.current.contains(e.target)) return;
      close();
    };
    const onKeyDown = (e) => e.key === 'Escape' && close();
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [menu]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (shareTarget && !sharing) setShareTarget(null);
      else if (duplicateTarget && !duplicating) setDuplicateTarget(null);
      else if (deleteTargetId && !deleting) setDeleteTargetId(null);
      else if (isModalOpen && !creating) setIsModalOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shareTarget, sharing, duplicateTarget, duplicating, deleteTargetId, deleting, isModalOpen, creating]);

  function showNotice(message) {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(''), 5000);
  }

  useEffect(() => {
    let cancelled = false;
    api
      .listProjects()
      .then(({ projects }) => {
        if (!cancelled) setProjects(projects);
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  // Cuentas nuevas (sin proyectos) ven el tutorial al entrar por primera vez.
  useEffect(() => {
    if (!loading && !error) maybeAutoStart(projects.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, error]);

  useEffect(() => {
    if (!user) return;
    projects.forEach((p) => {
      if (p.userId === user.id || requestedOwners.current.has(p.id)) return;
      requestedOwners.current.add(p.id);
      api
        .listMembers(p.id)
        .then((list) => {
          const owner = list.find((m) => m.isOwner);
          if (owner) setOwnerNames((prev) => ({ ...prev, [p.id]: owner.name }));
        })
        .catch(() => requestedOwners.current.delete(p.id));
    });
  }, [projects, user]);

  const mineCount = projects.filter((p) => !p.shared).length;
  const sharedCount = projects.length - mineCount;
  const tabProjects = projects.filter((p) => (activeTab === 'shared' ? p.shared : !p.shared));
  const filteredProjects = tabProjects.filter((p) => p.name.toLowerCase().includes(filterText.toLowerCase()));
  const deleteTarget = projects.find((p) => p.id === deleteTargetId) || null;

  function selectTab(tab) {
    setActiveTab(tab);
    setFilterText('');
    try {
      window.localStorage.setItem('ariadna.dashboardTab', tab);
    } catch (err) {
      // Sin almacenamiento: la pestaña no se recuerda.
    }
  }

  async function onConfirmCreate() {
    const name = newProjectName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const { project } = await api.createProject({ name });
      setProjects((prev) => [project, ...prev]);
      setIsModalOpen(false);
      setNewProjectName('');
      navigate(`/proyectos/${project.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  function openDuplicate(project) {
    setDuplicateTarget(project);
    setDuplicateName(t(`${project.name} (copia)`, `${project.name} (copy)`));
  }

  function openShare(project) {
    setShareTarget(project);
    setShareName(t(`${project.name} (copia compartida)`, `${project.name} (shared copy)`));
    setShareInvitees([]);
  }

  async function onConfirmDuplicate() {
    const name = duplicateName.trim();
    if (!name || !duplicateTarget) return;
    setDuplicating(true);
    try {
      const { project } = await api.duplicateProject(duplicateTarget, name);
      setProjects((prev) => [{ ...project, shared: false }, ...prev]);
      setDuplicateTarget(null);
      showNotice(t(`Copia "${project.name}" creada.`, `Copy "${project.name}" created.`));
    } catch (err) {
      setError(err.message);
    } finally {
      setDuplicating(false);
    }
  }

  async function onConfirmShare() {
    const name = shareName.trim();
    if (!name || !shareTarget || shareInvitees.length === 0) return;
    setSharing(true);
    try {
      const { project } = await api.duplicateProject(shareTarget, name);
      try {
        await api.addMembers(project.id, shareInvitees.map((i) => i.userId));
      } catch (err) {
        await api.deleteProject(project.id).catch(() => {});
        throw err;
      }
      setProjects((prev) => [{ ...project, shared: true }, ...prev]);
      setShareTarget(null);
      selectTab('shared');
      showNotice(t(`Copia "${project.name}" creada y compartida con ${shareInvitees.length} persona${shareInvitees.length === 1 ? '' : 's'}.`, `Copy "${project.name}" created and shared with ${shareInvitees.length} ${shareInvitees.length === 1 ? 'person' : 'people'}.`));
    } catch (err) {
      setError(err.message);
    } finally {
      setSharing(false);
    }
  }

  async function onConfirmDelete() {
    if (!deleteTargetId) return;
    setDeleting(true);
    try {
      await api.deleteProject(deleteTargetId);
      setProjects((prev) => prev.filter((p) => p.id !== deleteTargetId));
      setDeleteTargetId(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: colors.bg, fontFamily: fonts.body }}>
      <Header />

      <div role="tablist" style={{ display: 'flex', gap: '4px', padding: '0 32px', background: colors.surface, borderBottom: `1px solid ${colors.border}` }}>
        {[
          { key: 'mine', label: t('Mis proyectos', 'My projects'), count: mineCount },
          { key: 'shared', label: t('Compartidos', 'Shared'), count: sharedCount },
        ].map((tab) => {
          const selected = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={selected}
              data-testid={`tab-${tab.key}`}
              onClick={() => selectTab(tab.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '16px 18px',
                marginBottom: '-1px',
                background: 'transparent',
                border: 'none',
                borderBottom: `2px solid ${selected ? colors.primary : 'transparent'}`,
                fontFamily: fonts.body,
                fontWeight: 600,
                fontSize: '15px',
                cursor: 'pointer',
                color: selected ? colors.primaryDark : colors.textMuted,
              }}
            >
              {tab.label}
              <span style={{ minWidth: '22px', padding: '1px 7px', borderRadius: '999px', fontSize: '12px', textAlign: 'center', background: selected ? colors.primaryTint : colors.bg, color: selected ? colors.primaryDark : colors.textMuted }}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ padding: '40px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '28px' }}>
          <input
            type="text"
            placeholder={t('Buscar por nombre...', 'Search by name...')}
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            style={{
              flex: 1,
              maxWidth: '360px',
              padding: '10px 14px',
              border: `1.5px solid ${colors.inputBorder}`,
              borderRadius: '10px',
              fontFamily: fonts.body,
              fontSize: '15px',
              color: colors.text,
              background: colors.surface,
            }}
          />
          <button
            data-tour="new-project"
            onClick={() => {
              setIsModalOpen(true);
              setNewProjectName('');
            }}
            style={{
              background: colors.primaryStrong,
              color: '#fff',
              font: `600 15px ${fonts.body}`,
              borderRadius: '10px',
              padding: '10px 20px',
              border: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {t('+ Nuevo proyecto', '+ New project')}
          </button>
        </div>

        {error && <div style={{ color: colors.danger, marginBottom: '16px' }}>{error}</div>}
        {notice && <div style={{ color: colors.primaryDark, background: colors.primaryTint, borderRadius: '10px', padding: '10px 14px', marginBottom: '16px', fontFamily: fonts.body, fontSize: '14px' }}>{notice}</div>}

        {loading ? (
          <div style={{ color: colors.textMuted }}>{t('Cargando proyectos...', 'Loading projects...')}</div>
        ) : filteredProjects.length === 0 ? (
          <div data-testid="empty-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '12px', color: colors.textMuted, fontFamily: fonts.body, fontSize: '15px', maxWidth: '520px' }}>
            {filterText ? (
              <>
                <div>{t(`Ningún proyecto coincide con "${filterText}".`, `No projects match "${filterText}".`)}</div>
                <button onClick={() => setFilterText('')} style={{ background: 'transparent', border: 'none', padding: 0, color: colors.primaryDark, font: `600 15px ${fonts.body}`, textDecoration: 'underline', cursor: 'pointer' }}>
                  {t('Limpiar búsqueda', 'Clear search')}
                </button>
              </>
            ) : activeTab === 'shared' ? (
              <div>{t('Aún no hay proyectos compartidos. Abre el menú de un proyecto y elige "Crear copia y compartir…" para trabajar con otras personas.', 'There are no shared projects yet. Open a project\'s menu and choose "Create copy and share…" to work with other people.')}</div>
            ) : (
              <>
                <div>{t('Aún no tienes proyectos. Crea tu primer cronograma, ponle nombre y arma las fases.', "You don't have any projects yet. Create your first timeline, give it a name and build the phases.")}</div>
                <button
                  onClick={() => {
                    setIsModalOpen(true);
                    setNewProjectName('');
                  }}
                  style={primaryButtonStyle(false)}
                >
                  {t('+ Nuevo proyecto', '+ New project')}
                </button>
              </>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(396px, 100%), 1fr))', gap: '20px' }}>
            {filteredProjects.map((project) => {
              const span = computeProjectSpan(project);
              const strip = buildPhaseStrip(project.tasks);
              const ownerName = user && project.userId === user.id ? user.name : ownerNames[project.id] || '…';
              return (
                <div
                  key={project.id}
                  data-testid="project-card"
                  onClick={() => navigate(`/proyectos/${project.id}`)}
                  onMouseEnter={(e) => setTip({ text: project.name, x: e.clientX, y: e.clientY })}
                  onMouseMove={(e) => setTip({ text: project.name, x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setTip(null)}
                  className="project-card"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: colors.surface,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '14px',
                    boxShadow: '0 1px 3px rgba(15,26,22,.06)',
                    overflow: 'hidden',
                    cursor: 'pointer',
                  }}
                >
                  <div data-testid="phase-strip" aria-hidden="true" style={{ display: 'flex', height: '4px', background: colors.border }}>
                    {strip.map((seg) => (
                      <div key={seg.id} style={{ flex: seg.weight, background: seg.color }} />
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '16px 18px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ minWidth: 0, flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ minWidth: 0, fontFamily: fonts.body, fontWeight: 700, fontSize: '16px', color: colors.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {project.name}
                      </div>
                    </div>
                    <button
                      data-testid="project-actions"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTip(null);
                        const rect = e.currentTarget.getBoundingClientRect();
                        setMenu({ projectId: project.id, right: rect.right, top: rect.bottom + 4, bottom: rect.top - 4 });
                      }}
                      onMouseEnter={() => setTip(null)}
                      title={t('Acciones', 'Actions')}
                      aria-label={t('Acciones del proyecto', 'Project actions')}
                      style={{ flexShrink: 0, width: '28px', height: '28px', borderRadius: '7px', border: 'none', background: menu && menu.projectId === project.id ? colors.hover : 'transparent', color: colors.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <circle cx="8" cy="3" r="1.5" />
                        <circle cx="8" cy="8" r="1.5" />
                        <circle cx="8" cy="13" r="1.5" />
                      </svg>
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 18px' }}>
                    {activeTab === 'shared' && <InfoItem label={t('Propietario', 'Owner')} value={ownerName} />}
                    <InfoItem label={t('Creado', 'Created')} value={formatShortDate(project.createdAt)} />
                    <InfoItem label={t('Duración', 'Duration')} value={durationLabel(span.units, project.unit)} />
                    <InfoItem label={t('Editado', 'Edited')} value={formatShortDate(project.updatedAt)} />
                    {project.startDate && <InfoItem label={t('Inicio', 'Start')} value={formatShortDate(project.startDate + 'T00:00:00')} />}
                    {project.startDate && <InfoItem label={t('Fin', 'End')} value={span.endDate ? formatShortDate(span.endDate) : '—'} />}
                  </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div
          onClick={() => setIsModalOpen(false)}
          style={{ position: 'fixed', inset: 0, background: colors.overlay, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            style={{ background: colors.surface, borderRadius: '14px', padding: '28px', width: '360px', boxShadow: `0 8px 24px ${colors.shadow}` }}
          >
            <div style={{ fontFamily: fonts.heading, fontWeight: 700, fontSize: '18px', color: colors.text, marginBottom: '16px' }}>
              {t('Nuevo proyecto', 'New project')}
            </div>
            <input
              type="text"
              placeholder={t('Ej. Implementación IoT - Planta Monterrey', 'E.g. IoT Implementation - Monterrey Plant')}
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onConfirmCreate()}
              data-tour="new-project-input"
              autoFocus
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '10px 14px',
                border: `1.5px solid ${colors.inputBorder}`,
                borderRadius: '10px',
                fontFamily: fonts.body,
                fontSize: '15px',
                color: colors.text,
                marginBottom: '20px',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'transparent', color: colors.primaryDark, border: `1.5px solid ${colors.primary}`, borderRadius: '10px', padding: '9px 17px', font: `600 15px ${fonts.body}`, cursor: 'pointer' }}
              >
                {t('Cancelar', 'Cancel')}
              </button>
              <button
                data-tour="create-project"
                onClick={onConfirmCreate}
                disabled={creating}
                style={{ background: colors.primaryStrong, color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 18px', font: `600 15px ${fonts.body}`, cursor: 'pointer', opacity: creating ? 0.7 : 1 }}
              >
                {creating ? t('Creando...', 'Creating...') : t('Crear proyecto', 'Create project')}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div
          onClick={() => setDeleteTargetId(null)}
          style={{ position: 'fixed', inset: 0, background: colors.overlay, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            style={{ background: colors.surface, borderRadius: '14px', padding: '28px', width: '360px', boxShadow: `0 8px 24px ${colors.shadow}` }}
          >
            <div style={{ fontFamily: fonts.heading, fontWeight: 700, fontSize: '18px', color: colors.text, marginBottom: '10px' }}>
              {t('Eliminar proyecto', 'Delete project')}
            </div>
            <div style={{ fontFamily: fonts.body, fontSize: '14px', color: colors.textMuted, marginBottom: '20px' }}>
              {t(`¿Seguro que quieres eliminar "${deleteTarget.name}"? Esta acción no se puede deshacer.`, `Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone.`)}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setDeleteTargetId(null)}
                style={{ background: 'transparent', color: colors.primaryDark, border: `1.5px solid ${colors.primary}`, borderRadius: '10px', padding: '9px 17px', font: `600 15px ${fonts.body}`, cursor: 'pointer' }}
              >
                {t('Cancelar', 'Cancel')}
              </button>
              <button
                onClick={onConfirmDelete}
                disabled={deleting}
                style={{ background: '#B91C1C', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 18px', font: `600 15px ${fonts.body}`, cursor: 'pointer', opacity: deleting ? 0.7 : 1 }}
              >
                {deleting ? t('Eliminando...', 'Deleting...') : t('Eliminar', 'Delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {duplicateTarget && (
        <div onClick={() => !duplicating && setDuplicateTarget(null)} style={overlayStyle}>
          <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} style={dialogStyle}>
            <div style={dialogTitleStyle}>{t('Duplicar proyecto', 'Duplicate project')}</div>
            <label style={fieldLabelStyle}>{t('Nombre de la copia', 'Copy name')}</label>
            <input
              type="text"
              value={duplicateName}
              onChange={(e) => setDuplicateName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onConfirmDuplicate()}
              onFocus={(e) => e.target.select()}
              autoFocus
              style={{ ...textInputStyle, marginBottom: '20px' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setDuplicateTarget(null)} disabled={duplicating} style={cancelButtonStyle}>{t('Cancelar', 'Cancel')}</button>
              <button onClick={onConfirmDuplicate} disabled={duplicating || !duplicateName.trim()} style={primaryButtonStyle(duplicating || !duplicateName.trim())}>
                {duplicating ? t('Duplicando...', 'Duplicating...') : t('Duplicar', 'Duplicate')}
              </button>
            </div>
          </div>
        </div>
      )}

      {shareTarget && (
        <div onClick={() => !sharing && setShareTarget(null)} style={overlayStyle}>
          <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} style={{ ...dialogStyle, width: '440px' }}>
            <div style={dialogTitleStyle}>{t('Crear copia y compartir', 'Create copy and share')}</div>
            <div style={{ fontFamily: fonts.body, fontSize: '13px', color: colors.textMuted, marginBottom: '16px' }}>
              {t(`Crearemos una copia independiente de "${shareTarget.name}". Tú y las personas que agregues podrán editarla juntos. El original no cambia.`, `We'll create an independent copy of "${shareTarget.name}". You and the people you add will be able to edit it together. The original stays unchanged.`)}
            </div>
            <label style={fieldLabelStyle}>{t('Nombre de la copia', 'Copy name')}</label>
            <input
              type="text"
              value={shareName}
              onChange={(e) => setShareName(e.target.value)}
              onFocus={(e) => e.target.select()}
              autoFocus
              style={{ ...textInputStyle, marginBottom: '16px' }}
            />
            <label style={fieldLabelStyle}>{t('Invitar a', 'Invite')}</label>
            <InviteEmails
              invitees={shareInvitees}
              onChange={setShareInvitees}
              excludeEmails={user ? [user.email] : []}
              disabled={sharing}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '22px' }}>
              <button onClick={() => setShareTarget(null)} disabled={sharing} style={cancelButtonStyle}>{t('Cancelar', 'Cancel')}</button>
              <button
                onClick={onConfirmShare}
                disabled={sharing || !shareName.trim() || shareInvitees.length === 0}
                style={primaryButtonStyle(sharing || !shareName.trim() || shareInvitees.length === 0)}
              >
                {sharing ? t('Compartiendo...', 'Sharing...') : t('Crear y compartir', 'Create and share')}
              </button>
            </div>
          </div>
        </div>
      )}

      {menu && (() => {
        const target = projects.find((p) => p.id === menu.projectId);
        if (!target) return null;
        const isOwner = !user || target.userId === user.id;
        const openUp = menu.top + 150 > window.innerHeight;
        return (
          <div
            ref={menuRef}
            data-testid="project-menu"
            style={{
              position: 'fixed',
              left: Math.max(8, menu.right - MENU_WIDTH),
              ...(openUp ? { bottom: window.innerHeight - menu.bottom } : { top: menu.top }),
              width: MENU_WIDTH,
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: '10px',
              boxShadow: `0 8px 24px ${colors.shadow}`,
              padding: '6px 0',
              zIndex: 110,
            }}
          >
            <button onClick={() => { setMenu(null); openDuplicate(target); }} style={menuItemStyle(false)}>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5" /><path d="M10.5 3.5v-.5a1 1 0 0 0-1-1h-6.5a1 1 0 0 0-1 1v6.5a1 1 0 0 0 1 1h.5" /></svg>
              {t('Duplicar', 'Duplicate')}
            </button>
            <button onClick={() => { setMenu(null); openShare(target); }} style={menuItemStyle(false)}>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="5.5" r="2.3" /><path d="M1.8 13.5c.3-2.3 2-3.6 4.2-3.6s3.9 1.3 4.2 3.6" /><path d="M10.6 3.5a2.2 2.2 0 0 1 0 4" /><path d="M12 10.2c1.3.5 2.1 1.5 2.3 3.3" /></svg>
              {t('Crear copia y compartir…', 'Create copy and share…')}
            </button>
            {isOwner && (
              <>
                <div style={{ height: '1px', background: colors.border, margin: '6px 0' }} />
                <button onClick={() => { setMenu(null); setDeleteTargetId(target.id); }} style={menuItemStyle(true)}>
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 4h11" /><path d="M5.5 4V2.8c0-.44.36-.8.8-.8h3.4c.44 0 .8.36.8.8V4" /><path d="M4 4l.6 8.6c.03.44.4.9.9.9h4.5c.5 0 .87-.46.9-.9L11.5 4" /></svg>
                  {t('Eliminar', 'Delete')}
                </button>
              </>
            )}
          </div>
        );
      })()}

      {tip && !menu && !isModalOpen && !deleteTarget && !duplicateTarget && !shareTarget && (
        <div
          data-testid="project-tooltip"
          style={{
            position: 'fixed',
            left: Math.min(tip.x + 14, window.innerWidth - 380),
            top: tip.y + 18,
            maxWidth: '360px',
            padding: '7px 11px',
            background: '#14211D',
            color: '#FFFFFF',
            borderRadius: '8px',
            font: `500 13px ${fonts.body}`,
            lineHeight: 1.35,
            wordBreak: 'break-word',
            boxShadow: '0 4px 14px rgba(15,26,22,.25)',
            pointerEvents: 'none',
            zIndex: 90,
          }}
        >
          {tip.text}
        </div>
      )}
    </div>
  );
}
