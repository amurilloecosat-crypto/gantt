import { supabase } from './supabaseClient';

const DEFAULT_TASKS = [
  { id: 't1', name: 'Planeación', parentId: null, duration: 3, dependency: '', manualStart: 0, color: '#00A887' },
  { id: 't2', name: 'Levantamiento de requerimientos', parentId: 't1', duration: 2, dependency: 't1', manualStart: 3 },
  { id: 't3', name: 'Instalación de sensores', parentId: null, duration: 4, dependency: 't2', manualStart: 5, color: '#00A887' },
];

function formatDate(isoString) {
  if (!isoString) return '';
  return new Date(isoString).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function serialize(row) {
  return {
    id: row.id,
    name: row.name,
    unit: row.unit,
    startDate: row.start_date || '',
    excludeWeekends: !!row.exclude_weekends,
    notesHtml: row.notes_html || '',
    tasks: row.tasks || [],
    deliverables: row.deliverables || [],
    headerBg: row.header_bg || '#F5F8F7',
    headerFg: row.header_fg || '#475A52',
    guidePosition: typeof row.guide_position === 'number' ? row.guide_position : 0,
    lastModified: formatDate(row.updated_at),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function requireUserId() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('No autenticado');
  return session.user.id;
}

export const api = {
  async listProjects() {
    const { data, error } = await supabase.from('projects').select('*').order('updated_at', { ascending: false });
    if (error) throw new Error(error.message);
    return { projects: data.map(serialize) };
  },

  async createProject({ name }) {
    if (!name || !name.trim()) throw new Error('El nombre es obligatorio');
    const userId = await requireUserId();
    const { data, error } = await supabase
      .from('projects')
      .insert({ user_id: userId, name: name.trim(), tasks: DEFAULT_TASKS })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { project: serialize(data) };
  },

  async getProject(id) {
    const { data, error } = await supabase.from('projects').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Proyecto no encontrado');
    return { project: serialize(data) };
  },

  async updateProject(id, patch) {
    const dbPatch = {};
    if (patch.name !== undefined) dbPatch.name = String(patch.name);
    if (patch.unit !== undefined) dbPatch.unit = String(patch.unit);
    if (patch.startDate !== undefined) dbPatch.start_date = String(patch.startDate);
    if (patch.excludeWeekends !== undefined) dbPatch.exclude_weekends = !!patch.excludeWeekends;
    if (patch.notesHtml !== undefined) dbPatch.notes_html = String(patch.notesHtml);
    if (patch.tasks !== undefined) dbPatch.tasks = patch.tasks;
    if (patch.deliverables !== undefined) dbPatch.deliverables = patch.deliverables;
    if (patch.headerBg !== undefined) dbPatch.header_bg = String(patch.headerBg);
    if (patch.headerFg !== undefined) dbPatch.header_fg = String(patch.headerFg);
    if (patch.guidePosition !== undefined) dbPatch.guide_position = Number(patch.guidePosition) || 0;
    dbPatch.updated_at = new Date().toISOString();

    const { data, error } = await supabase.from('projects').update(dbPatch).eq('id', id).select().maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Proyecto no encontrado');
    return { project: serialize(data) };
  },

  async deleteProject(id) {
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return null;
  },
};
