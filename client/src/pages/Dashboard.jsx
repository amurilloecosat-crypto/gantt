import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header.jsx';
import { api } from '../api';
import { colors, fonts } from '../theme.js';
import { buildMiniGanttRows } from '../ganttUtils.js';

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterText, setFilterText] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();

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

  const filteredProjects = projects.filter((p) => p.name.toLowerCase().includes(filterText.toLowerCase()));
  const deleteTarget = projects.find((p) => p.id === deleteTargetId) || null;

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

      <div style={{ display: 'flex', gap: '4px', padding: '0 32px', background: colors.surface, borderBottom: `1px solid ${colors.border}` }}>
        <div
          style={{
            padding: '16px 18px',
            fontFamily: fonts.body,
            fontWeight: 600,
            fontSize: '15px',
            cursor: 'pointer',
            color: colors.primaryDark,
            borderBottom: `2px solid ${colors.primary}`,
          }}
        >
          Mis Proyectos
        </div>
      </div>

      <div style={{ padding: '40px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '28px' }}>
          <input
            type="text"
            placeholder="Buscar por nombre..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            style={{
              flex: 1,
              maxWidth: '360px',
              padding: '10px 14px',
              border: `1.5px solid ${colors.border}`,
              borderRadius: '10px',
              fontFamily: fonts.body,
              fontSize: '15px',
              color: colors.text,
              background: colors.surface,
            }}
          />
          <button
            onClick={() => {
              setIsModalOpen(true);
              setNewProjectName('');
            }}
            style={{
              background: colors.primary,
              color: '#fff',
              font: `600 15px ${fonts.body}`,
              borderRadius: '10px',
              padding: '10px 20px',
              border: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            + Crear
          </button>
        </div>

        {error && <div style={{ color: '#DC2626', marginBottom: '16px' }}>{error}</div>}

        {loading ? (
          <div style={{ color: colors.textMuted }}>Cargando proyectos...</div>
        ) : filteredProjects.length === 0 ? (
          <div style={{ color: colors.textMuted }}>No hay proyectos todavía. Crea el primero.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px' }}>
            {filteredProjects.map((project) => {
              const previewRows = buildMiniGanttRows(project.tasks);
              return (
                <div
                  key={project.id}
                  onClick={() => navigate(`/proyectos/${project.id}`)}
                  style={{
                    aspectRatio: '1',
                    display: 'flex',
                    flexDirection: 'column',
                    background: colors.surface,
                    border: '1px solid #C9D6D1',
                    borderRadius: '14px',
                    overflow: 'hidden',
                    boxShadow: '0 1px 3px rgba(15,26,22,.06)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ flex: 1, position: 'relative', background: colors.surface, overflow: 'hidden', padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly' }}>
                    {previewRows.map((row, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={row.nameStyle} />
                        <div style={{ position: 'relative', flex: 1, height: '10px', borderRadius: '3px', backgroundImage: row.gridImage }}>
                          <div style={row.barStyle} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', backgroundColor: '#B0E2D5' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontFamily: fonts.body, fontWeight: 600, fontSize: '14px', color: '#000000', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {project.name}
                      </div>
                      <div style={{ fontFamily: fonts.body, fontSize: '12px', color: '#515151' }}>Editado {project.lastModified}</div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTargetId(project.id);
                      }}
                      title="Eliminar"
                      style={{ flexShrink: 0, width: '28px', height: '28px', borderRadius: '7px', border: 'none', background: 'transparent', color: '#3A5750', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2.5 4h11" />
                        <path d="M5.5 4V2.8c0-.44.36-.8.8-.8h3.4c.44 0 .8.36.8.8V4" />
                        <path d="M4 4l.6 8.6c.03.44.4.9.9.9h4.5c.5 0 .87-.46.9-.9L11.5 4" />
                        <line x1="6.5" y1="6.5" x2="6.8" y2="11.5" />
                        <line x1="9.5" y1="6.5" x2="9.2" y2="11.5" />
                      </svg>
                    </button>
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
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,26,22,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: colors.surface, borderRadius: '14px', padding: '28px', width: '360px', boxShadow: '0 8px 24px rgba(15,26,22,.18)' }}
          >
            <div style={{ fontFamily: fonts.heading, fontWeight: 700, fontSize: '18px', color: colors.text, marginBottom: '16px' }}>
              Nuevo Proyecto
            </div>
            <input
              type="text"
              placeholder="Nombre del proyecto"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onConfirmCreate()}
              autoFocus
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '10px 14px',
                border: `1.5px solid ${colors.border}`,
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
                Cancelar
              </button>
              <button
                onClick={onConfirmCreate}
                disabled={creating}
                style={{ background: colors.primary, color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 18px', font: `600 15px ${fonts.body}`, cursor: 'pointer', opacity: creating ? 0.7 : 1 }}
              >
                {creating ? 'Creando...' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div
          onClick={() => setDeleteTargetId(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,26,22,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: colors.surface, borderRadius: '14px', padding: '28px', width: '360px', boxShadow: '0 8px 24px rgba(15,26,22,.18)' }}
          >
            <div style={{ fontFamily: fonts.heading, fontWeight: 700, fontSize: '18px', color: colors.text, marginBottom: '10px' }}>
              Eliminar proyecto
            </div>
            <div style={{ fontFamily: fonts.body, fontSize: '14px', color: colors.textMuted, marginBottom: '20px' }}>
              ¿Seguro que quieres eliminar "{deleteTarget.name}"? Esta acción no se puede deshacer.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setDeleteTargetId(null)}
                style={{ background: 'transparent', color: colors.primaryDark, border: `1.5px solid ${colors.primary}`, borderRadius: '10px', padding: '9px 17px', font: `600 15px ${fonts.body}`, cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={onConfirmDelete}
                disabled={deleting}
                style={{ background: '#DC2626', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 18px', font: `600 15px ${fonts.body}`, cursor: 'pointer', opacity: deleting ? 0.7 : 1 }}
              >
                {deleting ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
