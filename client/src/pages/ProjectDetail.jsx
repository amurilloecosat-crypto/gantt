import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import Header from '../components/Header.jsx';
import NotesEditor from '../components/NotesEditor.jsx';
import GanttTable from '../components/GanttTable.jsx';
import DeliverablesTable from '../components/DeliverablesTable.jsx';
import ColorPicker from '../components/ColorPicker.jsx';
import { api } from '../api';
import { colors, fonts } from '../theme.js';
import { computeProjectEndDateLabel, computeSchedule, getParentBounds, getSubtreeIndices, hasChildren, lightenColor, taskLevel } from '../ganttUtils.js';

const TIME_UNITS = ['Días', 'Semanas', 'Meses'];

function unitButtonStyle(isActive) {
  return {
    padding: '9px 16px',
    borderRadius: '10px',
    border: isActive ? `1.5px solid ${colors.primary}` : `1.5px solid ${colors.border}`,
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
  const exportRef = useRef(null);
  const saveTimeout = useRef(null);
  const dragSourceId = useRef(null);
  const dragSourceDeliverableId = useRef(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getProject(id)
      .then(({ project }) => !cancelled && setProject({ deliverables: [], headerBg: '#F5F8F7', headerFg: '#475A52', guidePosition: 0, ...project }))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const scheduleSave = useCallback(
    (nextProject) => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(() => {
        api
          .updateProject(id, {
            name: nextProject.name,
            unit: nextProject.unit,
            startDate: nextProject.startDate,
            excludeWeekends: nextProject.excludeWeekends,
            notesHtml: nextProject.notesHtml,
            tasks: nextProject.tasks,
            deliverables: nextProject.deliverables,
            headerBg: nextProject.headerBg,
            headerFg: nextProject.headerFg,
            guidePosition: nextProject.guidePosition,
          })
          .catch((err) => setError(err.message));
      }, 500);
    },
    [id]
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
      tasks.push({ id: 't' + Date.now(), name: 'Nueva tarea', parentId: null, duration: 1, dependency: '', manualStart: guidePosition, color: '#00A887' });
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
      tasks.splice(insertAt, 0, { id: 't' + Date.now(), name: 'Nueva subtarea', parentId: tasks[index].id, duration: 1, dependency: '', manualStart: guidePosition });
      const next = { ...prev, tasks };
      scheduleSave(next);
      return next;
    });
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
    setProject((prev) => {
      const tasks = prev.tasks;
      const sourceIndex = tasks.findIndex((t) => t.id === draggingId);
      if (sourceIndex === -1 || sourceIndex === targetIndex) return prev;

      const subtreeIdx = getSubtreeIndices(sourceIndex, tasks);
      if (subtreeIdx.includes(targetIndex)) return prev;

      const sourceTask = tasks[sourceIndex];
      const targetTask = tasks[targetIndex];
      const sourceIsParent = sourceTask.parentId !== null || hasChildren(sourceTask.id, tasks);
      if (sourceIsParent && targetTask.parentId !== sourceTask.parentId) return prev;

      const block = subtreeIdx.map((i) => tasks[i]);
      const remaining = tasks.filter((_, i) => !subtreeIdx.includes(i));
      let insertAt = remaining.findIndex((t) => t.id === targetTask.id);
      if (insertAt === -1) insertAt = remaining.length;

      block[0] = { ...block[0], parentId: targetTask.parentId };
      remaining.splice(insertAt, 0, ...block);

      const next = { ...prev, tasks: remaining };
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

  function exportContentWidth() {
    const units = Math.max(1, ...computeSchedule(project.tasks || []).map((t) => t.end));
    const ganttWidth = 850 + units * 48;
    const onScreen = exportRef.current ? exportRef.current.offsetWidth : 0;
    return Math.max(onScreen, ganttWidth + 66); // 32px de padding a cada lado + bordes
  }

  function prepareExportClone(clonedDoc, fullWidth) {
    const hasStart = !!project.startDate;
    const hasResponsible = (project.tasks || []).some((t) => (t.responsible || '').trim());
    const hide = (sel) => clonedDoc.querySelectorAll(sel).forEach((el) => { el.style.display = 'none'; });
    // Las celdas de fecha/responsable son ítems de un grid sin columna explícita: ocultarlas con
    // display:none corre el resto de columnas (el navegador reacomoda el auto-placement).
    // visibility:hidden las deja invisibles pero conserva su espacio en el grid.
    const hideKeepingLayout = (sel) => clonedDoc.querySelectorAll(sel).forEach((el) => { el.style.visibility = 'hidden'; });
    if (!hasStart) {
      hide('[data-export="start-date-field"]');
      hide('[data-export="end-date-field"]');
      hideKeepingLayout('[data-export="col-fecha-inicio"]');
      hideKeepingLayout('[data-export="col-fecha-fin"]');
      hideKeepingLayout('[data-export="cell-fecha-inicio"]');
      hideKeepingLayout('[data-export="cell-fecha-fin"]');
    }
    if (!hasResponsible) {
      hideKeepingLayout('[data-export="col-responsable"]');
      hideKeepingLayout('[data-export="cell-responsable"]');
    }
    hide('[data-export="notes-toolbar"]');
    hide('[data-export="add-row-btn"]');
    hide('[data-export="add-child-btn"]');
    hide('[data-export="delete-row-btn"]');
    hide('[data-export="collapse-btn"]');
    hide('[data-export="edit-guide"]');
    clonedDoc.querySelectorAll('[data-export="drag-handle"]').forEach((el) => { el.style.visibility = 'hidden'; });
    clonedDoc.querySelectorAll('[data-export="notes-box"]').forEach((el) => { el.style.border = 'none'; });
    clonedDoc.querySelectorAll('input, select, textarea, [contenteditable="true"]').forEach((el) => {
      el.style.border = 'none';
      el.style.background = 'transparent';
      el.style.boxShadow = 'none';
    });
    // El exportable se despliega a su ancho real: el Gantt completo sin scroll y las Notas a todo lo ancho.
    const root = clonedDoc.querySelector('[data-export="export-root"]');
    if (root && fullWidth) {
      root.style.width = fullWidth + 'px';
      root.style.maxWidth = 'none';
    }
    clonedDoc.querySelectorAll('[data-export="gantt-scroll"]').forEach((el) => {
      el.style.overflow = 'visible';
      el.style.width = 'max-content';
      el.style.minWidth = '100%';
    });
    clonedDoc.querySelectorAll('[data-export="notes-wrap"]').forEach((el) => { el.style.maxWidth = 'none'; });
  }

  async function exportPng() {
    if (!exportRef.current) return;
    const fullWidth = exportContentWidth();
    const canvas = await html2canvas(exportRef.current, { backgroundColor: colors.bg, scale: 2, width: fullWidth, windowWidth: fullWidth + 40, onclone: (doc) => prepareExportClone(doc, fullWidth) });
    const link = document.createElement('a');
    link.download = (project.name || 'proyecto') + '.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  async function exportPdf() {
    if (!exportRef.current) return;
    const fullWidth = exportContentWidth();
    const canvas = await html2canvas(exportRef.current, { backgroundColor: '#FFFFFF', scale: 2, width: fullWidth, windowWidth: fullWidth + 40, onclone: (doc) => prepareExportClone(doc, fullWidth) });
    // Siempre horizontal: la hoja se dimensiona al contenido, con el lado largo en el ancho.
    const h = canvas.height;
    const w = Math.max(canvas.width, Math.round(h * 1.5));
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [w, h] });
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (w - canvas.width) / 2, 0, canvas.width, canvas.height);
    pdf.save((project.name || 'proyecto') + '.pdf');
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: colors.bg, fontFamily: fonts.body }}>
        <Header />
        <div style={{ padding: '40px 32px', color: colors.textMuted }}>Cargando proyecto...</div>
      </div>
    );
  }

  if (error && !project) {
    return (
      <div style={{ minHeight: '100vh', background: colors.bg, fontFamily: fonts.body }}>
        <Header />
        <div style={{ padding: '40px 32px', color: '#DC2626' }}>{error}</div>
      </div>
    );
  }

  const endDateLabel = computeProjectEndDateLabel(project);
  const showWeekendToggle = project.unit === 'Días';
  const headerBg = project.headerBg || '#F5F8F7';
  const headerFg = project.headerFg || '#475A52';
  const allTaskColorDot = (project.tasks || []).find((t) => !t.parentId && t.color)?.color || '#00A887';
  const allDelivColorDot = (project.deliverables || [])[0]?.color || '#DC2626';
  const rowTintPreviewStyle = { width: '22px', height: '22px', borderRadius: '6px', border: `1px solid ${colors.border}`, background: lightenColor(headerBg, 0.88), flexShrink: 0 };

  return (
    <div style={{ minHeight: '100vh', background: colors.bg, fontFamily: fonts.body }}>
      <Header />

      <div style={{ padding: '40px 32px' }}>
        <button
          onClick={() => navigate('/')}
          style={{ background: 'transparent', border: 'none', color: colors.textMuted, font: `600 14px ${fonts.body}`, cursor: 'pointer', padding: 0, marginBottom: '24px' }}
        >
          ← Volver
        </button>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div style={{ fontFamily: fonts.heading, fontWeight: 700, fontSize: '22px', color: colors.text }}>Detalle del proyecto</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setCustomizeOpen(true)}
              style={{ background: 'transparent', color: colors.primaryDark, border: `1.5px solid ${colors.primary}`, borderRadius: '10px', padding: '9px 16px', font: `600 14px ${fonts.body}`, cursor: 'pointer' }}
            >
              Personalizar
            </button>
            <button
              onClick={exportPng}
              style={{ background: 'transparent', color: colors.primaryDark, border: `1.5px solid ${colors.primary}`, borderRadius: '10px', padding: '9px 16px', font: `600 14px ${fonts.body}`, cursor: 'pointer' }}
            >
              Exportar PNG
            </button>
            <button
              onClick={exportPdf}
              style={{ background: colors.primary, color: '#fff', border: 'none', borderRadius: '10px', padding: '9px 16px', font: `600 14px ${fonts.body}`, cursor: 'pointer' }}
            >
              Exportar PDF
            </button>
          </div>
        </div>

        {error && <div style={{ color: '#DC2626', marginBottom: '16px' }}>{error}</div>}

        <div ref={exportRef} data-export="export-root" style={{ padding: '32px', background: colors.surface }}>
          <div style={{ maxWidth: '480px', marginBottom: '18px' }}>
            <label style={{ display: 'block', font: `600 13px ${fonts.body}`, color: colors.textMuted, marginBottom: '6px' }}>Nombre</label>
            <input
              type="text"
              value={project.name}
              onChange={(e) => patchProject({ name: e.target.value })}
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', border: `1.5px solid ${colors.border}`, borderRadius: '10px', fontFamily: fonts.body, fontSize: '15px', color: colors.text }}
            />
          </div>

          <div style={{ maxWidth: '480px', marginBottom: '18px' }}>
            <label style={{ display: 'block', font: `600 13px ${fonts.body}`, color: colors.textMuted, marginBottom: '6px' }}>Unidad de tiempo</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {TIME_UNITS.map((unit) => (
                <button key={unit} onClick={() => patchProject({ unit })} style={unitButtonStyle(project.unit === unit)}>
                  {unit}
                </button>
              ))}
            </div>
            {showWeekendToggle && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '14px' }}>
                <div
                  onClick={() => patchProject({ excludeWeekends: !project.excludeWeekends })}
                  style={{ width: '36px', height: '20px', borderRadius: '10px', background: project.excludeWeekends ? colors.primary : colors.border, position: 'relative', cursor: 'pointer', transition: 'background .15s ease', flexShrink: 0 }}
                >
                  <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#FFFFFF', position: 'absolute', top: '2px', left: project.excludeWeekends ? '18px' : '2px', transition: 'left .15s ease', boxShadow: '0 1px 2px rgba(15,26,22,.25)' }} />
                </div>
                <span style={{ fontFamily: fonts.body, fontSize: '14px', color: colors.text }}>Descartar fines de semana</span>
              </div>
            )}
          </div>

          <div data-export="start-date-field" style={{ maxWidth: '480px', marginBottom: '18px' }}>
            <label style={{ display: 'block', font: `600 13px ${fonts.body}`, color: colors.textMuted, marginBottom: '6px' }}>Fecha inicio</label>
            <input
              type="date"
              value={project.startDate || ''}
              onChange={(e) => patchProject({ startDate: e.target.value })}
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', border: `1.5px solid ${colors.border}`, borderRadius: '10px', fontFamily: fonts.body, fontSize: '15px', color: colors.text }}
            />
          </div>

          <div data-export="end-date-field" style={{ maxWidth: '480px', marginBottom: '18px' }}>
            <label style={{ display: 'block', font: `600 13px ${fonts.body}`, color: colors.textMuted, marginBottom: '6px' }}>Fecha fin</label>
            <div style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', border: `1.5px solid ${colors.border}`, borderRadius: '10px', fontFamily: fonts.body, fontSize: '15px', color: colors.textMuted, background: colors.bg }}>
              {endDateLabel}
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
            onUpdateTask={updateTask}
            onAddTask={addTask}
            onAddSubtask={addSubtask}
            onDeleteTask={deleteTask}
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
        </div>
      </div>

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
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,26,22,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: colors.surface, borderRadius: '14px', padding: '24px', width: '340px', boxShadow: '0 8px 24px rgba(15,26,22,.18)' }}
          >
            <div style={{ fontFamily: fonts.heading, fontWeight: 700, fontSize: '18px', color: colors.text, marginBottom: '18px' }}>
              Personalizar tablas
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', font: `600 13px ${fonts.body}`, color: colors.textMuted, marginBottom: '8px' }}>Color de cabeceras</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="color"
                    value={headerBg}
                    onChange={(e) => patchProject({ headerBg: e.target.value })}
                    style={{ width: '52px', height: '36px', padding: 0, border: `1.5px solid ${colors.border}`, borderRadius: '8px', background: colors.surface, cursor: 'pointer' }}
                  />
                  <input
                    type="text"
                    value={headerBg}
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      if (/^#[0-9a-fA-F]{6}$/.test(v)) patchProject({ headerBg: v });
                    }}
                    style={{ flex: 1, minWidth: 0, padding: '9px 12px', border: `1.5px solid ${colors.border}`, borderRadius: '8px', fontFamily: fonts.body, fontSize: '14px', color: colors.text, textTransform: 'uppercase' }}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', font: `600 13px ${fonts.body}`, color: colors.textMuted, marginBottom: '8px' }}>Color de la fuente</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="color"
                    value={headerFg}
                    onChange={(e) => patchProject({ headerFg: e.target.value })}
                    style={{ width: '52px', height: '36px', padding: 0, border: `1.5px solid ${colors.border}`, borderRadius: '8px', background: colors.surface, cursor: 'pointer' }}
                  />
                  <input
                    type="text"
                    value={headerFg}
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      if (/^#[0-9a-fA-F]{6}$/.test(v)) patchProject({ headerFg: v });
                    }}
                    style={{ flex: 1, minWidth: 0, padding: '9px 12px', border: `1.5px solid ${colors.border}`, borderRadius: '8px', fontFamily: fonts.body, fontSize: '14px', color: colors.text, textTransform: 'uppercase' }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', font: `500 13px ${fonts.body}`, color: colors.textMuted }}>
                <span style={rowTintPreviewStyle} />
                Filas principales del Cronograma
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '22px' }}>
              <button
                onClick={() => patchProject({ headerBg: '#F5F8F7', headerFg: '#475A52' })}
                style={{ background: 'transparent', color: colors.textMuted, border: 'none', font: `600 14px ${fonts.body}`, cursor: 'pointer' }}
              >
                Restablecer
              </button>
              <button
                onClick={() => setCustomizeOpen(false)}
                style={{ background: colors.primary, color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 18px', font: `600 15px ${fonts.body}`, cursor: 'pointer' }}
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
