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
  return date.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function computeSchedule(tasks) {
  return tasks.map((t) => {
    const start = typeof t.manualStart === 'number' ? t.manualStart : 0;
    const end = start + Number(t.duration || 0);
    return { ...t, start, end };
  });
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
