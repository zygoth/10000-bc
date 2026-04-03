import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import {
  listCordageFiberStockpileRows,
  listValidPartnerTaskCandidateEntries,
  PARTNER_TASK_GROUP_LABELS,
} from '../../debrief/partnerTaskQueueCandidates.mjs';
import { CAMP_MAINTENANCE_TASK_KIND } from '../../../game/campMaintenance.mjs';
import { resolveProcessOptionsForItemInApp } from '../actionContextWiring.mjs';
import { previewPartnerQueueTaskFromStockpileProcess } from '../../../game/simActions.mjs';
import {
  getCampMaintenanceReserveTicks,
  getPartnerTomorrowQueueCapacityPreview,
} from '../../../game/partnerCampSchedule.mjs';
import { TECH_RESEARCH_TASK_KIND } from '../../../game/techResearchCatalog.mjs';
import {
  humanizeDebriefTaskKind,
  partnerQueueTaskTitle,
} from '../../debrief/partnerQueueDisplay.mjs';

const STATION_BY_TASK_KIND = {
  scrape_and_dry: 'hide_frame',
  crack_shell: 'mortar_pestle',
  boil_sap: 'sugar_boiling_station',
};

const PARTNER_STATION_QUEUE_FLOWS = [
  {
    stationId: 'hide_frame',
    processId: 'scrape_and_dry',
    title: 'Hide frame',
    description: 'Scrape and dry hides (pick stockpile item & batch size)',
  },
  {
    stationId: 'mortar_pestle',
    processId: 'crack_shell',
    title: 'Mortar & pestle',
    description: 'Crack nuts and hard shells (pick item & quantity)',
  },
  {
    stationId: 'sugar_boiling_station',
    processId: 'boil_sap',
    title: 'Sugar boiling station',
    description: 'Boil filled sap vessels (one session per batch)',
  },
];

function taskSubtitle(task, formatTokenLabel) {
  if (task?.meta?.source === 'stockpile_process' && typeof task.meta.itemId === 'string') {
    const q = Math.max(1, Math.floor(Number(task.meta.quantity) || 1));
    return `Input: ${formatTokenLabel(task.meta.itemId)} ×${q}`;
  }
  return null;
}

function taskTicksRequired(task) {
  const tr = Number(task?.ticksRequired);
  return Number.isInteger(tr) ? tr : Math.max(1, Math.floor(Number(task?.ticksRequired) || 0));
}

function partitionMaintenanceTasks(tasks) {
  const list = Array.isArray(tasks) ? tasks : [];
  const maintenance = list.find((t) => t?.kind === CAMP_MAINTENANCE_TASK_KIND) || null;
  const rest = list.filter((t) => t?.kind !== CAMP_MAINTENANCE_TASK_KIND);
  return { maintenance, rest };
}

function reorderRestForDrop(rest, dragId, dropBeforeId) {
  const dragged = rest.find((t) => t.taskId === dragId);
  if (!dragged) {
    return rest;
  }
  const without = rest.filter((t) => t.taskId !== dragId);
  if (dropBeforeId == null) {
    return [...without, dragged];
  }
  if (dragId === dropBeforeId) {
    return rest;
  }
  const insertIdx = without.findIndex((t) => t.taskId === dropBeforeId);
  if (insertIdx < 0) {
    return [...without, dragged];
  }
  return [...without.slice(0, insertIdx), dragged, ...without.slice(insertIdx)];
}

function isStationBuilt(state, stationId) {
  return Array.isArray(state?.camp?.stationsUnlocked) && state.camp.stationsUnlocked.includes(stationId);
}

function listStockpileCandidatesForStation(state, stationId, processId) {
  const stacks = Array.isArray(state?.camp?.stockpile?.stacks) ? state.camp.stockpile.stacks : [];
  const out = [];
  for (const s of stacks) {
    const itemId = typeof s?.itemId === 'string' ? s.itemId : '';
    const q = Math.max(0, Math.floor(Number(s?.quantity) || 0));
    if (!itemId || q < 1) {
      continue;
    }
    const opts = resolveProcessOptionsForItemInApp(itemId);
    const match = opts.some((o) => o.processId === processId && o.location === stationId);
    if (match) {
      out.push({ itemId, maxQuantity: q });
    }
  }
  return out;
}

function TaskQueueRow({ task, indexLabel, formatTokenLabel }) {
  if (!task || typeof task !== 'object') {
    return null;
  }
  const title = partnerQueueTaskTitle(task, formatTokenLabel);
  const subtitle = taskSubtitle(task, formatTokenLabel);
  const req = taskTicksRequired(task);
  const stationId = STATION_BY_TASK_KIND[task.kind];
  const partnerOnly = task.kind === TECH_RESEARCH_TASK_KIND;
  const requiredDaily = task.kind === CAMP_MAINTENANCE_TASK_KIND;

  return (
    <div className="partner-queue-row">
      <div className="partner-queue-row-head">
        <span className="partner-queue-row-index">{indexLabel}</span>
        <span className="partner-queue-row-title">{title}</span>
        <span className="partner-queue-row-ticks">{req} ticks planned</span>
      </div>
      {subtitle ? <p className="partner-queue-row-sub debrief-note">{subtitle}</p> : null}
      <div className="partner-queue-row-badges">
        {requiredDaily ? <span className="partner-queue-badge">Required daily</span> : null}
        {partnerOnly ? <span className="partner-queue-badge">Partner only</span> : null}
        {stationId ? (
          <span className="partner-queue-badge partner-queue-badge--station">{formatTokenLabel(stationId)}</span>
        ) : null}
      </div>
    </div>
  );
}

export default function PartnerTaskQueuePanel({
  gameState,
  partnerActor,
  queuePendingTasks,
  mealPlanPreview = null,
  formatTokenLabel,
  validateAction,
  onPartnerTaskAppend,
  onPartnerQueueReorder,
  onOpenTechForest,
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [stationFlow, setStationFlow] = useState(null);
  const [spinCordageFlow, setSpinCordageFlow] = useState(false);
  const [pickedStockpile, setPickedStockpile] = useState(null);
  const [stationQuantity, setStationQuantity] = useState(1);
  const [queueMessage, setQueueMessage] = useState(null);

  const safePending = Array.isArray(queuePendingTasks) ? queuePendingTasks : [];
  const queueSyncKey = useMemo(
    () => safePending.map((t) => t?.taskId).filter(Boolean).join('|'),
    [queuePendingTasks],
  );
  const [restOrder, setRestOrder] = useState([]);
  const prevSyncKeyRef = useRef(null);
  useEffect(() => {
    if (queueSyncKey === prevSyncKeyRef.current) {
      return;
    }
    prevSyncKeyRef.current = queueSyncKey;
    const { rest } = partitionMaintenanceTasks(queuePendingTasks);
    setRestOrder(rest);
  }, [queueSyncKey, queuePendingTasks]);

  const taskById = useMemo(() => {
    const list = Array.isArray(queuePendingTasks) ? queuePendingTasks : [];
    const m = new Map();
    for (const t of list) {
      if (typeof t?.taskId === 'string' && t.taskId) {
        m.set(t.taskId, t);
      }
    }
    return m;
  }, [queuePendingTasks]);

  const maintenanceTask = useMemo(
    () => safePending.find((t) => t?.kind === CAMP_MAINTENANCE_TASK_KIND) || null,
    [safePending],
  );

  const tryReorderRest = useCallback(
    (nextRest) => {
      if (typeof onPartnerQueueReorder !== 'function') {
        return;
      }
      const full = maintenanceTask ? [maintenanceTask, ...nextRest] : nextRest;
      const orderedTaskIds = full.map((t) => t.taskId).filter(Boolean);
      const v = validateAction(gameState, {
        actorId: 'player',
        kind: 'partner_queue_reorder',
        payload: { orderedTaskIds },
      });
      if (!v.ok) {
        setQueueMessage(v.message || 'Could not reorder queue.');
        return;
      }
      setQueueMessage(null);
      setRestOrder(nextRest);
      onPartnerQueueReorder(orderedTaskIds);
    },
    [gameState, validateAction, onPartnerQueueReorder, maintenanceTask],
  );

  const tomorrowPreview = useMemo(
    () => getPartnerTomorrowQueueCapacityPreview(gameState, partnerActor, mealPlanPreview),
    [gameState, partnerActor, mealPlanPreview],
  );

  const maintenanceReserve = useMemo(() => getCampMaintenanceReserveTicks(gameState), [gameState]);

  useEffect(() => {
    if (!addOpen) {
      return undefined;
    }
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (pickedStockpile) {
          setPickedStockpile(null);
          return;
        }
        if (stationFlow) {
          setStationFlow(null);
          return;
        }
        if (spinCordageFlow) {
          setSpinCordageFlow(false);
          return;
        }
        setAddOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [addOpen, stationFlow, spinCordageFlow, pickedStockpile]);

  const candidates = useMemo(
    () => listValidPartnerTaskCandidateEntries(gameState, validateAction),
    [gameState, validateAction],
  );

  const estimatedQueueTicks = useMemo(() => {
    let sum = 0;
    for (const t of safePending) {
      sum += taskTicksRequired(t);
    }
    return sum;
  }, [safePending]);

  const queueOverTomorrowCapacity = tomorrowPreview.queueCapacity > 0
    && estimatedQueueTicks > tomorrowPreview.queueCapacity;

  const cordageFiberRows = useMemo(() => listCordageFiberStockpileRows(gameState), [gameState]);

  const stockpileStationCandidates = useMemo(() => {
    if (!stationFlow) {
      return [];
    }
    return listStockpileCandidatesForStation(
      gameState,
      stationFlow.stationId,
      stationFlow.processId,
    );
  }, [gameState, stationFlow]);

  const stationPreview = useMemo(() => {
    if (!stationFlow || !pickedStockpile) {
      return null;
    }
    return previewPartnerQueueTaskFromStockpileProcess(gameState, {
      itemId: pickedStockpile.itemId,
      processId: stationFlow.processId,
      processLocation: stationFlow.stationId,
      quantity: stationQuantity,
    });
  }, [gameState, stationFlow, pickedStockpile, stationQuantity]);

  const spinCordagePreview = useMemo(() => {
    if (!spinCordageFlow || !pickedStockpile) {
      return null;
    }
    return previewPartnerQueueTaskFromStockpileProcess(gameState, {
      itemId: pickedStockpile.itemId,
      processId: 'spin_cordage',
      quantity: stationQuantity,
    });
  }, [gameState, spinCordageFlow, pickedStockpile, stationQuantity]);

  const builtStationFlows = useMemo(
    () => PARTNER_STATION_QUEUE_FLOWS.filter((flow) => isStationBuilt(gameState, flow.stationId)),
    [gameState],
  );

  const openAddModal = useCallback(() => {
    setStationFlow(null);
    setSpinCordageFlow(false);
    setPickedStockpile(null);
    setStationQuantity(1);
    setQueueMessage(null);
    setAddOpen(true);
  }, []);

  const closeAddModal = useCallback(() => {
    setAddOpen(false);
    setStationFlow(null);
    setSpinCordageFlow(false);
    setPickedStockpile(null);
    setStationQuantity(1);
  }, []);

  const appendCraftTask = useCallback(
    (blueprint) => {
      setQueueMessage(null);
      const validation = validateAction(gameState, {
        actorId: 'player',
        kind: 'partner_task_set',
        payload: {
          queuePolicy: 'append',
          task: {
            ...blueprint.task,
            taskId: `ui-${blueprint.id}-${Date.now()}`,
          },
        },
      });
      if (!validation.ok) {
        setQueueMessage(validation.message || 'Could not add task.');
        return;
      }
      const normalizedTask = validation.normalizedAction?.payload?.task;
      if (!normalizedTask || typeof normalizedTask !== 'object') {
        setQueueMessage('Could not add task.');
        return;
      }
      onPartnerTaskAppend(normalizedTask);
      setQueueMessage(`Queued: ${blueprint.label} (${taskTicksRequired(normalizedTask)} ticks).`);
      closeAddModal();
    },
    [gameState, validateAction, onPartnerTaskAppend, closeAddModal],
  );

  const appendStationTask = useCallback(() => {
    if (!stationPreview?.ok || !stationPreview.task) {
      setQueueMessage(stationPreview?.message || 'Invalid batch.');
      return;
    }
    setQueueMessage(null);
    const validation = validateAction(gameState, {
      actorId: 'player',
      kind: 'partner_task_set',
      payload: {
        queuePolicy: 'append',
        task: {
          ...stationPreview.task,
          taskId: `ui-station-${Date.now()}`,
        },
      },
    });
    if (!validation.ok) {
      setQueueMessage(validation.message || 'Could not add task.');
      return;
    }
    const normalizedTask = validation.normalizedAction?.payload?.task;
    if (!normalizedTask) {
      setQueueMessage('Could not add task.');
      return;
    }
    onPartnerTaskAppend(normalizedTask);
    setQueueMessage(
      `Queued: ${humanizeDebriefTaskKind(stationFlow.processId)} ${formatTokenLabel(pickedStockpile.itemId)} ×${stationQuantity} (${taskTicksRequired(normalizedTask)} ticks).`,
    );
    closeAddModal();
  }, [
    closeAddModal,
    formatTokenLabel,
    gameState,
    onPartnerTaskAppend,
    pickedStockpile,
    stationFlow,
    stationPreview,
    stationQuantity,
    validateAction,
  ]);

  const appendSpinCordageTask = useCallback(() => {
    if (!spinCordagePreview?.ok || !spinCordagePreview.task) {
      setQueueMessage(spinCordagePreview?.message || 'Invalid batch.');
      return;
    }
    setQueueMessage(null);
    const validation = validateAction(gameState, {
      actorId: 'player',
      kind: 'partner_task_set',
      payload: {
        queuePolicy: 'append',
        task: {
          ...spinCordagePreview.task,
          taskId: `ui-spin-cordage-${Date.now()}`,
        },
      },
    });
    if (!validation.ok) {
      setQueueMessage(validation.message || 'Could not add task.');
      return;
    }
    const normalizedTask = validation.normalizedAction?.payload?.task;
    if (!normalizedTask) {
      setQueueMessage('Could not add task.');
      return;
    }
    onPartnerTaskAppend(normalizedTask);
    setQueueMessage(
      `Queued: spin cordage ${formatTokenLabel(pickedStockpile.itemId)} ×${stationQuantity} (${taskTicksRequired(normalizedTask)} ticks).`,
    );
    closeAddModal();
  }, [
    closeAddModal,
    formatTokenLabel,
    gameState,
    onPartnerTaskAppend,
    pickedStockpile,
    spinCordagePreview,
    stationQuantity,
    validateAction,
  ]);

  return (
    <div className="partner-task-queue-panel">
      <div className="partner-queue-budget debrief-note">
        <strong>Partner schedule (next day):</strong>{' '}
        ~{tomorrowPreview.dayStartBase} ticks day-start budget
        {tomorrowPreview.stewBonus > 0 ? ` + ${tomorrowPreview.stewBonus} from tonight's stew` : ''}.
        <span className="partner-queue-budget-hint">
          {' '}
          Camp maintenance (~{maintenanceReserve} ticks, GDD §7.4) is queued automatically at the top each day.
        </span>
        <span className="partner-queue-budget-hint">
          {' '}
          Rough nominal capacity for <strong>all</strong> partner work tomorrow: ~{tomorrowPreview.queueCapacity} ticks (day-start + stew bonus).
        </span>
      </div>

      {queueOverTomorrowCapacity ? (
        <p className="debrief-note partner-queue-warn" role="status">
          This queue (~{estimatedQueueTicks} ticks) may exceed tomorrow's estimated partner tick budget (~{tomorrowPreview.queueCapacity} ticks).
        </p>
      ) : null}

      {queueMessage ? (
        <p className="debrief-note partner-queue-inline-msg" role="status">
          {queueMessage}
        </p>
      ) : null}

      <div className="partner-queue-section">
        <h4 className="partner-queue-subhead">Queue</h4>
        <p className="debrief-note partner-queue-dnd-hint">
          Drag tasks to change order. Camp maintenance stays first when present.
        </p>
        {!maintenanceTask && restOrder.length === 0 ? (
          <p className="debrief-note">Nothing queued.</p>
        ) : (
          <ul
            className="partner-queue-list"
            onDragOver={(e) => {
              e.preventDefault();
            }}
          >
            {maintenanceTask ? (
              <li key={maintenanceTask.taskId || 'camp-maintenance'} className="partner-queue-li partner-queue-li--fixed">
                <TaskQueueRow task={maintenanceTask} indexLabel="#1" formatTokenLabel={formatTokenLabel} />
              </li>
            ) : null}
            {restOrder.map((refTask, idx) => {
              const task = taskById.get(refTask.taskId) || refTask;
              const displayIdx = (maintenanceTask ? 2 : 1) + idx;
              return (
                <li
                  key={task.taskId || `q-${idx}`}
                  className="partner-queue-li partner-queue-li--draggable"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', task.taskId);
                    e.currentTarget.classList.add('partner-queue-li--dragging');
                  }}
                  onDragEnd={(e) => {
                    e.currentTarget.classList.remove('partner-queue-li--dragging');
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const dragId = e.dataTransfer.getData('text/plain');
                    const next = reorderRestForDrop(restOrder, dragId, task.taskId);
                    tryReorderRest(next);
                  }}
                >
                  <TaskQueueRow task={task} indexLabel={`#${displayIdx}`} formatTokenLabel={formatTokenLabel} />
                </li>
              );
            })}
            {restOrder.length > 0 ? (
              <li
                key="partner-queue-drop-end"
                className="partner-queue-li partner-queue-drop-end"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const dragId = e.dataTransfer.getData('text/plain');
                  const next = reorderRestForDrop(restOrder, dragId, null);
                  tryReorderRest(next);
                }}
              >
                <span className="debrief-note">Drop here to move to end</span>
              </li>
            ) : null}
          </ul>
        )}
      </div>

      <p className="debrief-note partner-queue-estimate">
        <strong>Estimated load:</strong> {estimatedQueueTicks} ticks in this queue (each entry uses catalog tick costs).
      </p>

      <div className="partner-queue-actions">
        <button type="button" className="debrief-begin-btn partner-queue-add-btn" onClick={openAddModal}>
          + Add task
        </button>
        {typeof onOpenTechForest === 'function' ? (
          <button type="button" className="debrief-tech-forest-btn" onClick={onOpenTechForest}>
            View Tech Forest
          </button>
        ) : null}
      </div>

      {addOpen ? (
        <div
          className="partner-queue-modal-backdrop"
          role="presentation"
          onClick={closeAddModal}
        >
          <div
            className="partner-queue-modal"
            role="dialog"
            aria-label="Add partner task"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="partner-queue-modal-header">
              <h3>
                {stationFlow ? stationFlow.title : spinCordageFlow ? 'Spin cordage (fiber)' : 'Add partner task'}
              </h3>
              <button type="button" className="partner-queue-modal-close" onClick={closeAddModal} aria-label="Close">
                ×
              </button>
            </header>

            {stationFlow ? (
              <>
                <button
                  type="button"
                  className="partner-queue-back-btn debrief-note"
                  onClick={() => {
                    setStationFlow(null);
                    setPickedStockpile(null);
                    setStationQuantity(1);
                  }}
                >
                  ← Back
                </button>
                <p className="debrief-note">{stationFlow.description}</p>
                {!isStationBuilt(gameState, stationFlow.stationId) ? (
                  <p className="debrief-note partner-queue-warn">Build {formatTokenLabel(stationFlow.stationId)} first.</p>
                ) : !pickedStockpile ? (
                  <>
                    {stockpileStationCandidates.length === 0 ? (
                      <p className="debrief-note">No compatible items in the stockpile.</p>
                    ) : (
                      <ul className="partner-queue-candidate-list">
                        {stockpileStationCandidates.map((row) => (
                          <li key={row.itemId}>
                            <button
                              type="button"
                              className="partner-queue-candidate-btn"
                              onClick={() => {
                                setPickedStockpile(row);
                                setStationQuantity(1);
                              }}
                            >
                              <span>{formatTokenLabel(row.itemId)}</span>
                              <span className="partner-queue-candidate-ticks">×{row.maxQuantity} in stock</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                ) : (
                  <div className="partner-queue-station-detail">
                    <p className="debrief-note">
                      <strong>{formatTokenLabel(pickedStockpile.itemId)}</strong>
                    </p>
                    <label className="partner-queue-qty-label" htmlFor="partner-station-qty">
                      Batch quantity (max {pickedStockpile.maxQuantity})
                    </label>
                    <input
                      id="partner-station-qty"
                      type="number"
                      min={1}
                      max={pickedStockpile.maxQuantity}
                      value={stationQuantity}
                      onChange={(e) => {
                        const n = Math.floor(Number(e.target.value) || 1);
                        setStationQuantity(Math.min(pickedStockpile.maxQuantity, Math.max(1, n)));
                      }}
                      className="partner-queue-qty-input"
                    />
                    {stationPreview && !stationPreview.ok ? (
                      <p className="debrief-note partner-queue-warn">{stationPreview.message}</p>
                    ) : null}
                    {stationPreview?.ok ? (
                      <div className="debrief-note partner-queue-preview-block">
                        <p>
                          <strong>Task cost:</strong> {stationPreview.ticksRequired} ticks
                        </p>
                        <p>
                          <strong>Expected outputs:</strong>{' '}
                          {(stationPreview.task.outputs || [])
                            .map((o) => `${formatTokenLabel(o.itemId)} ×${o.quantity}`)
                            .join(', ') || '—'}
                        </p>
                      </div>
                    ) : null}
                    <div className="partner-queue-station-actions">
                      <button type="button" className="debrief-note" onClick={() => setPickedStockpile(null)}>
                        Choose different item
                      </button>
                      <button
                        type="button"
                        className="debrief-begin-btn"
                        disabled={!stationPreview?.ok}
                        onClick={appendStationTask}
                      >
                        Add to queue
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : spinCordageFlow ? (
              <>
                <button
                  type="button"
                  className="partner-queue-back-btn debrief-note"
                  onClick={() => {
                    setSpinCordageFlow(false);
                    setPickedStockpile(null);
                    setStationQuantity(1);
                  }}
                >
                  ← Back
                </button>
                <p className="debrief-note">
                  Uses the thread spinner when built (half hand time); otherwise hand spinning. Cost matches camp processing rules.
                </p>
                {!pickedStockpile ? (
                  <>
                    {cordageFiberRows.length === 0 ? (
                      <p className="debrief-note">No cordage fiber in the stockpile.</p>
                    ) : (
                      <ul className="partner-queue-candidate-list">
                        {cordageFiberRows.map((row) => (
                          <li key={row.itemId}>
                            <button
                              type="button"
                              className="partner-queue-candidate-btn"
                              onClick={() => {
                                setPickedStockpile(row);
                                setStationQuantity(1);
                              }}
                            >
                              <span>{formatTokenLabel(row.itemId)}</span>
                              <span className="partner-queue-candidate-ticks">×{row.maxQuantity} in stock</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                ) : (
                  <div className="partner-queue-station-detail">
                    <p className="debrief-note">
                      <strong>{formatTokenLabel(pickedStockpile.itemId)}</strong>
                    </p>
                    <label className="partner-queue-qty-label" htmlFor="partner-spin-qty">
                      Batch quantity (max {pickedStockpile.maxQuantity})
                    </label>
                    <input
                      id="partner-spin-qty"
                      type="number"
                      min={1}
                      max={pickedStockpile.maxQuantity}
                      value={stationQuantity}
                      onChange={(e) => {
                        const n = Math.floor(Number(e.target.value) || 1);
                        setStationQuantity(Math.min(pickedStockpile.maxQuantity, Math.max(1, n)));
                      }}
                      className="partner-queue-qty-input"
                    />
                    {spinCordagePreview && !spinCordagePreview.ok ? (
                      <p className="debrief-note partner-queue-warn">{spinCordagePreview.message}</p>
                    ) : null}
                    {spinCordagePreview?.ok ? (
                      <div className="debrief-note partner-queue-preview-block">
                        <p>
                          <strong>Task cost:</strong> {spinCordagePreview.ticksRequired} ticks
                        </p>
                        <p>
                          <strong>Expected outputs:</strong>{' '}
                          {(spinCordagePreview.task.outputs || [])
                            .map((o) => `${formatTokenLabel(o.itemId)} ×${o.quantity}`)
                            .join(', ') || '—'}
                        </p>
                      </div>
                    ) : null}
                    <div className="partner-queue-station-actions">
                      <button type="button" className="debrief-note" onClick={() => setPickedStockpile(null)}>
                        Choose different item
                      </button>
                      <button
                        type="button"
                        className="debrief-begin-btn"
                        disabled={!spinCordagePreview?.ok}
                        onClick={appendSpinCordageTask}
                      >
                        Add to queue
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="debrief-note">
                  Queue tasks for <strong>tomorrow</strong>. Tech research: use <strong>View Tech Forest</strong> or <strong>Research…</strong> below.
                </p>
                <div className="partner-queue-candidate-group">
                  <h4 className="partner-queue-subhead">{PARTNER_TASK_GROUP_LABELS.crafting}</h4>
                  {candidates.length === 0 ? (
                    <p className="debrief-note">No crafting tasks validate right now.</p>
                  ) : (
                    <ul className="partner-queue-candidate-list">
                      {candidates.map((c) => (
                        <li key={c.id}>
                          <button type="button" className="partner-queue-candidate-btn" onClick={() => appendCraftTask(c)}>
                            <span className="partner-queue-candidate-label">{c.label}</span>
                            <span className="partner-queue-candidate-ticks">{c.validatedTicks} ticks</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {cordageFiberRows.length > 0 ? (
                  <div className="partner-queue-candidate-group">
                    <h4 className="partner-queue-subhead">Cordage</h4>
                    <ul className="partner-queue-candidate-list">
                      <li key="spin-cordage">
                        <button
                          type="button"
                          className="partner-queue-candidate-btn"
                          onClick={() => {
                            setStationFlow(null);
                            setSpinCordageFlow(true);
                            setPickedStockpile(null);
                            setStationQuantity(1);
                          }}
                        >
                          <span className="partner-queue-candidate-label">Spin cordage (fiber)</span>
                          <span className="partner-queue-candidate-ticks">Configure…</span>
                        </button>
                      </li>
                    </ul>
                  </div>
                ) : null}
                <div className="partner-queue-candidate-group">
                  <h4 className="partner-queue-subhead">Station processing</h4>
                  <p className="debrief-note">Pick a station, then a stockpile item and batch size (same rules as camp processing).</p>
                  {builtStationFlows.length === 0 ? (
                    <p className="debrief-note">Build a camp station (hide frame, mortar, sugar boiling, …) to queue processing here.</p>
                  ) : (
                    <ul className="partner-queue-candidate-list">
                      {builtStationFlows.map((flow) => (
                        <li key={flow.stationId}>
                          <button
                            type="button"
                            className="partner-queue-candidate-btn"
                            onClick={() => {
                              setSpinCordageFlow(false);
                              setStationFlow(flow);
                              setPickedStockpile(null);
                              setStationQuantity(1);
                            }}
                          >
                            <span className="partner-queue-candidate-label">{flow.title}</span>
                            <span className="partner-queue-candidate-ticks">Configure…</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {typeof onOpenTechForest === 'function' ? (
                  <button
                    type="button"
                    className="debrief-tech-forest-btn partner-queue-modal-tech"
                    onClick={() => {
                      closeAddModal();
                      onOpenTechForest();
                    }}
                  >
                    Research…
                  </button>
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
