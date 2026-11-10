import { getLocale, getLang, tr } from './lang.js';

export function lightenColor(hex, amount) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const mix = (c) => Math.round(c + (255 - c) * amount);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

export function taskLevel(taskId, tasks) {
  const byId = {};
  tasks.forEach((t) => (byId[t.id] = t));
  let level = 0;
  let cur = byId[taskId];
  const seen = new Set();
  while (cur && cur.parentId && byId[cur.parentId] && !seen.has(cur.id)) {
    seen.add(cur.id);
    level++;
    cur = byId[cur.parentId];
  }
  return level;
}

export function getRootAncestorColor(task, tasks) {
  const byId = {};
  tasks.forEach((t) => (byId[t.id] = t));
  let cur = task;
  const seen = new Set();
  while (cur && cur.parentId && byId[cur.parentId] && !seen.has(cur.id)) {
    seen.add(cur.id);
    cur = byId[cur.parentId];
  }
  return (cur && cur.color) || '#00A887';
}

export function isDescendant(candidateId, ancestorId, tasks) {
  const byId = {};
  tasks.forEach((t) => (byId[t.id] = t));
  let cur = byId[candidateId];
  const seen = new Set();
  while (cur && cur.parentId && !seen.has(cur.id)) {
    if (cur.parentId === ancestorId) return true;
    seen.add(cur.id);
    cur = byId[cur.parentId];
  }
  return false;
}

export function hasChildren(taskId, tasks) {
  return tasks.some((t) => t.parentId === taskId);
}

export function getAncestorIds(taskId, tasks) {
  const byId = {};
  tasks.forEach((t) => (byId[t.id] = t));
  const ancestors = [];
  let cur = byId[taskId];
  const seen = new Set();
  while (cur && cur.parentId && byId[cur.parentId] && !seen.has(cur.id)) {
    seen.add(cur.id);
    ancestors.push(cur.parentId);
    cur = byId[cur.parentId];
  }
  return ancestors;
}

export function getSubtreeIndices(index, tasks) {
  const rootId = tasks[index].id;
  const indices = [index];
  for (let i = index + 1; i < tasks.length; i++) {
    if (tasks[i].id === rootId || isDescendant(tasks[i].id, rootId, tasks)) {
      indices.push(i);
    } else {
      break;
    }
  }
  return indices;
}

export function computeNumbers(tasks) {
  const counters = [];
  return tasks.map((t) => {
    const level = taskLevel(t.id, tasks);
    counters[level] = (counters[level] || 0) + 1;
    counters.length = level + 1;
    return counters.slice(0, level + 1).join('.');
  });
}

export function addBusinessDays(date, days) {
  const d = new Date(date);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) added++;
  }
  return d;
}

export function offsetDate(baseDate, offsetUnits, unit, excludeWeekends) {
  if (offsetUnits <= 0) return new Date(baseDate);
  if (unit === 'Semanas') {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + offsetUnits * 7);
    return d;
  }
  if (unit === 'Meses') {
    const d = new Date(baseDate);
    d.setMonth(d.getMonth() + offsetUnits);
    return d;
  }
  if (excludeWeekends) return addBusinessDays(baseDate, offsetUnits);
  const d = new Date(baseDate);
  d.setDate(d.getDate() + offsetUnits);
  return d;
}

export function formatDate(date) {
  return date.toLocaleDateString(getLocale(), { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function computeSchedule(tasks) {
  // Las subtareas se acotan siempre al rango de su tarea padre ya calculada.
  const byId = {};
  return tasks.map((t) => {
    const duration = Number(t.duration || 0);
    let start = typeof t.manualStart === 'number' ? t.manualStart : 0;
    let end = start + duration;
    const parent = t.parentId ? byId[t.parentId] : null;
    if (parent) {
      const maxStart = Math.max(parent.start, parent.end - duration);
      start = Math.min(Math.max(start, parent.start), maxStart);
      end = start + duration;
      if (end > parent.end) {
        end = parent.end;
        start = Math.max(parent.start, end - duration);
      }
    }
    const result = { ...t, start, end };
    byId[t.id] = result;
    return result;
  });
}

export function getParentBounds(taskId, tasks) {
  const byId = {};
  tasks.forEach((t) => (byId[t.id] = t));
  const task = byId[taskId];
  if (!task || !task.parentId || !byId[task.parentId]) return null;
  const scheduled = computeSchedule(tasks);
  const parent = scheduled.find((t) => t.id === task.parentId);
  return parent ? { start: parent.start, end: parent.end } : null;
}

const ORDINAL_LABELS = { 1: '1er', 2: '2do', 3: '3er', 4: '4to', 5: '5to', 6: '6to', 7: '7mo', 8: '8vo', 9: '9no', 10: '10mo', 11: '11vo', 12: '12vo' };

export function ordinalLabel(n) {
  if (getLang() === 'en') {
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
    const suffix = { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th';
    return `${n}${suffix}`;
  }
  return ORDINAL_LABELS[n] || `${n}º`;
}

export function deliverableMarkerLabel(n) {
  return `${ordinalLabel(n)} ${tr('Entregable', 'Deliverable')}`;
}

export function computeDeliverableLanes(deliverables, cellWidth) {
  // Reparte las etiquetas en carriles para que nunca se encimen horizontalmente.
  const lanes = [];
  const laneOf = {};
  (deliverables || [])
    .map((d, i) => ({ i, pos: typeof d.position === 'number' ? d.position : 0 }))
    .sort((a, b) => a.pos - b.pos)
    .forEach(({ i, pos }) => {
      const title = deliverableMarkerLabel(i + 1);
      const w = title.length * 6.4 + 20;
      const left = pos * cellWidth - w / 2;
      let lane = 0;
      while (lanes[lane] != null && lanes[lane] > left - 6) lane++;
      lanes[lane] = left + w;
      laneOf[i] = lane;
    });
  return { laneOf, laneCount: Math.max(1, lanes.length) };
}

export function shadeInterval(unit, excludeWeekends) {
  if (unit === 'Semanas') return 4;
  if (unit === 'Meses') return 3;
  return excludeWeekends ? 5 : 7;
}

export function buildShadeGradient(cellWidth, maxEnd, unit, excludeWeekends, isDark = false) {
  const interval = shadeInterval(unit, excludeWeekends);
  if (maxEnd < interval) return 'none';
  const stops = [];
  for (let i = 1; i <= maxEnd; i++) {
    const tone = isDark ? '255,255,255' : '15,26,22';
    const color = i % interval === 0 ? `rgba(${tone},${isDark ? 0.07 : 0.09})` : `rgba(${tone},0)`;
    stops.push(`${color} ${(i - 1) * cellWidth}px`, `${color} ${i * cellWidth}px`);
  }
  return `linear-gradient(to right, ${stops.join(', ')})`;
}

export const FIXED_BASE_WIDTH = 434; // asa + # + nombre + duración
export const EXTRA_COLUMN_WIDTHS = [92, 92, 92, 140]; // Depende de, Fecha inicio, Fecha fin, Responsable
export const MAX_COLUMN_LEVEL = EXTRA_COLUMN_WIDTHS.length;

export function clampColumnLevel(level) {
  const n = Number(level);
  if (!Number.isFinite(n)) return MAX_COLUMN_LEVEL;
  return Math.max(0, Math.min(MAX_COLUMN_LEVEL, Math.round(n)));
}

export function fixedColsWidth(level) {
  return FIXED_BASE_WIDTH + EXTRA_COLUMN_WIDTHS.slice(0, clampColumnLevel(level)).reduce((a, b) => a + b, 0);
}

// Mezcla `top` sobre `base` (ambos #RRGGBB): amount=1 devuelve top, amount=0 devuelve base.
export function mixColors(top, base, amount) {
  const parse = (hex) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
    const n = parseInt(m ? m[1] : 'FFFFFF', 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const a = parse(top);
  const b = parse(base);
  const out = a.map((v, i) => Math.round(b[i] * (1 - amount) + v * amount));
  return '#' + out.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
}

export function isPaleColor(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ""));
  if (!m) return true;
  const n = parseInt(m[1], 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.85;
}

const UNIT_LABELS = { Días: ['día', 'días'], Semanas: ['semana', 'semanas'], Meses: ['mes', 'meses'] };
const UNIT_LABELS_EN = { Días: ['day', 'days'], Semanas: ['week', 'weeks'], Meses: ['month', 'months'] };

export function durationLabel(units, unit) {
  if (!units) return '—';
  const labels = getLang() === 'en' ? UNIT_LABELS_EN : UNIT_LABELS;
  const [one, many] = labels[unit] || labels['Días'];
  return `${units} ${units === 1 ? one : many}`;
}

export function formatShortDate(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(getLocale(), { day: '2-digit', month: 'short', year: 'numeric' });
}

// Reordenar filas arrastrando conserva el nivel: un ítem raíz solo se mueve entre raíces y un sub-ítem solo
// entre los hermanos de su padre. Un grupo desplegado se salta completo: hacia abajo el ítem cae después de
// la última fila visible del grupo (cursor en su mitad inferior); hacia arriba, antes de la fila padre
// (cursor en su mitad superior). Devuelve la nueva lista de tareas, o null si no hay cambio.
export function moveRowOnDragOver(tasks, draggingId, targetIndex, inLowerHalf, collapsedIds) {
  const sourceIndex = tasks.findIndex((t) => t.id === draggingId);
  if (sourceIndex === -1 || sourceIndex === targetIndex || !tasks[targetIndex]) return null;

  const subtreeIdx = getSubtreeIndices(sourceIndex, tasks);
  if (subtreeIdx.includes(targetIndex)) return null;

  const sourceTask = tasks[sourceIndex];
  let anchor = tasks[targetIndex];
  while (anchor && (anchor.parentId || null) !== (sourceTask.parentId || null)) {
    const parentId = anchor.parentId;
    anchor = parentId ? tasks.find((t) => t.id === parentId) : null;
  }
  if (!anchor) return null;
  const anchorIndex = tasks.findIndex((t) => t.id === anchor.id);
  if (anchorIndex === sourceIndex) return null;

  const anchorSubtree = getSubtreeIndices(anchorIndex, tasks);
  const visibleRows = anchorSubtree.filter((i) => !getAncestorIds(tasks[i].id, tasks).some((aid) => collapsedIds.has(aid)));
  const lastVisible = visibleRows[visibleRows.length - 1];
  const movingDown = sourceIndex < anchorIndex;
  if (movingDown) {
    if (targetIndex !== lastVisible || !inLowerHalf) return null;
  } else if (targetIndex !== anchorIndex || inLowerHalf) {
    return null;
  }

  const block = subtreeIdx.map((i) => tasks[i]);
  const remaining = tasks.filter((_, i) => !subtreeIdx.includes(i));
  const anchorPos = remaining.findIndex((t) => t.id === anchor.id);
  let insertAt = anchorPos;
  if (movingDown) {
    const anchorBlock = getSubtreeIndices(anchorPos, remaining);
    insertAt = anchorBlock[anchorBlock.length - 1] + 1;
  }
  remaining.splice(insertAt, 0, ...block);
  return remaining;
}

export function computeProjectSpan(project) {
  const tasks = (project && project.tasks) || [];
  const units = tasks.length ? Math.max(0, ...computeSchedule(tasks).map((t) => t.end)) : 0;
  let endDate = null;
  if (project && project.startDate && units > 0) {
    endDate = offsetDate(new Date(project.startDate + 'T00:00:00'), units, project.unit || 'Días', !!project.excludeWeekends);
  }
  return { units, endDate };
}

export function computeProjectEndDateLabel(project) {
  if (!project || !project.startDate) return '—';
  const tasks = project.tasks || [];
  if (!tasks.length) return '—';
  const scheduled = computeSchedule(tasks);
  const maxEnd = Math.max(0, ...scheduled.map((t) => t.end));
  const baseDate = new Date(project.startDate + 'T00:00:00');
  return formatDate(offsetDate(baseDate, maxEnd, project.unit || 'Días', !!project.excludeWeekends));
}

export const BAR_COLORS = ['#00A887', '#2563EB', '#7C3AED', '#D97706', '#DC2626', '#0EA5E9'];
