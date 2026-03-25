import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

function GameModeChrome({
  onSwitchToDebug,
  onNewGameFromSettings,
  showAnchorDebug,
  onToggleAnchorDebug,
  metrics,
  gameState,
  playerActor,
  playerAtCamp,
  playerNatureSightDays,
  dayProgressPercent,
  nightThresholdPercent,
  dayTick,
  ticksPerDay,
  calendarLabel,
  playerTickBudgetCurrent,
  playerTickBudgetBase,
  playerOverdraftTicks,
  hasTickOverdraft,
  familyVitalGroups,
  warningEntries,
  onAcknowledgeWarning,
  selectedTileX,
  selectedTileY,
  selectedTileEntity,
  selectedTileWorldItems,
  tilePanelMode,
  selectedInspectData,
  onRunQuickAction,
  isInventoryPanelOpen,
  isPauseMenuOpen,
  onClosePauseMenu,
  actionComposerStatus,
  playActionFeed,
  playerCarryWeightKg,
  playerCarryCapacityKg,
  selectedInventoryItemId,
  setSelectedInventoryItemId,
  playerInventoryStacks,
  inventoryQuickActionsByItemId,
  selectedStockpileItemId,
  setSelectedStockpileItemId,
  campStockpileStacks,
  stockpileQuickActionsByItemId,
  playerEquipment,
  equipmentSlots,
  onUnequipSlot,
  campDryingRackSlots,
  onDryingRackRemove,
  selectedWorldItemId,
  setSelectedWorldItemId,
  isDebriefActive,
  onEndDayEnterDebrief,
  selectedDebriefTab,
  onSelectDebriefTab,
  canBeginDay,
  hasVisitedMealTab,
  debriefSpoilageEntries,
  queueActiveTask,
  queuePendingTasks,
  partnerTaskHistory,
  mealPlanIngredients,
  mealPlanPreview,
  lastMealResult,
  chosenVisionRewards,
  onBeginDay,
  visionUsesThisSeason,
  visionSelectionOptions,
  selectedVisionItemId,
  setSelectedVisionItemId,
  pendingVisionChoices,
  selectedVisionCategory,
  setSelectedVisionCategory,
  selectedNatureOverlay,
  setSelectedNatureOverlay,
  natureSightOverlayOptions,
  visionNotifications,
  visionRequest,
  medicineNotifications,
  medicineRequests,
  onFocusConditionInstance,
  onAdministerCondition,
}) {
  const formatWeightLabel = (valueKg) => {
    const numeric = Number(valueKg);
    if (!Number.isFinite(numeric)) return '0g';
    if (numeric < 0.1) return `${Math.round(numeric * 1000)}g`;
    return `${numeric.toFixed(2)}kg`;
  };

  const selectedInventoryEntry = playerInventoryStacks.find((e) => e.itemId === selectedInventoryItemId) || null;
  const selectedStockpileEntry = campStockpileStacks.find((e) => e.itemId === selectedStockpileItemId) || null;
  const [itemContextMenu, setItemContextMenu] = useState(null);
  const activeItemContextEntries = itemContextMenu
    ? (
      itemContextMenu.source === 'stockpile'
        ? stockpileQuickActionsByItemId?.[itemContextMenu.itemId]
        : inventoryQuickActionsByItemId?.[itemContextMenu.itemId]
    ) || []
    : [];

  useEffect(() => {
    if (!isInventoryPanelOpen || isDebriefActive) {
      setItemContextMenu(null);
    }
  }, [isDebriefActive, isInventoryPanelOpen]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      // Secondary button: contextmenu opens the menu; a follow-up pointerdown would
      // immediately clear it (React 17 does not batch across those events).
      if (event.button !== 0) {
        return;
      }
      setItemContextMenu(null);
    };
    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  // Single worst-status color for partner/child dots
  const worstSeverityColor = (group) => {
    const order = ['critical', 'low', 'warning', 'good'];
    const worst = group.rows.reduce((acc, row) => {
      const idx = order.indexOf(row.severity);
      return idx < order.indexOf(acc) ? row.severity : acc;
    }, 'good');
    return worst;
  };

  return (
    <>
      {/* ── Pause overlay ── */}
      {isPauseMenuOpen ? (
        <div className="pause-overlay" role="dialog" aria-label="Pause menu">
          <div className="pause-card">
            <h2>Paused</h2>
            <div className="pause-actions">
              <button type="button" onClick={onClosePauseMenu}>Resume</button>
              <button type="button" onClick={onSwitchToDebug}>Debug View</button>
              <button type="button" onClick={onNewGameFromSettings}>New Game</button>
              <button
                type="button"
                onClick={onToggleAnchorDebug}
              >
                Anchor Debug: {showAnchorDebug ? 'on' : 'off'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Top-center: day info bar ── */}
      {!isDebriefActive ? (
        <div className="hud-top-bar" aria-label="Day status">
          <span className="hud-calendar">{calendarLabel}</span>
          <div className="hud-bars-row">
            <div className="hud-bar-group">
              <span className="hud-bar-label">Day</span>
              <div
                className="hud-progress-bar"
                role="meter"
                aria-label="Day progress"
                aria-valuemin={0}
                aria-valuemax={ticksPerDay}
                aria-valuenow={dayTick}
              >
                <span className="hud-progress-fill" style={{ width: `${dayProgressPercent}%` }} />
                <span className="hud-progress-threshold" style={{ left: `${nightThresholdPercent}%` }} />
              </div>
              <span className="hud-bar-value">{dayTick}/{ticksPerDay}</span>
            </div>
            <div className="hud-bar-group">
              <span className="hud-bar-label">Budget</span>
              <div
                className={`hud-progress-bar ${hasTickOverdraft ? 'hud-progress-bar-overdraft' : ''}`}
                role="meter"
                aria-label="Tick budget"
                aria-valuemin={0}
                aria-valuemax={playerTickBudgetBase}
                aria-valuenow={playerTickBudgetCurrent}
              >
                <span
                  className="hud-progress-fill"
                  style={{ width: `${Math.max(0, Math.min(100, (playerTickBudgetCurrent / Math.max(1, playerTickBudgetBase)) * 100))}%` }}
                />
              </div>
              <span className={`hud-bar-value ${hasTickOverdraft ? 'hud-overdraft-text' : ''}`}>
                {hasTickOverdraft
                  ? `-${playerOverdraftTicks} overdraft`
                  : `${playerTickBudgetCurrent}/${playerTickBudgetBase}`}
              </span>
            </div>
          </div>
          {playerNatureSightDays > 0 ? (
            <span className="hud-nature-sight">Nature Sight: {playerNatureSightDays} day{playerNatureSightDays !== 1 ? 's' : ''} remaining</span>
          ) : null}
        </div>
      ) : null}

      {/* ── Left vitals strip ── */}
      {!isDebriefActive ? (
        <div className="hud-vitals-strip" aria-label="Family status">
          {familyVitalGroups.map((group) => {
            if (group.actorId === 'player') {
              return (
                <div key={`vitals-${group.actorId}`} className="hud-vitals-player">
                  <span className="hud-vitals-label">You</span>
                  {group.rows.map((row) => (
                    <div key={`vr-${row.key}`} className="hud-vital-row">
                      <span className="hud-vital-key">{row.label[0]}</span>
                      <div className="hud-vital-track" role="meter" aria-label={row.label} aria-valuenow={row.percent}>
                        <span className={`hud-vital-fill hud-vital-fill-${row.severity}`} style={{ width: `${row.percent}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              );
            }
            const dotSeverity = worstSeverityColor(group);
            return (
              <div key={`vitals-${group.actorId}`} className="hud-vitals-companion">
                <span className={`hud-companion-dot hud-companion-dot-${dotSeverity}`} title={`${group.label}: worst bar ${dotSeverity}`} />
                <span className="hud-vitals-label">{group.label}</span>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* ── Warning banners ── */}
      {!isDebriefActive && warningEntries.length > 0 ? (
        <div className="hud-warnings" aria-label="Warnings">
          {warningEntries.map((entry) => (
            <div key={entry.id} className={`hud-warning hud-warning-${entry.severity}`}>
              <span>{entry.title}: {entry.message}</span>
              <button type="button" onClick={() => onAcknowledgeWarning(entry.id)}>✕</button>
            </div>
          ))}
        </div>
      ) : null}
      {!isDebriefActive && typeof actionComposerStatus === 'string' && actionComposerStatus.startsWith('dig discovery after ') ? (
        <div className="hud-warnings" aria-label="Action updates">
          <div className="hud-warning hud-warning-good">
            <span>{actionComposerStatus}</span>
          </div>
        </div>
      ) : null}

      {/* ── End Day button (at camp only) ── */}
      {!isDebriefActive && playerAtCamp ? (
        <button type="button" className="hud-end-day-btn" onClick={onEndDayEnterDebrief}>
          End Day
        </button>
      ) : null}

      {/* ── Inspect panel (right side, triggered by right-click) ── */}
      {!isDebriefActive && tilePanelMode === 'inspect' && selectedInspectData?.canInspect ? (
        <aside className={`hud-inspect-panel ${isInventoryPanelOpen ? 'hud-inspect-panel-shift' : ''}`} aria-label="Plant inspection">
          <h3>{selectedInspectData.identified ? `${selectedInspectData.plantName} (${selectedInspectData.speciesId})` : 'Unknown Plant'}</h3>
          <p className="hud-inspect-row">{selectedInspectData.fieldDescription}</p>
          {selectedInspectData.identified && selectedInspectData.gameDescription ? (
            <p className="hud-inspect-row">{selectedInspectData.gameDescription}</p>
          ) : null}
          <p className="hud-inspect-row"><strong>Stage:</strong> {selectedInspectData.lifeStageLabel}</p>
          {selectedInspectData.activeParts.map((part) => (
            <div key={`${part.partName}:${part.subStageId}`} className="hud-inspect-part">
              <p className="hud-inspect-row"><strong>{part.partLabel}</strong> ({part.subStageLabel})</p>
              {part.fieldDescription ? <p className="hud-inspect-row">{part.fieldDescription}</p> : null}
              {selectedInspectData.identified && part.gameDescription ? (
                <p className="hud-inspect-row">{part.gameDescription}</p>
              ) : null}
            </div>
          ))}
        </aside>
      ) : null}

      {/* ── Inventory panel (Tab key) ── */}
      {!isDebriefActive && isInventoryPanelOpen ? (
        <aside className="hud-inventory-panel" aria-label="Inventory">
          <div className="hud-inventory-header">
            <h3>Inventory</h3>
            <span className={`hud-weight-label ${playerCarryWeightKg / Math.max(1, playerCarryCapacityKg) >= 0.95 ? 'hud-weight-critical' : playerCarryWeightKg / Math.max(1, playerCarryCapacityKg) >= 0.8 ? 'hud-weight-warn' : ''}`}>
              {formatWeightLabel(playerCarryWeightKg)} / {formatWeightLabel(playerCarryCapacityKg)}
            </span>
          </div>

          {/* Item grid */}
          <div className="inventory-grid" role="listbox" aria-label="Inventory items">
            {playerInventoryStacks.length === 0 ? (
              <p className="hud-empty-note">Empty</p>
            ) : (
              playerInventoryStacks.map((entry) => (
                <button
                  key={entry.key}
                  type="button"
                  role="option"
                  aria-selected={selectedInventoryItemId === entry.itemId}
                  className={`inventory-slot ${selectedInventoryItemId === entry.itemId ? 'selected' : ''}`}
                  onClick={() => setSelectedInventoryItemId(entry.itemId)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    const { clientX, clientY } = event;
                    const { itemId } = entry;
                    queueMicrotask(() => {
                      setSelectedInventoryItemId(itemId);
                      setItemContextMenu({
                        source: 'inventory',
                        itemId,
                        x: clientX,
                        y: clientY,
                      });
                    });
                  }}
                  title={`${entry.name} — ${formatWeightLabel(entry.totalWeightKg)}${entry.decayDays !== null ? ` | spoils in ${entry.decayDays}d` : ''}`}
                >
                  {entry.spriteStyle ? (
                    <span className="slot-sprite" style={entry.spriteStyle} aria-hidden="true" />
                  ) : null}
                  <span className="slot-name">{entry.name}</span>
                  <span className="slot-qty">×{entry.quantity}</span>
                </button>
              ))
            )}
          </div>

          {/* Selected item details */}
          {selectedInventoryEntry ? (
            <div className="hud-item-actions">
              <p className="hud-item-name">{selectedInventoryEntry.name} ×{selectedInventoryEntry.quantity}</p>
              <p className="hud-empty-note">Right-click an item to open actions.</p>
            </div>
          ) : null}

          {/* Equipment */}
          <div className="hud-equipment">
            <h4>Equipment</h4>
            {equipmentSlots.map((slot) => (
              <div key={`equip-${slot}`} className="hud-equip-row">
                <span className="hud-equip-slot">{slot}</span>
                <span className="hud-equip-item">{playerEquipment?.[slot]?.itemId || '—'}</span>
                {playerEquipment?.[slot] ? (
                  <button type="button" className="hud-equip-unequip" onClick={() => onUnequipSlot(slot)}>✕</button>
                ) : null}
              </div>
            ))}
          </div>

          {/* Camp stockpile (at camp only) */}
          {playerAtCamp ? (
            <>
              <h4>Camp Stockpile</h4>
              <div className="inventory-grid" role="listbox" aria-label="Stockpile items">
                {campStockpileStacks.length === 0 ? (
                  <p className="hud-empty-note">Empty</p>
                ) : (
                  campStockpileStacks.map((entry) => (
                    <button
                      key={entry.key}
                      type="button"
                      role="option"
                      aria-selected={selectedStockpileItemId === entry.itemId}
                      className={`inventory-slot ${selectedStockpileItemId === entry.itemId ? 'selected' : ''}`}
                      onClick={() => setSelectedStockpileItemId(entry.itemId)}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        const { clientX, clientY } = event;
                        const { itemId } = entry;
                        queueMicrotask(() => {
                          setSelectedStockpileItemId(itemId);
                          setItemContextMenu({
                            source: 'stockpile',
                            itemId,
                            x: clientX,
                            y: clientY,
                          });
                        });
                      }}
                      title={entry.name}
                    >
                      {entry.spriteStyle ? (
                        <span className="slot-sprite" style={entry.spriteStyle} aria-hidden="true" />
                      ) : null}
                      <span className="slot-name">{entry.name}</span>
                      <span className="slot-qty">×{entry.quantity}</span>
                    </button>
                  ))
                )}
              </div>
              {selectedStockpileEntry ? (
                <div className="hud-item-actions">
                  <p className="hud-item-name">{selectedStockpileEntry.name} ×{selectedStockpileEntry.quantity}</p>
                  <p className="hud-empty-note">Right-click an item to open actions.</p>
                </div>
              ) : null}

              {/* Drying rack */}
              {campDryingRackSlots.length > 0 ? (
                <>
                  <h4>Drying Rack</h4>
                  {campDryingRackSlots.map((slot, idx) => (
                    <div key={`rack-${idx}`} className="hud-rack-row">
                      <span>{slot?.itemId || 'empty'} ×{Number(slot?.quantity) || 0}</span>
                      <button type="button" onClick={() => onDryingRackRemove(idx)}>Remove</button>
                    </div>
                  ))}
                </>
              ) : null}
            </>
          ) : null}

          {/* World items on selected tile */}
          {selectedTileWorldItems.length > 0 ? (
            <>
              <h4>On Ground</h4>
              <div className="inventory-grid" role="listbox" aria-label="Ground items">
                {selectedTileWorldItems.map((entry) => (
                  <button
                    key={entry.key}
                    type="button"
                    role="option"
                    aria-selected={selectedWorldItemId === entry.itemId}
                    className={`inventory-slot ${selectedWorldItemId === entry.itemId ? 'selected' : ''}`}
                    onClick={() => setSelectedWorldItemId(entry.itemId)}
                    title={entry.name}
                  >
                    {entry.spriteStyle ? (
                      <span className="slot-sprite" style={entry.spriteStyle} aria-hidden="true" />
                    ) : null}
                    <span className="slot-name">{entry.name}</span>
                    <span className="slot-qty">×{entry.quantity}</span>
                  </button>
                ))}
              </div>
              <div className="hud-item-btns">
                <button type="button" onClick={() => onRunQuickAction('item_pickup')}>Pick Up</button>
              </div>
            </>
          ) : null}
        </aside>
      ) : null}
      {!isDebriefActive && itemContextMenu
        ? createPortal(
          <div
            className="iso-context-menu hud-item-context-menu"
            style={{ left: `${itemContextMenu.x}px`, top: `${itemContextMenu.y}px` }}
            onPointerDown={(event) => event.stopPropagation()}
            role="menu"
          >
            {activeItemContextEntries.length === 0 ? (
              <p className="iso-context-menu-empty">No available actions</p>
            ) : (
              activeItemContextEntries.map((entry) => (
                <button
                  key={`${itemContextMenu.source}-${entry.kind}`}
                  type="button"
                  className="iso-context-menu-action"
                  onClick={() => {
                    onRunQuickAction(entry.kind, entry.payload);
                    setItemContextMenu(null);
                  }}
                >
                  {entry.label}
                </button>
              ))
            )}
          </div>,
          document.body,
        )
        : null}

      {/* ── Nightly debrief (full-screen) ── */}
      {isDebriefActive ? (
        <div className="debrief-overlay" role="dialog" aria-label="Nightly debrief">
          <div className="debrief-container">
            <div className="debrief-header">
              <h2>Nightly Debrief — {calendarLabel}</h2>
              <div className="debrief-tab-bar" role="tablist" aria-label="Debrief tabs">
                {['summary', 'queue', 'meal', 'vision'].map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={selectedDebriefTab === tab}
                    className={`debrief-tab ${selectedDebriefTab === tab ? 'active' : ''}`}
                    onClick={() => onSelectDebriefTab(tab)}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>
              <div className="debrief-begin-row">
                {!hasVisitedMealTab ? (
                  <span className="debrief-gate-note">Review tonight's stew first (Meal tab)</span>
                ) : null}
                <button
                  type="button"
                  className="debrief-begin-btn"
                  onClick={onBeginDay}
                  disabled={!canBeginDay}
                >
                  Begin Day
                </button>
              </div>
            </div>

            <div className="debrief-body">
              {/* Summary tab */}
              {selectedDebriefTab === 'summary' ? (
                <div className="debrief-tab-content">
                  <h3>Family Status</h3>
                  {familyVitalGroups.map((group) => (
                    <div key={`ds-${group.actorId}`} className="debrief-vitals-group">
                      <p className="debrief-actor-label"><strong>{group.label}</strong></p>
                      {group.rows.map((row) => (
                        <div key={`dsr-${group.actorId}-${row.key}`} className="debrief-vital-row">
                          <span className="debrief-vital-label">{row.label}</span>
                          <div className="hud-vital-track" role="meter" aria-valuenow={row.percent}>
                            <span className={`hud-vital-fill hud-vital-fill-${row.severity}`} style={{ width: `${row.percent}%` }} />
                          </div>
                          <span className={`debrief-vital-pct debrief-vital-pct-${row.severity}`}>{row.percent}%</span>
                        </div>
                      ))}
                    </div>
                  ))}
                  {debriefSpoilageEntries.length > 0 ? (
                    <>
                      <h3>Spoilage Risk</h3>
                      {debriefSpoilageEntries.slice(0, 8).map((entry) => (
                        <p key={`spoil-${entry.key}`} className="debrief-note">
                          ⚠ {entry.name} ×{entry.quantity} — {entry.decayDaysRemaining.toFixed(1)} day(s) left
                        </p>
                      ))}
                    </>
                  ) : null}
                  {medicineNotifications.length > 0 ? (
                    <>
                      <h3>Notes</h3>
                      {medicineNotifications.map((entry) => (
                        <p key={`${entry.conditionInstanceId}:${entry.itemId}`} className="debrief-note">{entry.message}</p>
                      ))}
                    </>
                  ) : null}
                </div>
              ) : null}

              {/* Queue tab */}
              {selectedDebriefTab === 'queue' ? (
                <div className="debrief-tab-content">
                  <h3>Partner Task Queue</h3>
                  {queueActiveTask ? (
                    <p className="debrief-note">
                      <strong>Active:</strong> {queueActiveTask.kind || queueActiveTask.taskId || 'task'} — {Number(queueActiveTask.ticksRemaining) || 0}/{Number(queueActiveTask.ticksRequired) || 0} ticks remaining
                    </p>
                  ) : (
                    <p className="debrief-note">No active task.</p>
                  )}
                  {queuePendingTasks.length > 0 ? (
                    <>
                      <p className="debrief-note">Queued ({queuePendingTasks.length}):</p>
                      {queuePendingTasks.slice(0, 5).map((task, idx) => (
                        <p key={`qt-${task.taskId || idx}`} className="debrief-note">
                          #{idx + 1} {task.kind || task.taskId || 'task'} ({Number(task.ticksRequired) || 0} ticks)
                        </p>
                      ))}
                    </>
                  ) : null}
                  <button type="button" onClick={() => onRunQuickAction('partner_task_set')}>+ Add Task</button>
                  {partnerTaskHistory.length > 0 ? (
                    <p className="debrief-note">Completed today: {partnerTaskHistory.length} task(s)</p>
                  ) : null}
                </div>
              ) : null}

              {/* Meal tab */}
              {selectedDebriefTab === 'meal' ? (
                <div className="debrief-tab-content">
                  <h3>Tonight's Stew</h3>
                  {mealPlanIngredients.length === 0 ? (
                    <p className="debrief-note">No ingredients set.</p>
                  ) : (
                    mealPlanIngredients.slice(0, 6).map((entry, idx) => (
                      <p key={`mi-${idx}`} className="debrief-note">
                        {entry.itemId || 'item'} ×{Number(entry.quantity) || 0}
                      </p>
                    ))
                  )}
                  {mealPlanPreview ? (
                    <div className="debrief-meal-preview">
                      <p>Calories: {Math.round(Number(mealPlanPreview.totalCalories) || 0)}</p>
                      <p>Next-day tick bonus: +{Math.max(0, Number(mealPlanPreview.nextDayTickBonus) || 0)}</p>
                    </div>
                  ) : null}
                  {lastMealResult ? (
                    <p className="debrief-note">Last meal: {Math.round(Number(lastMealResult.totalCalories) || 0)} cal on day {Number(lastMealResult.committedAtDay) || 0}</p>
                  ) : null}
                  <div className="hud-item-btns">
                    <button type="button" onClick={() => onRunQuickAction('meal_plan_set')}>Set Ingredient</button>
                    <button type="button" onClick={() => onRunQuickAction('meal_plan_commit')}>Commit Stew</button>
                  </div>
                </div>
              ) : null}

              {/* Vision tab */}
              {selectedDebriefTab === 'vision' ? (
                <div className="debrief-tab-content">
                  <h3>Vision</h3>
                  <p className="debrief-note">Season uses: {visionUsesThisSeason} / 2</p>
                  <button
                    type="button"
                    onClick={() => onRunQuickAction('partner_vision_request')}
                    disabled={!isDebriefActive || visionUsesThisSeason >= 2}
                  >
                    Request Vision
                  </button>
                  {visionSelectionOptions.length > 0 ? (
                    <div className="debrief-select-row">
                      <label htmlFor="vision-confirm-item">Confirm Item</label>
                      <select
                        id="vision-confirm-item"
                        value={selectedVisionItemId}
                        onChange={(e) => setSelectedVisionItemId(e.target.value)}
                      >
                        <option value="">(pick item)</option>
                        {visionSelectionOptions.map((entry) => (
                          <option key={`vo-${entry.itemId}`} value={entry.itemId}>
                            {entry.itemId} ×{entry.quantity}
                          </option>
                        ))}
                      </select>
                      <button type="button" onClick={() => onRunQuickAction('partner_vision_confirm')}>Confirm</button>
                    </div>
                  ) : null}
                  {pendingVisionChoices.length > 0 ? (
                    <div className="debrief-select-row">
                      <label htmlFor="vision-category-choice">Vision Reward</label>
                      <select
                        id="vision-category-choice"
                        value={selectedVisionCategory}
                        onChange={(e) => setSelectedVisionCategory(e.target.value)}
                      >
                        <option value="">(pick category)</option>
                        {pendingVisionChoices.map((entry) => (
                          <option key={`vc-${entry.category}`} value={entry.category}>
                            {entry.category}: {entry.rewardLabel || entry.rewardId}
                          </option>
                        ))}
                      </select>
                      <button type="button" onClick={() => onRunQuickAction('partner_vision_choose')}>Choose</button>
                    </div>
                  ) : null}
                  <div className="debrief-select-row">
                    <label htmlFor="nature-overlay-choice">Nature Sight Overlay</label>
                    <select
                      id="nature-overlay-choice"
                      value={selectedNatureOverlay}
                      onChange={(e) => setSelectedNatureOverlay(e.target.value)}
                    >
                      {natureSightOverlayOptions.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                    <button type="button" onClick={() => onRunQuickAction('nature_sight_overlay_set')}>Apply</button>
                  </div>
                  {visionNotifications.map((entry) => (
                    <p key={`vn-${entry.itemId}-${entry.partName}`} className="debrief-note">{entry.message}</p>
                  ))}
                  {visionRequest ? (
                    <div className="debrief-request-card">
                      <p><strong>Plant:</strong> {visionRequest.plantName || visionRequest.speciesId}</p>
                      <p><strong>Part:</strong> {visionRequest.partLabel || visionRequest.partName} ({visionRequest.subStageLabel || visionRequest.subStageId})</p>
                      <p><strong>Qty:</strong> {visionRequest.quantity}</p>
                      <p>{visionRequest.message}</p>
                    </div>
                  ) : null}
                  {chosenVisionRewards.length > 0 ? (
                    <>
                      <h3>Chosen Rewards</h3>
                      {chosenVisionRewards.map((reward, idx) => (
                        <p key={`cvr-${reward.category || 'reward'}-${idx}`} className="debrief-note">
                          {reward.category || 'reward'}: {reward.rewardLabel || reward.rewardId || 'applied'}
                        </p>
                      ))}
                    </>
                  ) : null}

                  {/* Medicine requests live in vision tab */}
                  {medicineRequests.length > 0 ? (
                    <>
                      <h3>Medicine Requests</h3>
                      {medicineRequests.map((request) => (
                        <div key={request.conditionInstanceId || `${request.actorId}:${request.conditionId}`} className="debrief-request-card">
                          <p><strong>Plant:</strong> {request.plantName || request.speciesId}</p>
                          <p><strong>Part:</strong> {request.partLabel || request.partName} ({request.subStageLabel || request.subStageId})</p>
                          <p><strong>Qty:</strong> {request.quantity}</p>
                          <p><strong>For:</strong> {request.actorLabel} — {request.conditionLabel}</p>
                          <div className="hud-item-btns">
                            <button type="button" onClick={() => onFocusConditionInstance(request.conditionInstanceId)}>Focus</button>
                            <button type="button" onClick={() => onAdministerCondition(request.conditionInstanceId)} disabled={!isDebriefActive}>Administer</button>
                          </div>
                        </div>
                      ))}
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default GameModeChrome;
