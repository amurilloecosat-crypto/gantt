import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import Header from '../components/Header.jsx';
import NotesEditor from '../components/NotesEditor.jsx';
import GanttTable from '../components/GanttTable.jsx';
import ColorPicker from '../components/ColorPicker.jsx';
import { api } from '../api';
import { colors, fonts } from '../theme.js';
import { computeProjectEndDateLabel, getSubtreeIndices, hasChildren, taskLevel } from '../ganttUtils.js';

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
  const [colorPickerFor, setColorPickerFor] = useState(null);
  const [colorPickerPos, setColorPickerPos] = useState({ x: 0, y: 0 });
  const [collapsedIds, setCollapsedIds] = useState(() => new Set());
  const exportRef = useRef(null);
  const saveTimeout = useRef(null);
  const dragSourceId = useRef(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getProject(id)
      .then(({ project }) => !cancelled && setProject(project))
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
            notesAttachmentName: nextProject.notesAttachmentName,
            tasks: nextProject.tasks,
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
      tasks.push({ id: 't' + Date.now(), name: 'Nueva tarea', parentId: null, duration: 1, dependency: '', manualStart: 0, color: '#00A887' });
      const next = { ...prev, tasks };
      scheduleSave(next);
      return next;
    });
  }

  function addSubtask(index) {
    setProject((prev) => {
      const tasks = prev.tasks.slice();
      if (taskLevel(tasks[index].id, tasks) >= 2) return prev;
      const subtreeIdx = getSubtreeIndices(index, tasks);
      const insertAt = subtreeIdx[subtreeIdx.length - 1] + 1;
      tasks.splice(insertAt, 0, { id: 't' + Date.now(), name: 'Nueva subtarea', parentId: tasks[index].id, duration: 1, dependency: '', manualStart: 0 });
      const next = { ...prev, tasks };
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
    const onMove = (ev) => {
      const deltaUnits = Math.round((ev.clientX - startX) / cellWidth);
      updateTask(rowIndex, { manualStart: Math.max(0, originalStart + deltaUnits) });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function selectBarColor(taskId, color) {
    const idx = project.tasks.findIndex((t) => t.id === taskId);
    if (idx !== -1) updateTask(idx, { color });
    setColorPickerFor(null);
  }

  function toggleCollapse(taskId) {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }

  async function exportPng() {
    if (!exportRef.current) return;
    const canvas = await html2canvas(exportRef.current, { backgroundColor: colors.bg, scale: 2 });
    const link = document.createElement('a');
    link.download = (project.name || 'proyecto') + '.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  async function exportPdf() {
    if (!exportRef.current) return;
    const canvas = await html2canvas(exportRef.current, { backgroundColor: '#FFFFFF', scale: 2 });
    const orientation = canvas.width > canvas.height ? 'landscape' : 'portrait';
    const pdf = new jsPDF({ orientation, unit: 'px', format: [canvas.width, canvas.height] });
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, canvas.width, canvas.height);
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

        <div ref={exportRef} style={{ padding: '32px', background: colors.surface }}>
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
                <span style={{ fontFamily: fonts.body, fontSize: '14px', color: colors.text }}>Descartar días hábiles</span>
              </div>
            )}
          </div>

          <div style={{ maxWidth: '480px', marginBottom: '18px' }}>
            <label style={{ display: 'block', font: `600 13px ${fonts.body}`, color: colors.textMuted, marginBottom: '6px' }}>Fecha inicio</label>
            <input
              type="date"
              value={project.startDate || ''}
              onChange={(e) => patchProject({ startDate: e.target.value })}
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', border: `1.5px solid ${colors.border}`, borderRadius: '10px', fontFamily: fonts.body, fontSize: '15px', color: colors.text }}
            />
          </div>

          <div style={{ maxWidth: '480px', marginBottom: '18px' }}>
            <label style={{ display: 'block', font: `600 13px ${fonts.body}`, color: colors.textMuted, marginBottom: '6px' }}>Fecha fin</label>
            <div style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', border: `1.5px solid ${colors.border}`, borderRadius: '10px', fontFamily: fonts.body, fontSize: '15px', color: colors.textMuted, background: colors.bg }}>
              {endDateLabel}
            </div>
          </div>

          <NotesEditor
            initialHtml={project.notesHtml}
            attachmentName={project.notesAttachmentName}
            onBlurSave={(html) => patchProject({ notesHtml: html })}
            onAttach={(name) => patchProject({ notesAttachmentName: name })}
          />

          <GanttTable
            tasks={project.tasks}
            unit={project.unit}
            startDate={project.startDate}
            excludeWeekends={project.excludeWeekends}
            draggingTaskId={draggingTaskId}
            collapsedIds={collapsedIds}
            onToggleCollapse={toggleCollapse}
            onUpdateTask={updateTask}
            onAddTask={addTask}
            onAddSubtask={addSubtask}
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
        </div>
      </div>

      {colorPickerFor && (
        <ColorPicker
          position={colorPickerPos}
          onSelect={(color) => selectBarColor(colorPickerFor, color)}
          onClose={() => setColorPickerFor(null)}
        />
      )}
    </div>
  );
}
