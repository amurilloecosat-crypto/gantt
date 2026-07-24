const express = require('express');
const db = require('./db');
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

function serialize(project) {
  return {
    id: project.id,
    name: project.name,
    unit: project.unit,
    startDate: project.startDate || '',
    excludeWeekends: !!project.excludeWeekends,
    notesHtml: project.notesHtml || '',
    notesAttachmentName: project.notesAttachmentName || '',
    tasks: project.tasks || [],
    lastModified: formatDate(project.updatedAt),
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

router.get('/', (req, res) => {
  const projects = db.listProjectsByUser(req.userId);
  res.json({ projects: projects.map(serialize) });
});

router.post('/', (req, res) => {
  const { name } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });

  const project = db.createProject(req.userId, { name: name.trim(), tasks: DEFAULT_TASKS });
  res.status(201).json({ project: serialize(project) });
});

router.get('/:id', (req, res) => {
  const project = db.getProject(req.userId, req.params.id);
  if (!project) return res.status(404).json({ error: 'Proyecto no encontrado' });
  res.json({ project: serialize(project) });
});

router.put('/:id', (req, res) => {
  const body = req.body || {};
  const patch = {};
  if (body.name !== undefined) patch.name = String(body.name);
  if (body.unit !== undefined) patch.unit = String(body.unit);
  if (body.startDate !== undefined) patch.startDate = String(body.startDate);
  if (body.excludeWeekends !== undefined) patch.excludeWeekends = !!body.excludeWeekends;
  if (body.notesHtml !== undefined) patch.notesHtml = String(body.notesHtml);
  if (body.notesAttachmentName !== undefined) patch.notesAttachmentName = String(body.notesAttachmentName);
  if (body.tasks !== undefined) patch.tasks = body.tasks;

  const project = db.updateProject(req.userId, req.params.id, patch);
  if (!project) return res.status(404).json({ error: 'Proyecto no encontrado' });
  res.json({ project: serialize(project) });
});

router.delete('/:id', (req, res) => {
  const ok = db.deleteProject(req.userId, req.params.id);
  if (!ok) return res.status(404).json({ error: 'Proyecto no encontrado' });
  res.status(204).end();
});

module.exports = router;
