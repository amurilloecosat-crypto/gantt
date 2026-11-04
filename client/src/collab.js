import { tr } from './lang.js';

const SCALAR_FIELDS = ['name', 'unit', 'startDate', 'excludeWeekends', 'notesHtml', 'headerBg', 'headerFg'];

function deepEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return a == b;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => deepEqual(a[k], b[k]));
}

function mergeFields(base, mine, theirs) {
  const out = {};
  const keys = new Set([...Object.keys(base || {}), ...Object.keys(mine || {}), ...Object.keys(theirs || {})]);
  keys.forEach((k) => {
    const value = deepEqual(mine?.[k], base?.[k]) ? theirs?.[k] : mine?.[k];
    if (value !== undefined) out[k] = value;
  });
  return out;
}

function orderIds(primary, secondary, keep) {
  const out = primary.filter((id) => keep.has(id));
  const inOut = new Set(out);
  secondary.forEach((id, i) => {
    if (!keep.has(id) || inOut.has(id)) return;
    let at = out.length;
    for (let j = i + 1; j < secondary.length; j += 1) {
      const nextIdx = out.indexOf(secondary[j]);
      if (nextIdx !== -1) {
        at = nextIdx;
        break;
      }
    }
    out.splice(at, 0, id);
    inOut.add(id);
  });
  return out;
}

export function mergeById(baseList = [], mineList = [], theirList = []) {
  const bMap = new Map(baseList.map((x) => [x.id, x]));
  const mMap = new Map(mineList.map((x) => [x.id, x]));
  const tMap = new Map(theirList.map((x) => [x.id, x]));
  const result = new Map();
  const allIds = new Set([...bMap.keys(), ...mMap.keys(), ...tMap.keys()]);

  allIds.forEach((id) => {
    const b = bMap.get(id);
    const m = mMap.get(id);
    const t = tMap.get(id);
    if (m && t) {
      result.set(id, b ? mergeFields(b, m, t) : m);
    } else if (m && !t) {
      if (!b || !deepEqual(b, m)) result.set(id, m);
    } else if (!m && t) {
      if (!b) result.set(id, t);
    }
  });

  const baseOrder = baseList.map((x) => x.id);
  const mineCommon = mineList.map((x) => x.id).filter((id) => bMap.has(id));
  const baseCommon = baseOrder.filter((id) => mMap.has(id));
  const iReordered = !deepEqual(mineCommon, baseCommon);
  const keep = new Set(result.keys());
  const order = iReordered
    ? orderIds(mineList.map((x) => x.id), theirList.map((x) => x.id), keep)
    : orderIds(theirList.map((x) => x.id), mineList.map((x) => x.id), keep);

  return order.map((id) => result.get(id));
}

export function mergeProject(base, mine, theirs) {
  const merged = { ...theirs };
  SCALAR_FIELDS.forEach((k) => {
    merged[k] = deepEqual(mine[k], base[k]) ? theirs[k] : mine[k];
  });
  merged.guidePosition = mine.guidePosition;

  const tasks = mergeById(base.tasks, mine.tasks, theirs.tasks);
  const ids = new Set(tasks.map((t) => t.id));
  merged.tasks = tasks.map((t) => {
    const fixed = { ...t };
    if (fixed.parentId && !ids.has(fixed.parentId)) fixed.parentId = null;
    if (fixed.dependency && !ids.has(fixed.dependency)) fixed.dependency = '';
    return fixed;
  });
  merged.deliverables = mergeById(base.deliverables, mine.deliverables, theirs.deliverables);
  return merged;
}

export function projectsEqual(a, b) {
  return SCALAR_FIELDS.every((k) => deepEqual(a[k], b[k])) && deepEqual(a.tasks, b.tasks) && deepEqual(a.deliverables, b.deliverables);
}

export function stripHtml(html) {
  return String(html || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

const MAX_ENTRIES = 12;

export function diffProject(base, next) {
  const entries = [];
  const q = (s) => `"${s}"`;
  const label = (t) => q(stripHtml(t.name) || tr('Sin nombre', 'Unnamed'));

  if (base.name !== next.name) entries.push(tr(`Cambió el nombre del proyecto de ${q(base.name)} a ${q(next.name)}`, `Renamed the project from ${q(base.name)} to ${q(next.name)}`));
  if (base.unit !== next.unit) entries.push(tr(`Cambió la unidad de tiempo de ${base.unit} a ${next.unit}`, `Changed the time unit from ${base.unit} to ${next.unit}`));
  if ((base.startDate || '') !== (next.startDate || '')) {
    entries.push(next.startDate ? tr(`Cambió la fecha de inicio a ${next.startDate}`, `Changed the start date to ${next.startDate}`) : tr('Quitó la fecha de inicio', 'Removed the start date'));
  }
  if (!!base.excludeWeekends !== !!next.excludeWeekends) {
    entries.push(next.excludeWeekends ? tr('Activó "Excluir fines de semana"', 'Turned on "Exclude weekends"') : tr('Desactivó "Excluir fines de semana"', 'Turned off "Exclude weekends"'));
  }
  if (base.headerBg !== next.headerBg || base.headerFg !== next.headerFg) entries.push(tr('Cambió los colores del encabezado del Gantt', 'Changed the Gantt header colors'));
  if ((base.notesHtml || '') !== (next.notesHtml || '')) entries.push(tr('Editó las notas del proyecto', 'Edited the project notes'));

  const bTasks = new Map((base.tasks || []).map((t) => [t.id, t]));
  const nTasks = new Map((next.tasks || []).map((t) => [t.id, t]));
  const byId = (id) => bTasks.get(id) || nTasks.get(id);
  const levelWord = (t) => (t.parentId ? tr('la subtarea', 'the subtask') : tr('la fila', 'the row'));

  nTasks.forEach((t, id) => {
    if (!bTasks.has(id)) entries.push(tr(`Agregó ${levelWord(t)} ${label(t)}`, `Added ${levelWord(t)} ${label(t)}`));
  });
  bTasks.forEach((t, id) => {
    if (!nTasks.has(id)) entries.push(tr(`Eliminó ${levelWord(t)} ${label(t)}`, `Deleted ${levelWord(t)} ${label(t)}`));
  });

  const moved = [];
  nTasks.forEach((n, id) => {
    const b = bTasks.get(id);
    if (!b) return;
    if (stripHtml(b.name) !== stripHtml(n.name)) {
      entries.push(tr(`Renombró ${q(stripHtml(b.name))} a ${q(stripHtml(n.name))}`, `Renamed ${q(stripHtml(b.name))} to ${q(stripHtml(n.name))}`));
    } else if (b.name !== n.name) {
      entries.push(tr(`Cambió el formato del nombre de ${label(n)}`, `Changed the name formatting of ${label(n)}`));
    }
    if (Number(b.duration) !== Number(n.duration)) {
      entries.push(tr(`Cambió la duración de ${label(n)} de ${b.duration} a ${n.duration}`, `Changed the duration of ${label(n)} from ${b.duration} to ${n.duration}`));
    }
    if ((b.dependency || '') !== (n.dependency || '')) {
      const dep = n.dependency ? label(byId(n.dependency) || { name: n.dependency }) : tr('ninguna', 'none');
      entries.push(tr(`Cambió la dependencia de ${label(n)} a ${dep}`, `Changed the dependency of ${label(n)} to ${dep}`));
    }
    if ((b.responsible || '') !== (n.responsible || '')) {
      entries.push(tr(`Cambió el responsable de ${label(n)} a ${n.responsible ? q(n.responsible) : 'nadie'}`, `Changed the owner of ${label(n)} to ${n.responsible ? q(n.responsible) : 'nobody'}`));
    }
    if ((b.color || '') !== (n.color || '')) entries.push(tr(`Cambió el color de ${label(n)}`, `Changed the color of ${label(n)}`));
    if ((b.parentId || null) !== (n.parentId || null)) entries.push(tr(`Cambió la jerarquía de ${label(n)}`, `Changed the hierarchy of ${label(n)}`));
    if (Number(b.manualStart || 0) !== Number(n.manualStart || 0)) moved.push(n);
  });
  if (moved.length === 1) entries.push(tr(`Movió la barra de ${label(moved[0])}`, `Moved the bar of ${label(moved[0])}`));
  else if (moved.length > 1) {
    const list = `${moved.slice(0, 3).map(label).join(', ')}${moved.length > 3 ? '…' : ''}`;
    entries.push(tr(`Movió las barras de ${moved.length} filas (${list})`, `Moved the bars of ${moved.length} rows (${list})`));
  };

  const commonBase = (base.tasks || []).map((t) => t.id).filter((id) => nTasks.has(id));
  const commonNext = (next.tasks || []).map((t) => t.id).filter((id) => bTasks.has(id));
  if (!deepEqual(commonBase, commonNext)) entries.push(tr('Reordenó las filas del cronograma', 'Reordered the schedule rows'));

  const bDel = new Map((base.deliverables || []).map((d) => [d.id, d]));
  const nDel = new Map((next.deliverables || []).map((d) => [d.id, d]));
  const dLabel = (d) => q(d.description || tr('sin descripción', 'no description'));
  nDel.forEach((d, id) => {
    const b = bDel.get(id);
    if (!b) entries.push(tr(`Agregó el entregable ${dLabel(d)}`, `Added the deliverable ${dLabel(d)}`));
    else {
      if ((b.description || '') !== (d.description || '')) entries.push(tr(`Cambió la descripción de un entregable a ${dLabel(d)}`, `Changed the description of a deliverable to ${dLabel(d)}`));
      if (Number(b.position) !== Number(d.position)) entries.push(tr(`Movió el entregable ${dLabel(d)}`, `Moved the deliverable ${dLabel(d)}`));
      if ((b.color || '') !== (d.color || '')) entries.push(tr(`Cambió el color del entregable ${dLabel(d)}`, `Changed the color of the deliverable ${dLabel(d)}`));
    }
  });
  bDel.forEach((d, id) => {
    if (!nDel.has(id)) entries.push(tr(`Eliminó el entregable ${dLabel(d)}`, `Deleted the deliverable ${dLabel(d)}`));
  });

  if (entries.length > MAX_ENTRIES) {
    const extra = entries.length - (MAX_ENTRIES - 1);
    return [...entries.slice(0, MAX_ENTRIES - 1), tr(`…y ${extra} cambios más`, `…and ${extra} more changes`)];
  }
  return entries;
}
