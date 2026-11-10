import { supabase } from './supabaseClient';
import { mergeProject } from './collab';
import { tr, getLocale } from './lang.js';

function defaultTasks() {
  return [
  { id: 't1', name: tr('Planeación', 'Planning'), parentId: null, duration: 3, dependency: '', manualStart: 0, color: '#00A887' },
  { id: 't2', name: tr('Levantamiento de requerimientos', 'Requirements gathering'), parentId: 't1', duration: 2, dependency: 't1', manualStart: 3 },
  { id: 't3', name: tr('Instalación de sensores', 'Sensor installation'), parentId: null, duration: 4, dependency: 't2', manualStart: 5, color: '#00A887' },
  ];
}

function formatDate(isoString) {
  if (!isoString) return '';
  return new Date(isoString).toLocaleDateString(getLocale(), { day: '2-digit', month: 'short', year: 'numeric' });
}

function serialize(row) {
  return {
    id: row.id,
    userId: row.user_id,
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
  if (!session) throw new Error(tr('Tu sesión expiró. Inicia sesión de nuevo.', 'Your session expired. Please sign in again.'));
  return session.user.id;
}

function buildDbPatch(patch) {
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
  return dbPatch;
}

export const api = {
  async listProjects() {
    const { data, error } = await supabase.from('projects').select('*').order('updated_at', { ascending: false });
    if (error) throw new Error(error.message);
    // Si la migración de colaboración aún no existe, la consulta falla y simplemente no hay proyectos compartidos.
    const { data: memberRows } = await supabase.from('project_members').select('project_id');
    const sharedIds = new Set((memberRows || []).map((m) => m.project_id));
    return { projects: data.map((row) => ({ ...serialize(row), shared: sharedIds.has(row.id) })) };
  },

  async createProject({ name }) {
    if (!name || !name.trim()) throw new Error(tr('El nombre es obligatorio', 'Name is required'));
    const userId = await requireUserId();
    const { data, error } = await supabase
      .from('projects')
      .insert({ user_id: userId, name: name.trim(), tasks: defaultTasks(), header_bg: '#0C5641', header_fg: '#FFFFFF' })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { project: serialize(data) };
  },

  async duplicateProject(source, name) {
    if (!name || !name.trim()) throw new Error(tr('El nombre es obligatorio', 'Name is required'));
    const userId = await requireUserId();
    const { data, error } = await supabase
      .from('projects')
      .insert({
        user_id: userId,
        name: name.trim(),
        unit: source.unit,
        start_date: source.startDate || '',
        exclude_weekends: !!source.excludeWeekends,
        notes_html: source.notesHtml || '',
        tasks: source.tasks || [],
        deliverables: source.deliverables || [],
        header_bg: source.headerBg,
        header_fg: source.headerFg,
        guide_position: Number(source.guidePosition) || 0,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { project: serialize(data) };
  },

  async lookupUserByEmail(email) {
    const { data, error } = await supabase.rpc('lookup_user_by_email', { p_email: email });
    if (error) throw new Error(error.message);
    return (data && data[0]) || null;
  },

  async listMembers(projectId) {
    const { data, error } = await supabase.rpc('list_project_members', { p_project_id: projectId });
    if (error) throw new Error(error.message);
    return data.map((m) => ({ userId: m.user_id, name: m.name, email: m.email, isOwner: m.is_owner }));
  },

  async addMembers(projectId, userIds) {
    if (!userIds.length) return;
    const addedBy = await requireUserId();
    const rows = userIds.map((userId) => ({ project_id: projectId, user_id: userId, added_by: addedBy }));
    const { error } = await supabase.from('project_members').upsert(rows, { onConflict: 'project_id,user_id', ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  },

  async removeMember(projectId, userId) {
    const { error } = await supabase.from('project_members').delete().eq('project_id', projectId).eq('user_id', userId);
    if (error) throw new Error(error.message);
  },

  async listChanges(projectId, limit = 200) {
    const { data, error } = await supabase
      .from('project_changes')
      .select('id, user_id, user_name, summary, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .limit(limit);
    if (error) throw new Error(error.message);
    return data;
  },

  async addChanges(projectId, summaries, userName) {
    if (!summaries.length) return;
    const userId = await requireUserId();
    const rows = summaries.map((summary) => ({ project_id: projectId, user_id: userId, user_name: userName, summary }));
    const { error } = await supabase.from('project_changes').insert(rows);
    if (error) throw new Error(error.message);
  },

  // Guarda con control de concurrencia: solo escribe si nadie más guardó desde `base`;
  // si hubo cambios ajenos, los fusiona con los míos por tarea y reintenta.
  async saveProjectMerged(id, base, mine) {
    let currentBase = base;
    let toWrite = mine;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const dbPatch = buildDbPatch(toWrite);
      dbPatch.updated_at = new Date().toISOString();
      const { data, error } = await supabase
        .from('projects')
        .update(dbPatch)
        .eq('id', id)
        .eq('updated_at', currentBase.updatedAt)
        .select()
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (data) return { saved: serialize(data), written: toWrite };
      const { project: theirs } = await api.getProject(id);
      toWrite = mergeProject(currentBase, toWrite, theirs);
      currentBase = theirs;
    }
    throw new Error(tr('Alguien editó este proyecto al mismo tiempo y no pudimos combinar los cambios. Recarga la página para ver la última versión.', "Someone edited this project at the same time and we couldn't merge the changes. Reload the page to see the latest version."));
  },

  // Plantilla personal de notas (una por usuario). Devuelve el HTML o null si aún no existe.
  async getNotesTemplate() {
    const { data, error } = await supabase.from('user_note_templates').select('html').maybeSingle();
    if (error) throw new Error(error.message);
    return data ? data.html : null;
  },

  async saveNotesTemplate(html) {
    const userId = await requireUserId();
    const { error } = await supabase
      .from('user_note_templates')
      .upsert({ user_id: userId, html: String(html), updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) throw new Error(error.message);
  },

  async getProjectUpdatedAt(id) {
    const { data, error } = await supabase.from('projects').select('updated_at').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? data.updated_at : null;
  },

  async getProject(id) {
    const { data, error } = await supabase.from('projects').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error(tr('Proyecto no encontrado', 'Project not found'));
    return { project: serialize(data) };
  },

  async updateProject(id, patch) {
    const dbPatch = buildDbPatch(patch);
    dbPatch.updated_at = new Date().toISOString();

    const { data, error } = await supabase.from('projects').update(dbPatch).eq('id', id).select().maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error(tr('Proyecto no encontrado', 'Project not found'));
    return { project: serialize(data) };
  },

  async deleteProject(id) {
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return null;
  },
};
