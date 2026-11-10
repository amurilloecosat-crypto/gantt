import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import Header from '../components/Header.jsx';
import NotesEditor from '../components/NotesEditor.jsx';
import GanttTable from '../components/GanttTable.jsx';
import DeliverablesTable from '../components/DeliverablesTable.jsx';
import ColorPicker from '../components/ColorPicker.jsx';
import { ChangesModal, MembersModal } from '../components/CollabPanels.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import ecosatLogo from '../assets/ecosat-logo.png';
import { useAuth } from '../AuthContext.jsx';
import { useTheme } from '../ThemeContext.jsx';
import { api } from '../api';
import { useI18n, tr } from '../i18n.jsx';
import { supabase } from '../supabaseClient';
import { diffProject, mergeProject, projectsEqual, stripHtml } from '../collab.js';
import { colors, fonts } from '../theme.js';
import { clampColumnLevel, computeProjectEndDateLabel, computeProjectSpan, computeSchedule, durationLabel, fixedColsWidth, formatShortDate, getParentBounds, getSubtreeIndices, hasChildren, isPaleColor, lightenColor, moveRowOnDragOver, taskLevel } from '../ganttUtils.js';

const COLUMN_LEVEL_KEY = 'ariadna.columnLevel';
const EXPORT_STYLE_KEY = 'ariadna.exportStyle';

function readExportStyle() {
  try {
    return window.localStorage.getItem(EXPORT_STYLE_KEY) === 'corporate' ? 'corporate' : 'insert';
  } catch (err) {
    return 'insert';
  }
}

function readColumnLevel() {
  try {
    const raw = window.localStorage.getItem(COLUMN_LEVEL_KEY);
    return raw === null ? 4 : clampColumnLevel(raw);
  } catch (err) {
    return 4;
  }
}

const TIME_UNITS = ['Días', 'Semanas', 'Meses'];

function unitLabel(unit) {
  if (unit === 'Días') return tr('Días', 'Days');
  if (unit === 'Semanas') return tr('Semanas', 'Weeks');
  if (unit === 'Meses') return tr('Meses', 'Months');
  return unit;
}

function unitButtonStyle(isActive) {
  return {
    padding: '9px 16px',
    borderRadius: '10px',
    border: isActive ? `1.5px solid ${colors.primary}` : `1.5px solid ${colors.inputBorder}`,
    background: isActive ? colors.primaryTint : colors.surface,
    color: isActive ? colors.primaryDark : colors.textMuted,
    font: `600 14px ${fonts.body}`,
    cursor: 'pointer',
  };
}

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draggingTaskId, setDraggingTaskId] = useState(null);
  const [draggingDeliverableId, setDraggingDeliverableId] = useState(null);
  const [colorPickerFor, setColorPickerFor] = useState(null);
  const [colorPickerPos, setColorPickerPos] = useState({ x: 0, y: 0 });
  const [collapsedIds, setCollapsedIds] = useState(() => new Set());
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [columnLevel, setColumnLevelState] = useState(readColumnLevel);
  const [saveStatus, setSaveStatus] = useState({ status: 'saved', at: null });
  const [exportOpen, setExportOpen] = useState(false);
  const [exportStyle, setExportStyleState] = useState(readExportStyle);
  const [exporting, setExporting] = useState(null);
  const [exportError, setExportError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [members, setMembers] = useState([]);
  const [membersOpen, setMembersOpen] = useState(false);
  const [changesOpen, setChangesOpen] = useState(false);
  const { user } = useAuth();
  const { isDark, setTheme } = useTheme();
  const { t, locale } = useI18n();
  const exportRef = useRef(null);
  const saveTimeout = useRef(null);
  const dragSourceId = useRef(null);
  const dragSourceDeliverableId = useRef(null);
  const baseRef = useRef(null);
  const latestRef = useRef(null);
  const savingRef = useRef(false);
  const rerunRef = useRef(false);
  const remotePendingRef = useRef(false);
  const membersRef = useRef([]);
  const membersLoadedRef = useRef(false);
  const userNameRef = useRef('');

  membersRef.current = members;
  userNameRef.current = user ? user.name : '';
  const isShared = members.length > 1;
  const isOwner = !!project && !!user && project.userId === user.id;

  useEffect(() => {
    let cancelled = false;
    membersLoadedRef.current = false;
    api
      .getProject(id)
      .then(({ project }) => {
        if (cancelled) return;
        const initial = { deliverables: [], headerBg: '#F5F8F7', headerFg: '#475A52', guidePosition: 0, ...project };
        baseRef.current = initial;
        latestRef.current = initial;
        setProject(initial);
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    const loadMembers = (retries) =>
      api
        .listMembers(id)
        .then((list) => {
          if (cancelled) return;
          membersLoadedRef.current = true;
          setMembers(list);
        })
        .catch(() => {
          if (retries > 0 && !cancelled) setTimeout(() => loadMembers(retries - 1), 1500);
        });
    loadMembers(2);
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Trae la versión del servidor y la fusiona con lo que tengo en pantalla sin perder mis cambios sin guardar.
  const applyRemote = useCallback(async () => {
    if (savingRef.current) {
      remotePendingRef.current = true;
      return;
    }
    try {
      const { project: fetched } = await api.getProject(id);
      const base = baseRef.current;
      const mine = latestRef.current;
      if (!base || !mine || fetched.updatedAt === base.updatedAt) return;
      const theirs = { deliverables: [], headerBg: '#F5F8F7', headerFg: '#475A52', guidePosition: 0, ...fetched };
      const merged = mergeProject(base, mine, theirs);
      const active = document.activeElement;
      if (active && active.closest && active.closest('[data-export="notes-wrap"]')) merged.notesHtml = mine.notesHtml;
      baseRef.current = theirs;
      latestRef.current = merged;
      if (!projectsEqual(merged, mine)) setProject(merged);
    } catch (err) {
      if (['Proyecto no encontrado', 'Project not found'].includes(err.message)) setError(t('Este proyecto fue eliminado o ya no tienes acceso.', 'This project was deleted or you no longer have access.'));
    }
  }, [id]);

  const flushSave = useCallback(async () => {
    if (savingRef.current) {
      rerunRef.current = true;
      return;
    }
    const mine = latestRef.current;
    const base = baseRef.current;
    if (!mine || !base || (projectsEqual(mine, base) && mine.guidePosition === base.guidePosition)) return;
    savingRef.current = true;
    setSaveStatus({ status: 'saving', at: null });
    try {
      let shared = membersRef.current.length > 1;
      if (!shared && !membersLoadedRef.current) {
        try {
          const list = await api.listMembers(id);
          membersLoadedRef.current = true;
          setMembers(list);
          shared = list.length > 1;
        } catch (err) {
          shared = false;
        }
      }
      const changes = shared ? diffProject(base, mine) : [];
      const { saved, written } = await api.saveProjectMerged(id, base, mine);
      baseRef.current = { deliverables: [], headerBg: '#F5F8F7', headerFg: '#475A52', guidePosition: 0, ...saved };
      setSaveStatus({ status: 'saved', at: new Date() });
      if (!projectsEqual(written, mine)) {
        const merged = mergeProject(mine, latestRef.current, written);
        latestRef.current = merged;
        setProject(merged);
      }
      if (changes.length) {
        api.addChanges(id, changes, userNameRef.current).catch((err) => {
          console.warn('addChanges', err);
          setError(t('No se pudo registrar en la bitácora: ', 'Could not record in the change log: ') + err.message);
        });
      }
    } catch (err) {
      setSaveStatus({ status: 'error', at: null });
      setError(err.message);
    } finally {
      savingRef.current = false;
      if (rerunRef.current) {
        rerunRef.current = false;
        flushSave();
      } else if (remotePendingRef.current) {
        remotePendingRef.current = false;
        applyRemote();
      }
    }
  }, [id, applyRemote]);

  useEffect(() => {
    const channel = supabase
      .channel(`project-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'projects', filter: `id=eq.${id}` }, () => applyRemote())
      .subscribe();
    const poll = setInterval(async () => {
      try {
        const updatedAt = await api.getProjectUpdatedAt(id);
        if (updatedAt && baseRef.current && updatedAt !== baseRef.current.updatedAt) applyRemote();
      } catch (err) {
        // El siguiente ciclo reintenta.
      }
    }, 30000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [id, applyRemote]);

  const scheduleSave = useCallback(
    (nextProject) => {
      latestRef.current = nextProject;
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(flushSave, 500);
    },
    [flushSave]
  );

  function patchProject(patch) {
    setProject((prev) => {
      const next = { ...prev, ...patch };
      scheduleSave(next);
      return next;
    });
  }

  function updateTask(index, patch) {
    setProject((prev) => {
      const tasks = prev.tasks.slice();
      tasks[index] = { ...tasks[index], ...patch };
      const next = { ...prev, tasks };
      scheduleSave(next);
      return next;
    });
  }

  function addTask() {
    setProject((prev) => {
      const tasks = prev.tasks.slice();
      const guidePosition = typeof prev.guidePosition === 'number' ? prev.guidePosition : 0;
      tasks.push({ id: 't' + Date.now(), name: tr('Nueva tarea', 'New task'), parentId: null, duration: 1, dependency: '', manualStart: guidePosition, color: '#00A887' });
      const next = { ...prev, tasks };
      scheduleSave(next);
      return next;
    });
  }

  function addSubtask(index) {
    setProject((prev) => {
      const tasks = prev.tasks.slice();
      if (taskLevel(tasks[index].id, tasks) >= 2) return prev;
      const guidePosition = typeof prev.guidePosition === 'number' ? prev.guidePosition : 0;
      const subtreeIdx = getSubtreeIndices(index, tasks);
      const insertAt = subtreeIdx[subtreeIdx.length - 1] + 1;
      tasks.splice(insertAt, 0, { id: 't' + Date.now(), name: tr('Nueva subtarea', 'New subtask'), parentId: tasks[index].id, duration: 1, dependency: '', manualStart: guidePosition });
      const next = { ...prev, tasks };
      scheduleSave(next);
      return next;
    });
  }

  function setColumnLevel(level) {
    const next = clampColumnLevel(level);
    setColumnLevelState(next);
    try {
      window.localStorage.setItem(COLUMN_LEVEL_KEY, String(next));
    } catch (err) {
      // Sin almacenamiento: la vista simplemente no se recuerda.
    }
  }

  function setGuidePosition(pos) {
    patchProject({ guidePosition: pos });
  }

  function startGuideDrag(originalPosition, cellWidth, maxEnd, e) {
    e.preventDefault();
    const startX = e.clientX;
    const onMove = (ev) => {
      const deltaUnits = Math.round((ev.clientX - startX) / cellWidth);
      const next = Math.max(0, Math.min(maxEnd, originalPosition + deltaUnits));
      patchProject({ guidePosition: next });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function requestDeleteTask(index) {
    const tasks = project.tasks;
    const task = tasks[index];
    const name = stripHtml(task.name);
    const childCount = getSubtreeIndices(index, tasks).length - 1;
    const isUntouched = !name || ['Nueva tarea', 'Nueva subtarea', 'New task', 'New subtask'].includes(name);
    if (childCount === 0 && isUntouched) {
      deleteTask(index);
      return;
    }
    setConfirmDelete({ id: task.id, name: name || t('Sin nombre', 'Unnamed'), childCount });
  }

  function confirmDeleteTask() {
    if (!confirmDelete) return;
    const index = project.tasks.findIndex((t) => t.id === confirmDelete.id);
    setConfirmDelete(null);
    if (index !== -1) deleteTask(index);
  }

  function deleteTask(index) {
    setProject((prev) => {
      const tasks = prev.tasks;
      const remove = new Set(getSubtreeIndices(index, tasks).map((i) => tasks[i].id));
      const nextTasks = tasks
        .filter((t) => !remove.has(t.id))
        .map((t) => (remove.has(t.dependency) ? { ...t, dependency: '' } : t));
      const next = { ...prev, tasks: nextTasks };
      scheduleSave(next);
      return next;
    });
  }

  function handleRowDragStart(index, e) {
    e.dataTransfer.setData('text/plain', String(index));
    e.dataTransfer.effectAllowed = 'move';
    dragSourceId.current = project.tasks[index].id;
    setDraggingTaskId(project.tasks[index].id);
  }

  function handleRowDragOver(targetIndex, e) {
    e.preventDefault();
    const draggingId = dragSourceId.current;
    if (!draggingId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const inLowerHalf = e.clientY > rect.top + rect.height / 2;
    setProject((prev) => {
      const nextTasks = moveRowOnDragOver(prev.tasks, draggingId, targetIndex, inLowerHalf, collapsedIds);
      if (!nextTasks) return prev;
      const next = { ...prev, tasks: nextTasks };
      scheduleSave(next);
      return next;
    });
  }

  function handleRowDrop(e) {
    e.preventDefault();
    dragSourceId.current = null;
    setDraggingTaskId(null);
  }

  function handleRowDragEnd() {
    dragSourceId.current = null;
    setDraggingTaskId(null);
  }

  function startBarDrag(rowIndex, originalStart, cellWidth, e) {
    e.preventDefault();
    const startX = e.clientX;
    const tasks = project.tasks;
    const task = tasks[rowIndex];
    const bounds = getParentBounds(task.id, tasks);
    const duration = Number(task.duration || 0);
    // Arrastrar un padre o subitem mueve toda su rama junta, conservando el acomodo relativo.
    // Usamos el inicio ya acotado (computeSchedule), no el manualStart crudo: si el crudo excede
    // el rango válido del padre, sumarle un pequeño delta no cambia el resultado acotado y la
    // barra parece no moverse nunca.
    const subtreeIdx = getSubtreeIndices(rowIndex, tasks);
    const scheduledById = {};
    computeSchedule(tasks).forEach((s) => { scheduledById[s.id] = s; });
    const originalStarts = subtreeIdx.map((i) => scheduledById[tasks[i].id].start);

    // Auto-scroll: si el cursor se acerca a la orilla del área con scroll, esta se
    // desplaza sola mientras se sigue arrastrando (más rápido mientras más cerca del borde).
    const scrollEl = e.target.closest('[data-export="gantt-scroll"]');
    const EDGE = 60;
    const MAX_SPEED = 18;
    let scrollAccum = 0;
    let lastClientX = startX;
    let rafId = null;

    const applyMove = (clientX) => {
      const deltaUnits = Math.round((clientX - startX + scrollAccum) / cellWidth);
      let next = Math.max(0, originalStart + deltaUnits);
      if (bounds) next = Math.min(Math.max(next, bounds.start), Math.max(bounds.start, bounds.end - duration));
      const delta = next - originalStart;
      setProject((prev) => {
        const curTasks = prev.tasks.slice();
        subtreeIdx.forEach((idx, k) => {
          curTasks[idx] = { ...curTasks[idx], manualStart: originalStarts[k] + delta };
        });
        const nextProject = { ...prev, tasks: curTasks };
        scheduleSave(nextProject);
        return nextProject;
      });
    };

    const autoScrollStep = () => {
      if (!scrollEl) {
        rafId = null;
        return;
      }
      const rect = scrollEl.getBoundingClientRect();
      let speed = 0;
      if (lastClientX < rect.left + EDGE) {
        speed = -Math.ceil(((rect.left + EDGE - lastClientX) / EDGE) * MAX_SPEED);
      } else if (lastClientX > rect.right - EDGE) {
        speed = Math.ceil(((lastClientX - (rect.right - EDGE)) / EDGE) * MAX_SPEED);
      }
      if (speed !== 0) {
        const before = scrollEl.scrollLeft;
        scrollEl.scrollLeft = Math.max(0, Math.min(scrollEl.scrollWidth, before + speed));
        scrollAccum += scrollEl.scrollLeft - before;
        applyMove(lastClientX);
      }
      rafId = requestAnimationFrame(autoScrollStep);
    };

    const onMove = (ev) => {
      lastClientX = ev.clientX;
      applyMove(ev.clientX);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (rafId) cancelAnimationFrame(rafId);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    rafId = requestAnimationFrame(autoScrollStep);
  }

  function selectBarColor(target, color) {
    if (target === 'all:tasks') {
      applyColorToAllTasks(color);
      setColorPickerFor(null);
      return;
    }
    if (target === 'all:delivs') {
      applyColorToAllDeliverables(color);
      setColorPickerFor(null);
      return;
    }
    if (typeof target === 'string' && target.indexOf('deliv:') === 0) {
      updateDeliverable(Number(target.slice(6)), { color });
      setColorPickerFor(null);
      return;
    }
    const idx = project.tasks.findIndex((t) => t.id === target);
    if (idx !== -1) updateTask(idx, { color });
    setColorPickerFor(null);
  }

  function applyColorToAllTasks(color) {
    setProject((prev) => {
      const tasks = (prev.tasks || []).map((t) => (t.parentId ? t : { ...t, color }));
      const next = { ...prev, tasks };
      scheduleSave(next);
      return next;
    });
  }

  function applyColorToAllDeliverables(color) {
    setProject((prev) => {
      const deliverables = (prev.deliverables || []).map((d) => ({ ...d, color }));
      const next = { ...prev, deliverables };
      scheduleSave(next);
      return next;
    });
  }

  function toggleCollapse(taskId) {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }

  function addDeliverable() {
    setProject((prev) => {
      const deliverables = (prev.deliverables || []).slice();
      const lastPos = deliverables.length ? Math.max(...deliverables.map((d) => (typeof d.position === 'number' ? d.position : 0))) : -1;
      deliverables.push({ id: 'd' + Date.now(), description: '', position: lastPos + 1, color: '#DC2626' });
      const next = { ...prev, deliverables };
      scheduleSave(next);
      return next;
    });
  }

  function deleteDeliverable(index) {
    setProject((prev) => {
      const deliverables = (prev.deliverables || []).filter((_, i) => i !== index);
      const next = { ...prev, deliverables };
      scheduleSave(next);
      return next;
    });
  }

  function updateDeliverable(index, patch) {
    setProject((prev) => {
      const deliverables = (prev.deliverables || []).slice();
      deliverables[index] = { ...deliverables[index], ...patch };
      const next = { ...prev, deliverables };
      scheduleSave(next);
      return next;
    });
  }

  function handleDeliverableDragStart(index, e) {
    e.dataTransfer.setData('text/plain', String(index));
    e.dataTransfer.effectAllowed = 'move';
    dragSourceDeliverableId.current = project.deliverables[index].id;
    setDraggingDeliverableId(project.deliverables[index].id);
  }

  function handleDeliverableDragOver(targetIndex, e) {
    e.preventDefault();
    const draggingId = dragSourceDeliverableId.current;
    if (!draggingId) return;
    setProject((prev) => {
      const deliverables = (prev.deliverables || []).slice();
      const sourceIndex = deliverables.findIndex((d) => d.id === draggingId);
      if (sourceIndex === -1 || sourceIndex === targetIndex) return prev;
      const [moved] = deliverables.splice(sourceIndex, 1);
      deliverables.splice(targetIndex, 0, moved);
      const next = { ...prev, deliverables };
      scheduleSave(next);
      return next;
    });
  }

  function handleDeliverableDrop(e) {
    e.preventDefault();
    dragSourceDeliverableId.current = null;
    setDraggingDeliverableId(null);
  }

  function handleDeliverableDragEnd() {
    dragSourceDeliverableId.current = null;
    setDraggingDeliverableId(null);
  }

  function startDeliverableDrag(index, originalPos, cellWidth, e) {
    e.preventDefault();
    const startX = e.clientX;
    const onMove = (ev) => {
      const delta = Math.round((ev.clientX - startX) / cellWidth);
      updateDeliverable(index, { position: Math.max(0, originalPos + delta) });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  // La etiqueta de un entregable que cae en el último periodo se sale del borde derecho; solo entonces se reserva espacio.
  function exportNeedsRightRoom() {
    const units = Math.max(1, ...computeSchedule(project.tasks || []).map((t) => t.end));
    return (project.deliverables || []).some((d) => (typeof d.position === 'number' ? d.position : 0) >= units - 1);
  }

  function exportContentWidth() {
    const units = Math.max(1, ...computeSchedule(project.tasks || []).map((t) => t.end));
    const ganttWidth = fixedColsWidth(columnLevel) + units * 48;
    const onScreen = exportRef.current ? exportRef.current.offsetWidth : 0;
    return Math.max(onScreen, ganttWidth + 66 + (exportNeedsRightRoom() ? 48 : 0)); // padding del contenedor + bordes + holgura para la etiqueta del último entregable
  }

  function exportScale(rawWidth, rawHeight) {
    // Limita la resolución del canvas en proyectos muy grandes para no exceder el límite de
    // 14400px de jsPDF ni el tamaño máximo de string que puede generar el navegador al codificar el PNG.
    const MAX_DIMENSION = 8000;
    const MAX_PIXELS = 30_000_000;
    let scale = Math.min(2, MAX_DIMENSION / rawWidth, MAX_DIMENSION / rawHeight);
    scale = Math.min(scale, Math.sqrt(MAX_PIXELS / (rawWidth * rawHeight)));
    return Math.max(0.4, scale);
  }

  function setExportStyle(style) {
    setExportStyleState(style);
    try {
      window.localStorage.setItem(EXPORT_STYLE_KEY, style);
    } catch (err) {
      // Sin almacenamiento: el estilo no se recuerda.
    }
  }

  function prepareExportClone(clonedDoc, fullWidth, style) {
    const hasStart = !!project.startDate;
    const hasResponsible = (project.tasks || []).some((t) => (t.responsible || '').trim());
    const hide = (sel) => clonedDoc.querySelectorAll(sel).forEach((el) => { el.style.display = 'none'; });
    // Las celdas de fecha/responsable son ítems de un grid sin columna explícita: ocultarlas con
    // display:none corre el resto de columnas (el navegador reacomoda el auto-placement).
    // visibility:hidden las deja invisibles pero conserva su espacio en el grid.
    const hideKeepingLayout = (sel) => clonedDoc.querySelectorAll(sel).forEach((el) => { el.style.visibility = 'hidden'; });
    if (!hasStart) {
      hideKeepingLayout('[data-export="col-fecha-inicio"]');
      hideKeepingLayout('[data-export="col-fecha-fin"]');
      hideKeepingLayout('[data-export="cell-fecha-inicio"]');
      hideKeepingLayout('[data-export="cell-fecha-fin"]');
    }
    if (!hasResponsible) {
      hideKeepingLayout('[data-export="col-responsable"]');
      hideKeepingLayout('[data-export="cell-responsable"]');
    }
    // Ninguno de los dos estilos incluye el formulario de unidad y fechas.
    hide('[data-export="form-block"]');
    hide('[data-export="notes-hint"]');
    hide('[data-export="notes-toolbar"]');
    hide('[data-export="add-row-btn"]');
    hide('[data-export="add-child-btn"]');
    hide('[data-export="delete-row-btn"]');
    hide('[data-export="collapse-btn"]');
    hide('[data-export="edit-guide"]');
    hide('[data-export="col-resizer"]');
    clonedDoc.querySelectorAll('[data-export="drag-handle"]').forEach((el) => { el.style.visibility = 'hidden'; });
    clonedDoc.querySelectorAll('[data-export="notes-box"]').forEach((el) => { el.style.border = 'none'; });
    // En el exportable las listas desplegables se vuelven texto; sin dependencia se muestra un guion.
    const liveSelects = exportRef.current ? Array.from(exportRef.current.querySelectorAll('select')) : [];
    clonedDoc.querySelectorAll('select').forEach((sel, idx) => {
      const live = liveSelects[idx];
      const span = clonedDoc.createElement('span');
      span.textContent = live && live.value ? live.options[live.selectedIndex].text : '—';
      span.style.fontFamily = 'inherit';
      span.style.fontSize = '14px';
      span.style.padding = '6px 8px';
      span.style.display = 'inline-block';
      sel.replaceWith(span);
    });
    clonedDoc.querySelectorAll('input, select, textarea, [contenteditable="true"]').forEach((el) => {
      el.style.border = 'none';
      el.style.background = 'transparent';
      el.style.boxShadow = 'none';
    });
    if (style === 'corporate') {
      clonedDoc.querySelectorAll('[data-export="corp-header"], [data-export="corp-footer"]').forEach((el) => { el.style.display = 'flex'; });
    }
    // El exportable se despliega a su ancho real: el Gantt completo sin scroll y las Notas a todo lo ancho.
    const root = clonedDoc.querySelector('[data-export="export-root"]');
    if (root) {
      root.style.padding = style === 'corporate' ? '32px' : '12px';
      if (fullWidth) {
        root.style.width = fullWidth + 'px';
        root.style.maxWidth = 'none';
      }
    }
    clonedDoc.querySelectorAll('[data-export="gantt-scroll"]').forEach((el) => {
      el.style.overflow = 'visible';
      el.style.paddingRight = exportNeedsRightRoom() ? '48px' : '0px';
      el.style.width = 'max-content';
      el.style.minWidth = '100%';
    });
    clonedDoc.querySelectorAll('[data-export="notes-wrap"]').forEach((el) => { el.style.maxWidth = 'none'; });
  }

  async function downloadDocx(canvas, baseName) {
    const { Document, Packer, Paragraph, ImageRun, PageOrientation } = await import('docx');
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    const data = new Uint8Array(await blob.arrayBuffer());
    // Hoja carta apaisada con márgenes de 0.5": 960 x 700 px útiles a 96 dpi.
    const ratio = Math.min(960 / canvas.width, 700 / canvas.height);
    const doc = new Document({
      sections: [
        {
          properties: { page: { size: { width: 12240, height: 15840, orientation: PageOrientation.LANDSCAPE }, margin: { top: 720, right: 720, bottom: 720, left: 720 } } },
          children: [
            new Paragraph({
              children: [
                new ImageRun({
                  type: 'png',
                  data,
                  transformation: { width: Math.round(canvas.width * ratio), height: Math.round(canvas.height * ratio) },
                  altText: { name: tr('Cronograma', 'Schedule'), title: tr('Cronograma', 'Schedule'), description: tr('Cronograma del proyecto', 'Project schedule') },
                }),
              ],
            }),
          ],
        },
      ],
    });
    const out = await Packer.toBlob(doc);
    const url = URL.createObjectURL(out);
    const link = document.createElement('a');
    link.download = baseName + '.docx';
    link.href = url;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  async function runExport(kind) {
    if (!exportRef.current || exporting) return;
    setExporting(kind);
    setExportError('');
    // El exportable siempre sale en tema claro: se cambia un momento sin tocar la preferencia guardada.
    const restoreDark = isDark;
    if (restoreDark) {
      setTheme('light', false);
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    try {
      const style = kind === 'pdf' ? 'corporate' : kind === 'docx' ? 'insert' : exportStyle;
      const fullWidth = exportContentWidth();
      const scale = exportScale(fullWidth, exportRef.current.offsetHeight);
      const canvas = await html2canvas(exportRef.current, {
        backgroundColor: '#FFFFFF',
        scale,
        width: fullWidth,
        windowWidth: fullWidth + 40,
        onclone: (doc) => prepareExportClone(doc, fullWidth, style),
      });
      const baseName = ((stripHtml(project.name) || t('proyecto', 'project')).replace(/[\\/:*?"<>|]/g, '-') + (style === 'corporate' ? t(' - Anexo', ' - Appendix') : '')).trim();
      if (kind === 'docx') {
        await downloadDocx(canvas, baseName);
      } else if (kind === 'png') {
        const link = document.createElement('a');
        link.download = baseName + '.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
      } else {
        // Siempre horizontal: la hoja se dimensiona al contenido, con el lado largo en el ancho.
        const h = canvas.height;
        const w = Math.max(canvas.width, Math.round(h * 1.5));
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [w, h], compress: true });
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (w - canvas.width) / 2, 0, canvas.width, canvas.height, undefined, 'FAST');
        pdf.save(baseName + '.pdf');
      }
      setExportOpen(false);
    } catch (err) {
      console.warn('export', err);
      setExportError(t('No pudimos generar el archivo. Si el plan es muy grande, prueba con la imagen PNG.', 'We could not generate the file. If the plan is very large, try the PNG image.'));
    } finally {
      if (restoreDark) setTheme('dark', false);
      setExporting(null);
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: colors.bg, fontFamily: fonts.body }}>
        <Header />
        <div style={{ padding: '40px 32px', color: colors.textMuted }}>{t('Cargando proyecto...', 'Loading project...')}</div>
      </div>
    );
  }

  if (error && !project) {
    return (
      <div style={{ minHeight: '100vh', background: colors.bg, fontFamily: fonts.body }}>
        <Header />
        <div style={{ padding: '40px 32px', color: colors.danger }}>{error}</div>
      </div>
    );
  }

  const endDateLabel = computeProjectEndDateLabel(project);
  const exportSpan = computeProjectSpan(project);
  const exportSubtitle = [
    durationLabel(exportSpan.units, project.unit),
    project.startDate ? formatShortDate(project.startDate + 'T00:00:00') + ' → ' + (exportSpan.endDate ? formatShortDate(exportSpan.endDate) : '—') : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const showWeekendToggle = project.unit === 'Días';
  const savedHeaderBg = project.headerBg || '#F5F8F7';
  const savedHeaderFg = project.headerFg || '#475A52';
  // En tema oscuro, una cabecera casi blanca se adapta para no deslumbrar. La exportación siempre usa los colores guardados.
  const darkAdapt = isDark && isPaleColor(savedHeaderBg);
  const headerBg = darkAdapt ? '#1F2B26' : savedHeaderBg;
  const headerFg = darkAdapt ? '#A5B8B0' : savedHeaderFg;
  const allTaskColorDot = (project.tasks || []).find((t) => !t.parentId && t.color)?.color || '#00A887';
  const allDelivColorDot = (project.deliverables || [])[0]?.color || '#DC2626';
  const rowTintPreviewStyle = { width: '22px', height: '22px', borderRadius: '6px', border: `1px solid ${colors.border}`, background: lightenColor(headerBg, 0.88), flexShrink: 0 };

  return (
    <div style={{ minHeight: '100vh', background: colors.bg, fontFamily: fonts.body }}>
      <Header />

      <div style={{ padding: '32px 32px 40px' }}>
        <nav aria-label={t('Ruta', 'Breadcrumb')} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', fontFamily: fonts.body, fontSize: '14px', minWidth: 0 }}>
          <button
            onClick={() => navigate('/')}
            style={{ background: 'transparent', border: 'none', padding: 0, color: colors.primaryDark, font: `600 14px ${fonts.body}`, cursor: 'pointer', textDecoration: 'underline', flexShrink: 0 }}
          >
            {t('Mis proyectos', 'My projects')}
          </button>
          <span aria-hidden="true" style={{ color: colors.textFaint }}>/</span>
          <span aria-current="page" style={{ color: colors.textMuted, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {stripHtml(project.name) || t('Proyecto sin nombre', 'Untitled project')}
          </span>
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
          <input
            type="text"
            aria-label={t('Nombre del proyecto', 'Project name')}
            title={t('Haz clic para editar el nombre', 'Click to edit the name')}
            className="project-title-input"
            data-tour="project-title"
            placeholder={t('Nombre del proyecto', 'Project name')}
            value={project.name}
            onChange={(e) => patchProject({ name: e.target.value })}
            style={{ flex: '1 1 320px', minWidth: 0, boxSizing: 'border-box', padding: '6px 10px', border: '1.5px solid transparent', borderRadius: '10px', background: 'transparent', fontFamily: fonts.heading, fontWeight: 700, fontSize: '28px', lineHeight: 1.25, color: colors.text, textOverflow: 'ellipsis' }}
          />
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div
              role="status"
              aria-live="polite"
              data-testid="save-status"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                minWidth: '150px',
                justifyContent: 'center',
                padding: '7px 12px',
                borderRadius: '999px',
                font: `600 13px ${fonts.body}`,
                background: saveStatus.status === 'error' ? colors.dangerBg : colors.bg,
                color: saveStatus.status === 'error' ? colors.danger : colors.textMuted,
              }}
            >
              {saveStatus.status === 'saving' && (
                <>
                  <span className="spin" aria-hidden="true" />
                  {t('Guardando…', 'Saving…')}
                </>
              )}
              {saveStatus.status === 'saved' && (
                <>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke={colors.primaryDark} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 8.5 L6.5 12 L13 4.5" />
                  </svg>
                  {saveStatus.at ? `${t('Guardado', 'Saved')} · ${saveStatus.at.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}` : t('Todo guardado', 'All saved')}
                </>
              )}
              {saveStatus.status === 'error' && (
                <>
                  {t('No se pudo guardar', 'Could not save')}
                  <button
                    onClick={flushSave}
                    style={{ border: 'none', background: 'transparent', color: colors.danger, font: `700 13px ${fonts.body}`, textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
                  >
                    {t('Reintentar', 'Retry')}
                  </button>
                </>
              )}
            </div>
            {isShared && (
              <>
                <button
                  data-testid="open-members"
                  onClick={() => setMembersOpen(true)}
                  style={{ background: colors.primaryTint, color: colors.primaryDark, border: `1.5px solid ${colors.primary}`, borderRadius: '10px', padding: '9px 16px', font: `600 14px ${fonts.body}`, cursor: 'pointer' }}
                >
                  {t('Colaboradores', 'Collaborators')} ({members.length})
                </button>
                <button
                  data-testid="open-changes"
                  onClick={() => setChangesOpen(true)}
                  style={{ background: colors.primaryTint, color: colors.primaryDark, border: `1.5px solid ${colors.primary}`, borderRadius: '10px', padding: '9px 16px', font: `600 14px ${fonts.body}`, cursor: 'pointer' }}
                >
                  {t('Bitácora', 'Change log')}
                </button>
              </>
            )}
            <button
              onClick={() => setCustomizeOpen(true)}
              style={{ background: 'transparent', color: colors.primaryDark, border: `1.5px solid ${colors.primary}`, borderRadius: '10px', padding: '9px 16px', font: `600 14px ${fonts.body}`, cursor: 'pointer' }}
            >
              {t('Colores de tabla', 'Table colors')}
            </button>
            <button
              data-testid="open-export"
              onClick={() => {
                setExportError('');
                setExportOpen(true);
              }}
              style={{ background: colors.primaryStrong, color: '#fff', border: 'none', borderRadius: '10px', padding: '9px 18px', font: `600 14px ${fonts.body}`, cursor: 'pointer' }}
            >
              {t('Exportar', 'Export')}
            </button>
          </div>
        </div>

        {error && <div style={{ color: colors.danger, marginBottom: '16px' }}>{error}</div>}

        <div ref={exportRef} data-export="export-root" style={{ padding: '32px', background: colors.surface }}>
          <div data-export="corp-header" style={{ display: 'none', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '24px' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: fonts.heading, fontWeight: 700, fontSize: '28px', lineHeight: 1.2, color: '#0C5641' }}>{stripHtml(project.name) || t('Proyecto sin nombre', 'Untitled project')}</div>
                <div style={{ fontFamily: fonts.body, fontSize: '14px', color: colors.textMuted, marginTop: '4px' }}>{exportSubtitle}</div>
              </div>
              <img src={ecosatLogo} alt="Ecosat Technology Solutions" style={{ height: '44px', width: 'auto', flexShrink: 0 }} />
            </div>
            <div style={{ height: '3px', background: 'linear-gradient(90deg, #6FD9C3, #00A887, #0C5641)' }} />
          </div>

          <div data-export="form-block" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: '20px 32px', marginBottom: '22px' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ font: `600 13px ${fonts.body}`, color: colors.textMuted, marginBottom: '6px' }}>{t('Unidad de tiempo', 'Time unit')}</div>
              <div role="radiogroup" aria-label={t('Unidad de tiempo', 'Time unit')} style={{ display: 'flex', gap: '8px' }}>
                {TIME_UNITS.map((unit) => (
                  <button key={unit} role="radio" aria-checked={project.unit === unit} onClick={() => patchProject({ unit })} style={unitButtonStyle(project.unit === unit)}>
                    {unitLabel(unit)}
                  </button>
                ))}
              </div>
              <div style={{ font: `400 12px ${fonts.body}`, color: colors.textMuted, marginTop: '6px', maxWidth: '300px' }}>{t('Cómo se miden las duraciones del plan.', 'How plan durations are measured.')}</div>
              {showWeekendToggle && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px' }}>
                  <button
                    role="switch"
                    aria-checked={!!project.excludeWeekends}
                    aria-label={t('No contar sábados ni domingos', 'Do not count Saturdays or Sundays')}
                    onClick={() => patchProject({ excludeWeekends: !project.excludeWeekends })}
                    style={{ width: '38px', height: '22px', padding: 0, border: 'none', borderRadius: '11px', background: project.excludeWeekends ? colors.primaryDark : colors.inputBorder, position: 'relative', cursor: 'pointer', transition: 'background .15s ease', flexShrink: 0 }}
                  >
                    <span style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#FFFFFF', position: 'absolute', top: '3px', left: project.excludeWeekends ? '19px' : '3px', transition: 'left .15s ease', boxShadow: '0 1px 2px rgba(15,26,22,.25)' }} />
                  </button>
                  <span style={{ fontFamily: fonts.body, fontSize: '14px', color: colors.text }}>{t('No contar sábados ni domingos', 'Do not count Saturdays or Sundays')}</span>
                </div>
              )}
            </div>

            <div data-export="start-date-field" style={{ width: '210px', maxWidth: '100%' }}>
              <label htmlFor="project-start-date" style={{ display: 'block', font: `600 13px ${fonts.body}`, color: colors.textMuted, marginBottom: '6px' }}>{t('Fecha de inicio (opcional)', 'Start date (optional)')}</label>
              <input
                id="project-start-date"
                type="date"
                value={project.startDate || ''}
                onChange={(e) => patchProject({ startDate: e.target.value })}
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', border: `1.5px solid ${colors.inputBorder}`, borderRadius: '10px', fontFamily: fonts.body, fontSize: '15px', color: colors.text }}
              />
            </div>

            <div data-export="end-date-field" style={{ width: '210px', maxWidth: '100%' }}>
              <div style={{ font: `600 13px ${fonts.body}`, color: colors.textMuted, marginBottom: '6px' }}>{t('Fecha de fin (se calcula)', 'End date (calculated)')}</div>
              <div style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', border: `1.5px solid ${colors.border}`, borderRadius: '10px', fontFamily: fonts.body, fontSize: '15px', color: colors.textMuted, background: colors.bg }}>
                {endDateLabel}
              </div>
            </div>
          </div>

          <NotesEditor
            initialHtml={project.notesHtml}
            onBlurSave={(html) => patchProject({ notesHtml: html })}
          />

          <GanttTable
            tasks={project.tasks}
            unit={project.unit}
            startDate={project.startDate}
            excludeWeekends={project.excludeWeekends}
            draggingTaskId={draggingTaskId}
            collapsedIds={collapsedIds}
            onToggleCollapse={toggleCollapse}
            deliverables={project.deliverables}
            draggingDeliverableId={draggingDeliverableId}
            onDeliverableDragStart={(index, pos, cellWidth, e) => startDeliverableDrag(index, pos, cellWidth, e)}
            onDeliverableContextMenu={(index, x, y) => {
              setColorPickerFor('deliv:' + index);
              setColorPickerPos({ x, y });
            }}
            headerBg={headerBg}
            headerFg={headerFg}
            allTaskColorDot={allTaskColorDot}
            onChangeAllTaskColors={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setColorPickerFor('all:tasks');
              setColorPickerPos({ x: r.left, y: r.bottom + 8 });
            }}
            guidePosition={typeof project.guidePosition === 'number' ? project.guidePosition : 0}
            onSetGuidePosition={setGuidePosition}
            onGuideDragStart={startGuideDrag}
            columnLevel={columnLevel}
            onChangeColumnLevel={setColumnLevel}
            onUpdateTask={updateTask}
            onAddTask={addTask}
            onAddSubtask={addSubtask}
            onDeleteTask={requestDeleteTask}
            onRowDragStart={handleRowDragStart}
            onRowDragOver={handleRowDragOver}
            onRowDrop={handleRowDrop}
            onRowDragEnd={handleRowDragEnd}
            onBarDragStart={startBarDrag}
            onBarContextMenu={(taskId, x, y) => {
              setColorPickerFor(taskId);
              setColorPickerPos({ x, y });
            }}
          />

          <DeliverablesTable
            deliverables={project.deliverables}
            draggingDeliverableId={draggingDeliverableId}
            headerBg={headerBg}
            headerFg={headerFg}
            allDelivColorDot={allDelivColorDot}
            onChangeAllDeliverableColors={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setColorPickerFor('all:delivs');
              setColorPickerPos({ x: r.left, y: r.bottom + 8 });
            }}
            onAddDeliverable={addDeliverable}
            onDeleteDeliverable={deleteDeliverable}
            onUpdateDeliverable={updateDeliverable}
            onRowDragStart={handleDeliverableDragStart}
            onRowDragOver={handleDeliverableDragOver}
            onRowDrop={handleDeliverableDrop}
            onRowDragEnd={handleDeliverableDragEnd}
          />

          <div
            data-export="corp-footer"
            style={{ display: 'none', justifyContent: 'space-between', gap: '16px', marginTop: '24px', paddingTop: '10px', borderTop: `1px solid ${colors.border}`, fontFamily: fonts.body, fontSize: '11px', color: colors.textMuted }}
          >
            <span>Ecosat Technology Solutions</span>
            <span>{t('Generado el', 'Generated on')} {formatShortDate(new Date())}</span>
          </div>
        </div>
      </div>

      {exportOpen && (
        <div
          onClick={() => !exporting && setExportOpen(false)}
          style={{ position: 'fixed', inset: 0, background: colors.overlay, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 125 }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t('Exportar', 'Export')}
            data-testid="export-dialog"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.key === 'Escape' && !exporting && setExportOpen(false)}
            style={{ background: colors.surface, borderRadius: '14px', padding: '28px', width: '520px', maxWidth: 'calc(100vw - 32px)', boxShadow: `0 8px 24px ${colors.shadow}` }}
          >
            <div style={{ fontFamily: fonts.heading, fontWeight: 700, fontSize: '18px', color: colors.text, marginBottom: '6px' }}>{t('Exportar', 'Export')}</div>
            <div style={{ fontFamily: fonts.body, fontSize: '14px', color: colors.textMuted, marginBottom: '18px' }}>{t('Elige el formato según dónde vas a usar el cronograma.', 'Choose the format based on where you will use the schedule.')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
              {[
                { key: 'pdf', label: 'PDF', badge: t('Con membrete', 'With letterhead'), text: t('Anexo con el logo de Ecosat, el nombre del proyecto, su duración y pie de página.', 'Appendix with the Ecosat logo, the project name, its duration and a footer.') },
                { key: 'docx', label: 'Word', badge: t('Sin membrete', 'No letterhead'), text: t('Archivo .docx con el cronograma, los entregables y las notas, listo para copiar a otro documento.', '.docx file with the schedule, deliverables and notes, ready to copy into another document.') },
                { key: 'png', label: t('Imagen PNG', 'PNG image'), badge: exportStyle === 'corporate' ? t('Con membrete', 'With letterhead') : t('Sin membrete', 'No letterhead'), text: t('Imagen para pegar en un SOW, contrato o presentación.', 'Image to paste into a SOW, contract or presentation.') },
              ].map((opt) => (
                <div key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', borderRadius: '12px', border: `1.5px solid ${colors.inputBorder}` }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ font: `700 15px ${fonts.body}`, color: colors.text }}>{opt.label}</span>
                      <span style={{ font: `600 11px ${fonts.body}`, padding: '2px 8px', borderRadius: '999px', background: colors.primaryTint, color: colors.primaryDark }}>{opt.badge}</span>
                    </div>
                    <div style={{ font: `400 13px ${fonts.body}`, color: colors.textMuted, marginTop: '3px', lineHeight: 1.4 }}>{opt.text}</div>
                    {opt.key === 'png' && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', font: `500 13px ${fonts.body}`, color: colors.text, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          data-testid="export-png-membrete"
                          checked={exportStyle === 'corporate'}
                          disabled={!!exporting}
                          onChange={(e) => setExportStyle(e.target.checked ? 'corporate' : 'insert')}
                        />
                        {t('Incluir membrete de Ecosat', 'Include Ecosat letterhead')}
                      </label>
                    )}
                  </div>
                  <button
                    data-testid={`export-${opt.key}`}
                    onClick={() => runExport(opt.key)}
                    disabled={!!exporting}
                    style={{ flexShrink: 0, background: opt.key === 'pdf' ? colors.primaryStrong : 'transparent', color: opt.key === 'pdf' ? '#fff' : colors.primaryDark, border: opt.key === 'pdf' ? 'none' : `1.5px solid ${colors.primary}`, borderRadius: '10px', padding: '9px 16px', font: `600 14px ${fonts.body}`, cursor: 'pointer', opacity: exporting && exporting !== opt.key ? 0.5 : 1, minWidth: '112px' }}
                  >
                    {exporting === opt.key ? t('Generando…', 'Generating…') : t('Descargar', 'Download')}
                  </button>
                </div>
              ))}
            </div>
            {exportError && <div role="alert" style={{ color: colors.danger, fontFamily: fonts.body, fontSize: '14px', marginBottom: '14px' }}>{exportError}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setExportOpen(false)}
                disabled={!!exporting}
                style={{ background: 'transparent', color: colors.primaryDark, border: `1.5px solid ${colors.primary}`, borderRadius: '10px', padding: '9px 17px', font: `600 15px ${fonts.body}`, cursor: 'pointer' }}
              >
                {t('Cerrar', 'Close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title={confirmDelete.childCount > 0 ? t('Eliminar fase con subtareas', 'Delete phase with subtasks') : t('Eliminar fila', 'Delete row')}
          message={
            confirmDelete.childCount > 0
              ? t(`Se eliminará "${confirmDelete.name}" y sus ${confirmDelete.childCount} subtarea${confirmDelete.childCount === 1 ? '' : 's'}. Esta acción no se puede deshacer.`, `"${confirmDelete.name}" and its ${confirmDelete.childCount} subtask${confirmDelete.childCount === 1 ? '' : 's'} will be deleted. This action cannot be undone.`)
              : t(`Se eliminará "${confirmDelete.name}". Esta acción no se puede deshacer.`, `"${confirmDelete.name}" will be deleted. This action cannot be undone.`)
          }
          confirmLabel={t('Eliminar', 'Delete')}
          onConfirm={confirmDeleteTask}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {colorPickerFor && (
        <ColorPicker
          position={colorPickerPos}
          onSelect={(color) => selectBarColor(colorPickerFor, color)}
          onClose={() => setColorPickerFor(null)}
        />
      )}

      {customizeOpen && (
        <div
          onClick={() => setCustomizeOpen(false)}
          style={{ position: 'fixed', inset: 0, background: colors.overlay, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: colors.surface, borderRadius: '14px', padding: '24px', width: '340px', boxShadow: `0 8px 24px ${colors.shadow}` }}
          >
            <div style={{ fontFamily: fonts.heading, fontWeight: 700, fontSize: '18px', color: colors.text, marginBottom: '18px' }}>
              {t('Colores de tabla', 'Table colors')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', font: `600 13px ${fonts.body}`, color: colors.textMuted, marginBottom: '8px' }}>{t('Color de cabecera', 'Header color')}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="color"
                    value={headerBg}
                    onChange={(e) => patchProject({ headerBg: e.target.value })}
                    style={{ width: '52px', height: '36px', padding: 0, border: `1.5px solid ${colors.inputBorder}`, borderRadius: '8px', background: colors.surface, cursor: 'pointer' }}
                  />
                  <input
                    type="text"
                    value={headerBg}
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      if (/^#[0-9a-fA-F]{6}$/.test(v)) patchProject({ headerBg: v });
                    }}
                    style={{ flex: 1, minWidth: 0, padding: '9px 12px', border: `1.5px solid ${colors.inputBorder}`, borderRadius: '8px', fontFamily: fonts.body, fontSize: '14px', color: colors.text, textTransform: 'uppercase' }}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', font: `600 13px ${fonts.body}`, color: colors.textMuted, marginBottom: '8px' }}>{t('Color del texto de cabecera', 'Header text color')}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="color"
                    value={headerFg}
                    onChange={(e) => patchProject({ headerFg: e.target.value })}
                    style={{ width: '52px', height: '36px', padding: 0, border: `1.5px solid ${colors.inputBorder}`, borderRadius: '8px', background: colors.surface, cursor: 'pointer' }}
                  />
                  <input
                    type="text"
                    value={headerFg}
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      if (/^#[0-9a-fA-F]{6}$/.test(v)) patchProject({ headerFg: v });
                    }}
                    style={{ flex: 1, minWidth: 0, padding: '9px 12px', border: `1.5px solid ${colors.inputBorder}`, borderRadius: '8px', fontFamily: fonts.body, fontSize: '14px', color: colors.text, textTransform: 'uppercase' }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', font: `500 13px ${fonts.body}`, color: colors.textMuted }}>
                <span style={rowTintPreviewStyle} />
                {t('Filas principales del Cronograma', 'Main rows of the Schedule')}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '22px' }}>
              <button
                onClick={() => patchProject({ headerBg: '#0C5641', headerFg: '#FFFFFF' })}
                style={{ background: 'transparent', color: colors.textMuted, border: 'none', font: `600 14px ${fonts.body}`, cursor: 'pointer' }}
              >
                {t('Restablecer', 'Reset')}
              </button>
              <button
                onClick={() => setCustomizeOpen(false)}
                style={{ background: colors.primaryStrong, color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 18px', font: `600 15px ${fonts.body}`, cursor: 'pointer' }}
              >
                {t('Listo', 'Done')}
              </button>
            </div>
          </div>
        </div>
      )}

      {membersOpen && <MembersModal projectId={id} isOwner={isOwner} onClose={() => setMembersOpen(false)} onChanged={setMembers} />}
      {changesOpen && <ChangesModal projectId={id} onClose={() => setChangesOpen(false)} />}
    </div>
  );
}
