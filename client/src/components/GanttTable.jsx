import React, { useEffect, useRef } from 'react';
import { colors, fonts } from '../theme.js';
import {
  buildShadeGradient,
  computeDeliverableLanes,
  computeNumbers,
  computeSchedule,
  getAncestorIds,
  getParentBounds,
  getRootAncestorColor,
  hasChildren,
  lightenColor,
  ordinalLabel,
  taskLevel,
} from '../ganttUtils.js';

const CELL_WIDTH = 48;
const FIXED_COLS_WIDTH = 850; // 24 + 40 + 260 + 110 + 92 + 92 + 92 + 140
const GRID_TEMPLATE_COLS = '24px 40px 260px 110px 92px 92px 92px 140px';
const STICKY_LEFT = { drag: 0, number: 24, name: 64, duration: 324, dep: 434 };

function execBold() {
  document.execCommand('bold');
}

export default function GanttTable({
  tasks,
  unit,
  startDate,
  excludeWeekends,
  draggingTaskId,
  collapsedIds,
  onToggleCollapse,
  deliverables,
  draggingDeliverableId,
  onDeliverableDragStart,
  onDeliverableContextMenu,
  headerBg,
  headerFg,
  onChangeAllTaskColors,
  allTaskColorDot,
  onUpdateTask,
  onAddTask,
  onAddSubtask,
  onDeleteTask,
  onRowDragStart,
  onRowDragOver,
  onRowDrop,
  onRowDragEnd,
  onBarDragStart,
  onBarContextMenu,
  guidePosition,
  onSetGuidePosition,
  onGuideDragStart,
}) {
  const scrollRef = useRef(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    // Shift+scroll desplaza el Gantt lateralmente. Se usa un listener nativo no-pasivo
    // porque React adjunta onWheel como pasivo, y preventDefault ahí no evita el scroll normal.
    const handleWheel = (e) => {
      if (!e.shiftKey) return;
      e.preventDefault();
      el.scrollLeft = Math.max(0, Math.min(el.scrollWidth - el.clientWidth, el.scrollLeft + e.deltaY));
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  const baseDate = startDate ? new Date(startDate + 'T00:00:00') : null;
  const scheduled = computeSchedule(tasks);
  const numbers = computeNumbers(tasks);
  const maxEnd = Math.max(1, ...scheduled.map((t) => t.end));
  const gridWidth = maxEnd * CELL_WIDTH;
  const ganttColumns = Array.from({ length: maxEnd }, (_, i) => i + 1);
  const ganttMinWidth = FIXED_COLS_WIDTH + gridWidth;
  const hasDeliverables = (deliverables || []).length > 0;
  const hasResponsible = tasks.some((t) => (t.responsible || '').trim());
  const { laneOf, laneCount } = computeDeliverableLanes(deliverables, CELL_WIDTH);
  const shadeGradient = buildShadeGradient(CELL_WIDTH, maxEnd, unit, excludeWeekends);
  const guidePos = typeof guidePosition === 'number' ? guidePosition : 0;

  const headerCellStyle = {
    padding: '10px 4px',
    font: `700 12px ${fonts.body}`,
    color: headerFg,
    textTransform: 'uppercase',
    letterSpacing: '.03em',
  };
  const stickyHeaderStyle = (left) => ({ ...headerCellStyle, position: 'sticky', left: left + 'px', zIndex: 4, background: headerBg });

  function formatDateStr(date) {
    return date.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function offsetDateStr(offsetUnits) {
    if (!baseDate) return '—';
    if (offsetUnits <= 0) return formatDateStr(baseDate);
    let d;
    if (unit === 'Semanas') {
      d = new Date(baseDate);
      d.setDate(d.getDate() + offsetUnits * 7);
    } else if (unit === 'Meses') {
      d = new Date(baseDate);
      d.setMonth(d.getMonth() + offsetUnits);
    } else if (excludeWeekends) {
      d = new Date(baseDate);
      let added = 0;
      while (added < offsetUnits) {
        d.setDate(d.getDate() + 1);
        if (d.getDay() !== 0 && d.getDay() !== 6) added++;
      }
    } else {
      d = new Date(baseDate);
      d.setDate(d.getDate() + offsetUnits);
    }
    return formatDateStr(d);
  }

  return (
    <div style={{ marginTop: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ fontFamily: fonts.heading, fontWeight: 700, fontSize: '18px', color: colors.text }}>Cronograma</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            data-export="add-row-btn"
            onClick={onChangeAllTaskColors}
            style={{ display: 'flex', alignItems: 'center', gap: '7px', background: 'transparent', color: colors.primaryDark, border: `1.5px solid ${colors.primary}`, borderRadius: '10px', padding: '8px 14px', font: `600 14px ${fonts.body}`, cursor: 'pointer' }}
          >
            <span style={{ width: '13px', height: '13px', borderRadius: '50%', background: allTaskColorDot, display: 'inline-block', flexShrink: 0 }} />
            Cambiar color
          </button>
          <button
            data-export="add-row-btn"
            onClick={onAddTask}
            style={{ background: 'transparent', color: colors.primaryDark, border: `1.5px solid ${colors.primary}`, borderRadius: '10px', padding: '8px 14px', font: `600 14px ${fonts.body}`, cursor: 'pointer' }}
          >
            + Agregar fila
          </button>
        </div>
      </div>

      <div ref={scrollRef} data-export="gantt-scroll" style={{ border: `1px solid ${colors.border}`, borderRadius: '14px', overflowX: 'auto', overflowY: 'hidden', paddingBottom: '26px', background: colors.surface }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `${GRID_TEMPLATE_COLS} ${gridWidth}px`,
            gridTemplateRows: 'auto auto',
            minWidth: ganttMinWidth + 'px',
            background: headerBg,
            color: headerFg,
            borderBottom: `1px solid ${colors.border}`,
          }}
        >
          <div style={{ gridRow: '1 / span 2', gridColumn: 1, ...stickyHeaderStyle(STICKY_LEFT.drag) }} />
          <div style={{ gridRow: '1 / span 2', gridColumn: 2, ...stickyHeaderStyle(STICKY_LEFT.number) }}>#</div>
          <div style={{ gridRow: '1 / span 2', gridColumn: 3, ...stickyHeaderStyle(STICKY_LEFT.name) }}>Fase/Tarea/Subtarea</div>
          <div style={{ gridRow: '1 / span 2', gridColumn: 4, ...stickyHeaderStyle(STICKY_LEFT.duration) }}>Duración</div>
          <div style={{ gridRow: '1 / span 2', gridColumn: 5, ...stickyHeaderStyle(STICKY_LEFT.dep) }}>DEP</div>
          <div data-export="col-fecha-inicio" style={{ ...headerCellStyle, gridRow: '1 / span 2', gridColumn: 6 }}>Fecha inicio</div>
          <div data-export="col-fecha-fin" style={{ ...headerCellStyle, gridRow: '1 / span 2', gridColumn: 7 }}>Fecha fin</div>
          <div data-export="col-responsable" style={{ ...headerCellStyle, gridRow: '1 / span 2', gridColumn: 8 }}>Responsable</div>
          <div style={{ gridRow: 1, gridColumn: 9, padding: '6px 4px', textAlign: 'center', font: `700 12px ${fonts.body}`, textTransform: 'uppercase', letterSpacing: '.03em', borderBottom: `1px solid ${colors.border}` }}>
            {unit}
          </div>
          <div style={{ ...headerCellStyle, gridRow: 2, gridColumn: 9 }}>
            <div style={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: `${CELL_WIDTH}px`, backgroundImage: shadeGradient }}>
              {ganttColumns.map((col) => (
                <div
                  key={col}
                  onClick={() => onSetGuidePosition(col)}
                  style={{ textAlign: 'center', borderLeft: `1px solid ${colors.border}`, cursor: 'pointer' }}
                >
                  {col}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ position: 'relative', minWidth: ganttMinWidth + 'px', paddingBottom: hasDeliverables ? `${72 + (laneCount - 1) * 24}px` : '0px' }}>
          {scheduled.map((t, i) => {
            const ancestorIds = getAncestorIds(t.id, tasks);
            const isHiddenByCollapse = ancestorIds.some((aid) => collapsedIds.has(aid));
            if (isHiddenByCollapse) return null;

            const level = taskLevel(t.id, tasks);
            const isParent = hasChildren(t.id, tasks);
            const isCollapsed = collapsedIds.has(t.id);
            const childCount = tasks.filter((c) => c.parentId === t.id).length;
            const depOptions = [{ value: '', label: 'N/A' }].concat(
              tasks.map((o, oi) => ({ value: o.id, label: numbers[oi] })).filter((o) => o.value !== t.id)
            );
            const isDragging = draggingTaskId === t.id;
            const rootColor = getRootAncestorColor(t, tasks);
            const rowBg = isDragging
              ? '#FFFFFF'
              : level === 2
              ? i % 2 === 0
                ? lightenColor(headerBg || '#F5F8F7', 0.98)
                : 'transparent'
              : lightenColor(headerBg || '#F5F8F7', level === 0 ? 0.88 : 0.95);
            const stickyRowBg = rowBg === 'transparent' ? '#FFFFFF' : rowBg;
            const stickyCellStyle = (left, extra) => ({ position: 'sticky', left: left + 'px', zIndex: 2, background: stickyRowBg, ...extra });

            return (
              <div
                key={t.id}
                onDragOver={(e) => onRowDragOver(i, e)}
                onDrop={onRowDrop}
                style={{
                  display: 'grid',
                  gridTemplateColumns: `${GRID_TEMPLATE_COLS} ${gridWidth}px`,
                  minWidth: ganttMinWidth + 'px',
                  borderBottom: `1px solid ${colors.border}`,
                  alignItems: 'flex-start',
                  opacity: isDragging ? 0.4 : 1,
                  transform: isDragging ? 'scale(1.01)' : 'none',
                  boxShadow: isDragging ? '0 6px 14px rgba(15,26,22,.15)' : 'none',
                  transition: 'transform .15s ease, opacity .15s ease, box-shadow .15s ease',
                  background: rowBg,
                }}
              >
                <div
                  data-export="drag-handle"
                  draggable
                  onDragStart={(e) => onRowDragStart(i, e)}
                  onDragEnd={onRowDragEnd}
                  style={stickyCellStyle(STICKY_LEFT.drag, { cursor: 'grab', padding: '10px 6px', color: colors.textFaint })}
                >
                  <svg width="14" height="24" viewBox="0 0 14 24" fill="currentColor">
                    <circle cx="4" cy="6" r="1.5" /><circle cx="10" cy="6" r="1.5" />
                    <circle cx="4" cy="12" r="1.5" /><circle cx="10" cy="12" r="1.5" />
                    <circle cx="4" cy="18" r="1.5" /><circle cx="10" cy="18" r="1.5" />
                  </svg>
                </div>
                <div
                  style={stickyCellStyle(STICKY_LEFT.number, {
                    padding: '10px 4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    fontFamily: fonts.body,
                    fontSize: '14px',
                    color: colors.textMuted,
                    fontWeight: 600,
                    alignSelf: 'center',
                  })}
                >
                  {isParent && (
                    <button
                      data-export="collapse-btn"
                      onClick={() => onToggleCollapse(t.id)}
                      title={isCollapsed ? 'Expandir' : 'Plegar'}
                      style={{
                        width: '16px',
                        height: '16px',
                        flexShrink: 0,
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: 'none',
                        background: 'transparent',
                        color: colors.textMuted,
                        cursor: 'pointer',
                        borderRadius: '4px',
                      }}
                    >
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 10 10"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'none', transition: 'transform .1s ease' }}
                      >
                        <path d="M2 3.5 L5 6.5 L8 3.5" />
                      </svg>
                    </button>
                  )}
                  <span>{numbers[i]}</span>
                </div>
                <div style={stickyCellStyle(STICKY_LEFT.name, { width: '260px', boxSizing: 'border-box', padding: '10px 4px', display: 'flex', alignItems: 'flex-start', gap: '4px' })}>
                  <div
                    data-export="task-name-rich"
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => onUpdateTask(i, { name: e.target.innerHTML })}
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
                        e.preventDefault();
                        execBold();
                      }
                    }}
                    dangerouslySetInnerHTML={{ __html: t.name || '' }}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      boxSizing: 'border-box',
                      padding: '6px 8px',
                      paddingLeft: level * 28 + 8 + 'px',
                      border: `1.5px solid ${colors.border}`,
                      borderRadius: '8px',
                      fontFamily: fonts.body,
                      fontSize: '14px',
                      color: '#0F1A16',
                      background: 'transparent',
                      lineHeight: '1.3',
                      minHeight: '32px',
                      outline: 'none',
                    }}
                  />
                  <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {level < 2 && (
                        <button
                          data-export="add-child-btn"
                          onClick={() => onAddSubtask(i)}
                          title="Agregar subtarea"
                          style={{ flexShrink: 0, width: '24px', height: '24px', borderRadius: '6px', border: `1.5px solid ${colors.border}`, background: colors.surface, color: colors.primaryDark, font: `600 14px ${fonts.body}`, cursor: 'pointer', lineHeight: 1 }}
                        >
                          +
                        </button>
                      )}
                      <button
                        data-export="delete-row-btn"
                        className="delete-row-btn"
                        onClick={() => onDeleteTask(i)}
                        title="Eliminar fila"
                        style={{ flexShrink: 0, width: '20px', height: '20px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', color: colors.textFaint, cursor: 'pointer', borderRadius: '5px' }}
                      >
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2.5 4h11" /><path d="M6.5 4V2.5h3V4" /><path d="M4 4l.7 9h6.6L12 4" />
                        </svg>
                      </button>
                    </div>
                    {isParent && (
                      <div
                        style={{
                          font: `600 10px ${fonts.body}`,
                          color: headerFg,
                          background: headerBg,
                          borderRadius: '8px',
                          minWidth: '16px',
                          height: '14px',
                          padding: '0 4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {childCount}
                      </div>
                    )}
                  </div>
                </div>
                <div style={stickyCellStyle(STICKY_LEFT.duration, { padding: '10px 4px', alignSelf: 'center' })}>
                  <input
                    type="number"
                    min={1}
                    value={t.duration}
                    onChange={(e) => {
                      let duration = Number(e.target.value) || 1;
                      const bounds = getParentBounds(t.id, tasks);
                      if (bounds) duration = Math.max(1, Math.min(duration, bounds.end - t.start));
                      onUpdateTask(i, { duration });
                    }}
                    style={{ width: '56px', padding: '6px 8px', border: `1.5px solid ${colors.border}`, borderRadius: '8px', fontFamily: fonts.body, fontSize: '14px', color: colors.text }}
                  />
                </div>
                <div style={stickyCellStyle(STICKY_LEFT.dep, { padding: '10px 4px', alignSelf: 'center' })}>
                  <select
                    value={t.dependency || ''}
                    onChange={(e) => onUpdateTask(i, { dependency: e.target.value })}
                    style={{ width: '100%', padding: '6px 8px', border: `1.5px solid ${colors.border}`, borderRadius: '8px', fontFamily: fonts.body, fontSize: '14px', color: colors.text, background: colors.surface }}
                  >
                    {depOptions.map((opt) => (
                      <option key={opt.value || 'none'} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div data-export="cell-fecha-inicio" style={{ padding: '10px 4px', fontFamily: fonts.body, fontSize: '14px', color: colors.textMuted, alignSelf: 'center' }}>
                  {offsetDateStr(t.start)}
                </div>
                <div data-export="cell-fecha-fin" style={{ padding: '10px 4px', fontFamily: fonts.body, fontSize: '14px', color: colors.textMuted, alignSelf: 'center' }}>
                  {offsetDateStr(t.end)}
                </div>
                <div data-export="cell-responsable" style={{ padding: '10px 4px', alignSelf: 'center' }}>
                  <input
                    type="text"
                    placeholder="Nombre"
                    value={t.responsible || ''}
                    onChange={(e) => onUpdateTask(i, { responsible: e.target.value })}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '6px 8px', border: `1.5px solid ${colors.border}`, borderRadius: '8px', fontFamily: fonts.body, fontSize: '14px', color: colors.text }}
                  />
                </div>
                <div style={{ padding: '10px 4px', position: 'relative', height: '28px', alignSelf: 'center' }}>
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      height: '100%',
                      width: gridWidth + 'px',
                      backgroundImage: `${shadeGradient}, repeating-linear-gradient(to right, transparent 0, transparent ${CELL_WIDTH - 1}px, ${colors.border} ${CELL_WIDTH - 1}px, ${colors.border} ${CELL_WIDTH}px)`,
                    }}
                  />
                  <div
                    onMouseDown={(e) => onBarDragStart(i, t.start, CELL_WIDTH, e)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      if (level === 0) onBarContextMenu(t.id, e.clientX, e.clientY);
                    }}
                    style={{
                      position: 'absolute',
                      top: '6px',
                      left: t.start * CELL_WIDTH + 'px',
                      width: Math.max(6, t.duration * CELL_WIDTH - 4) + 'px',
                      height: '16px',
                      borderRadius: '6px',
                      background: level === 0 ? rootColor : lightenColor(rootColor, 0.55),
                      zIndex: 1,
                      cursor: 'grab',
                    }}
                  />
                </div>
              </div>
            );
          })}

          <div
            style={{
              position: 'absolute',
              top: 0,
              left: FIXED_COLS_WIDTH + 'px',
              width: gridWidth + 90 + 'px',
              height: '100%',
              paddingBottom: '18px',
              boxSizing: 'border-box',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          >
            {(deliverables || []).map((d, i) => {
              const color = d.color || '#DC2626';
              const pos = typeof d.position === 'number' ? d.position : 0;
              const isDraggingMarker = draggingDeliverableId === d.id;
              return (
                <div
                  key={d.id}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: pos * CELL_WIDTH + 'px',
                    height: `calc(100% - ${(laneCount - 1) * 24}px)`,
                    width: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    opacity: isDraggingMarker ? 0.6 : 1,
                  }}
                >
                  <div
                    onMouseDown={(e) => onDeliverableDragStart(i, pos, CELL_WIDTH, e)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      onDeliverableContextMenu(i, e.clientX, e.clientY);
                    }}
                    style={{ width: '2px', flex: 1, minHeight: '20px', background: color, pointerEvents: 'auto', cursor: 'grab' }}
                  />
                  <div style={{ width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: `10px solid ${color}` }} />
                  <div
                    onMouseDown={(e) => onDeliverableDragStart(i, pos, CELL_WIDTH, e)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      onDeliverableContextMenu(i, e.clientX, e.clientY);
                    }}
                    style={{
                      marginTop: '4px',
                      position: 'relative',
                      top: (laneOf[i] || 0) * 24 + 'px',
                      flexShrink: 0,
                      padding: '3px 8px',
                      borderRadius: '6px',
                      background: color,
                      color: '#FFFFFF',
                      font: `600 11px ${fonts.body}`,
                      whiteSpace: 'nowrap',
                      pointerEvents: 'auto',
                      cursor: 'grab',
                      userSelect: 'none',
                    }}
                  >
                    {ordinalLabel(i + 1)} Entregable
                  </div>
                </div>
              );
            })}
          </div>

          <div
            data-export="edit-guide"
            onMouseDown={(e) => onGuideDragStart(guidePos, CELL_WIDTH, maxEnd, e)}
            style={{
              position: 'absolute',
              top: 0,
              left: FIXED_COLS_WIDTH + guidePos * CELL_WIDTH - 5 + 'px',
              width: '10px',
              height: '100%',
              cursor: 'ew-resize',
              zIndex: 5,
              display: 'flex',
              justifyContent: 'center',
              pointerEvents: 'auto',
            }}
          >
            <div style={{ width: '6px', height: '100%', background: '#000000', borderRadius: '1px', display: 'flex', overflow: 'hidden', boxSizing: 'border-box', padding: '0 1.5px' }}>
              <div style={{ flex: 1, background: '#DC2626' }} />
              <div style={{ flex: 1, background: '#FACC15' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
