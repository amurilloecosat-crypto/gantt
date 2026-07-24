const express = require('express');
const supabaseAdmin = require('./supabaseAdmin');
const { requireAuth } = require('./authMiddleware');

const router = express.Router();
router.use(requireAuth);

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
    notesAttachmentName: row.notes_attachment_name || '',
    tasks: row.tasks || [],
    lastModified: formatDate(row.updated_at),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

router.get('/', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('projects')
    .select('*')
    .eq('user_id', req.userId)
    .order('updated_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ projects: data.map(serialize) });
});

router.post('/', async (req, res) => {
  const { name } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });

  const { data, error } = await supabaseAdmin
    .from('projects')
    .insert({ user_id: req.userId, name: name.trim(), tasks: DEFAULT_TASKS })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ project: serialize(data) });
});

router.get('/:id', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('projects')
    .select('*')
    .eq('id', req.params.id)
    .eq('user_id', req.userId)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Proyecto no encontrado' });
  res.json({ project: serialize(data) });
});

router.put('/:id', async (req, res) => {
  const body = req.body || {};
  const patch = {};
  if (body.name !== undefined) patch.name = String(body.name);
  if (body.unit !== undefined) patch.unit = String(body.unit);
  if (body.startDate !== undefined) patch.start_date = String(body.startDate);
  if (body.excludeWeekends !== undefined) patch.exclude_weekends = !!body.excludeWeekends;
  if (body.notesHtml !== undefined) patch.notes_html = String(body.notesHtml);
  if (body.notesAttachmentName !== undefined) patch.notes_attachment_name = String(body.notesAttachmentName);
  if (body.tasks !== undefined) patch.tasks = body.tasks;
  patch.updated_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from('projects')
    .update(patch)
    .eq('id', req.params.id)
    .eq('user_id', req.userId)
    .select()
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Proyecto no encontrado' });
  res.json({ project: serialize(data) });
});

router.delete('/:id', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('projects')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.userId)
    .select()
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Proyecto no encontrado' });
  res.status(204).end();
});

module.exports = router;
