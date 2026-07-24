import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header.jsx';
import { api } from '../api';
import { colors, fonts } from '../theme.js';

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterText, setFilterText] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [creating, setCreating] = useState(false);
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
            {filteredProjects.map((project) => (
              <div
                key={project.id}
                onClick={() => navigate(`/proyectos/${project.id}`)}
                style={{
                  background: colors.surface,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '14px',
                  padding: '20px',
                  boxShadow: '0 1px 3px rgba(15,26,22,.06)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontFamily: fonts.heading, fontWeight: 700, fontSize: '18px', color: colors.text, marginBottom: '8px' }}>
                  {project.name}
                </div>
                <div style={{ fontFamily: fonts.body, fontSize: '13px', fontWeight: 500, color: colors.textMuted }}>
                  Modificado: {project.lastModified}
                </div>
              </div>
            ))}
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
    </div>
  );
}
