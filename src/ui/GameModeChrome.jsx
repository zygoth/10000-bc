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
  selectedStockpileItemId,
  setSelectedStockpileItemId,
  campStockpileStacks,
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
    if (!Number.isFinite(numeric)) {
      return '0g';
    }
    if (numeric < 0.1) {
      return `${Math.round(numeric * 1000)}g`;
    }
    return `${numeric.toFixed(2)}kg`;
  };

  return (
    <>
      {isPauseMenuOpen ? (
        <div className="pause-overlay" role="dialog" aria-label="Pause menu">
          <div className="pause-card">
            <h2>Paused</h2>
            <p>Game is paused. Press Esc to close.</p>
            <button type="button" onClick={onClosePauseMenu}>Resume</button>
          </div>
        </div>
      ) : null}
      <div className="game-mode-actions">
        <button
          type="button"
          className="game-mode-toggle"
          onClick={onSwitchToDebug}
        >
          Switch to Debug View
        </button>
        <button
          type="button"
          className="game-mode-toggle"
          onClick={onNewGameFromSettings}
          title="Create a fresh world/camp/player from current seed and map settings"
        >
          New Game (Current Settings)
        </button>
        <button
          type="button"
          className="game-mode-toggle"
          onClick={onToggleAnchorDebug}
          title="Toggle occupant anchor crosshair markers"
        >
          Anchor Debug: {showAnchorDebug ? 'on' : 'off'}
        </button>
      </div>

      <aside className="partner-status-hud" aria-label="Family and day status">
        <h2>Day Status</h2>
        <p className="partner-vital-note">Year {metrics.year}, day {metrics.dayOfYear}, tick {gameState.dayTick}/400</p>
        <p className="partner-vital-note">{calendarLabel}</p>
        <div className="day-progress" role="meter" aria-label="Day progress" aria-valuemin={0} aria-valuemax={ticksPerDay} aria-valuenow={dayTick}>
          <span className="day-progress-fill" style={{ width: `${dayProgressPercent}%` }} />
          <span className="day-progress-threshold" style={{ left: `${nightThresholdPercent}%` }} />
        </div>
        <p className="partner-vital-note">
          Day progress {dayTick}/{ticksPerDay} | Night starts at tick {Math.round((nightThresholdPercent / 100) * ticksPerDay)}
        </p>
        <p className={`partner-vital-note ${hasTickOverdraft ? 'overdraft-note' : ''}`}>
          Player: ({Number(playerActor?.x) || 0}, {Number(playerActor?.y) || 0}) | Budget {playerTickBudgetCurrent}/{playerTickBudgetBase}
          {hasTickOverdraft ? ` | -${Math.max(playerOverdraftTicks, Math.abs(Math.min(0, playerTickBudgetCurrent)))} overdraft` : ''}
        </p>
        <p className="partner-vital-note">
          Camp: ({Number(gameState?.camp?.anchorX) || 0}, {Number(gameState?.camp?.anchorY) || 0}) | At camp: {playerAtCamp ? 'yes' : 'no'}
        </p>
        <p className="partner-vital-note">Nature Sight days active: {playerNatureSightDays}</p>
        {warningEntries.length > 0 ? (
          <div className="status-warning-stack" aria-label="Status warnings">
            {warningEntries.map((entry) => (
              <div key={entry.id} className={`status-warning status-warning-${entry.severity}`}>
                <p><strong>{entry.title}</strong> {entry.message}</p>
                <button type="button" onClick={() => onAcknowledgeWarning(entry.id)}>Acknowledge</button>
              </div>
            ))}
          </div>
        ) : null}
        {familyVitalGroups.map((group) => (
          <div key={`family-${group.actorId}`} className="family-vital-group">
            <h3>{group.label}</h3>
            {group.rows.map((row) => (
              <div key={`${group.actorId}-${row.key}`} className="partner-vital-row">
                <span className="partner-vital-label">{row.label}</span>
                <div className="partner-vital-track" role="meter" aria-label={`${group.label} ${row.label}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={row.percent}>
                  <span
                    className={`partner-vital-fill partner-vital-fill-${row.severity}`}
                    style={{ width: `${row.percent}%` }}
                  />
                </div>
                <span className={`partner-vital-value partner-vital-value-${row.severity}`}>{row.percent}%</span>
              </div>
            ))}
          </div>
        ))}
      </aside>

      {!isDebriefActive ? (
        <aside className="forage-interaction-panel" aria-label="Tile interaction actions">
        <h2>Tile Interaction</h2>
        {selectedTileEntity ? (
          <>
            <p className="play-context-note">
              Tile ({selectedTileX}, {selectedTileY}) {selectedTileEntity.waterType ? `| water: ${selectedTileEntity.waterType}` : '| land'}
            </p>
            <p className="play-context-note">
              Plants: {selectedTileEntity.plantIds?.length || 0} | World items: {selectedTileWorldItems.length}
            </p>
          </>
        ) : (
          <p className="play-context-note">Click a tile to select a target.</p>
        )}
          {tilePanelMode === 'inspect' ? (
          <div className="inspect-panel-lite">
            {selectedInspectData ? (
              <>
                <p className="play-context-note"><strong>Terrain:</strong> {selectedInspectData.terrain}</p>
                <p className="play-context-note"><strong>Plant:</strong> {selectedInspectData.plantLabel}</p>
                <p className="play-context-note"><strong>World items:</strong> {selectedInspectData.worldItemCount}</p>
                <p className="play-context-note"><strong>Trap present:</strong> {selectedInspectData.hasTrap ? 'yes' : 'no'}</p>
                <p className="play-context-note"><strong>Fixture present:</strong> {selectedInspectData.hasCampFixture ? 'yes' : 'no'}</p>
              </>
            ) : (
              <p className="play-context-note">Right-click a nearby tile to inspect.</p>
            )}
          </div>
        ) : (
          <p className="play-context-note">Right-click a tile to open contextual actions; left-click moves.</p>
        )}
          <p className="play-context-note">{actionComposerStatus || 'Select tile and choose contextual action.'}</p>
          {playActionFeed.some((entry) => entry.status === 'interrupted') ? (
            <p className="play-context-note"><strong>Interrupted:</strong> Last action was interrupted and progress was preserved.</p>
          ) : null}
          <h3>Action Feed</h3>
          <div className="play-action-feed">
            {playActionFeed.length === 0 ? (
              <p className="play-context-note">No actions logged yet.</p>
            ) : (
              playActionFeed.map((entry) => (
                <p key={entry.stamp}>
                  <strong>{entry.kind}</strong> [{entry.status}] {entry.message || ''} {entry.code ? `(${entry.code})` : ''}
                </p>
              ))
            )}
          </div>
        </aside>
      ) : null}

      {!isDebriefActive && isInventoryPanelOpen ? (
        <aside className="forage-inventory-panel" aria-label="Inventory and camp actions">
        <h2>Inventory</h2>
        <p className="play-context-note">
          Carry weight: {formatWeightLabel(playerCarryWeightKg)} / {formatWeightLabel(playerCarryCapacityKg)}
        </p>
        <div className="play-composer-row">
          <label htmlFor="inventory-item-select">Focus Item</label>
          <select
            id="inventory-item-select"
            value={selectedInventoryItemId}
            onChange={(event) => setSelectedInventoryItemId(event.target.value)}
          >
            <option value="">(none)</option>
            {playerInventoryStacks.map((entry) => (
              <option
                key={entry.key}
                value={entry.itemId}
                title={`${entry.name} | unit ${formatWeightLabel(entry.unitWeightKg)} | total ${formatWeightLabel(entry.totalWeightKg)}${entry.decayDays !== null ? ` | spoils in ${entry.decayDays} day(s)` : ''}`}
              >
                {entry.name} x{entry.quantity} ({formatWeightLabel(entry.totalWeightKg)})
              </option>
            ))}
          </select>
        </div>
        <div className="play-quick-actions">
          <button type="button" onClick={() => onRunQuickAction('item_drop')}>Drop 1 (selected tile)</button>
          <button type="button" onClick={() => onRunQuickAction('eat')}>Eat 1</button>
          <button type="button" onClick={() => onRunQuickAction('equip_item')}>Equip</button>
          <button type="button" onClick={() => onRunQuickAction('camp_stockpile_add')}>To Stockpile</button>
          <button type="button" onClick={() => onRunQuickAction('camp_drying_rack_add_inventory')}>To Drying Rack</button>
        </div>
        <h3>Equipment</h3>
        {equipmentSlots.map((slot) => (
          <div key={`equip-${slot}`} className="play-utility-row">
            <span>{slot}: {playerEquipment?.[slot]?.itemId || '-'}</span>
            <button type="button" onClick={() => onUnequipSlot(slot)}>
              Unequip
            </button>
          </div>
        ))}

        <h2>Camp Stockpile</h2>
        <div className="play-composer-row">
          <label htmlFor="stockpile-item-select">Focus Item</label>
          <select
            id="stockpile-item-select"
            value={selectedStockpileItemId}
            onChange={(event) => setSelectedStockpileItemId(event.target.value)}
          >
            <option value="">(none)</option>
            {campStockpileStacks.map((entry) => (
              <option key={entry.key} value={entry.itemId} title={`${entry.name} x${entry.quantity}`}>
                {entry.name} x{entry.quantity}
              </option>
            ))}
          </select>
        </div>
        <div className="play-quick-actions">
          <button type="button" onClick={() => onRunQuickAction('camp_stockpile_remove')}>Withdraw 1</button>
          <button type="button" onClick={() => onRunQuickAction('camp_drying_rack_add')}>Rack 1</button>
          <button type="button" onClick={() => onRunQuickAction('meal_plan_set')}>Meal Plan (1 item)</button>
          <button type="button" onClick={() => onRunQuickAction('meal_plan_commit')}>Meal Commit</button>
        </div>
        <h3>Drying Rack</h3>
        {campDryingRackSlots.length === 0 ? (
          <p className="play-context-note">No occupied slots.</p>
        ) : (
          campDryingRackSlots.map((slot, idx) => (
            <div key={`rack-${idx}`} className="play-utility-row">
              <span>#{idx} {slot?.itemId || 'empty'} x{Number(slot?.quantity) || 0}</span>
              <button
                type="button"
                onClick={() => onDryingRackRemove(idx)}
              >
                Remove 1
              </button>
            </div>
          ))
        )}
        <h3>Selected Tile World Items</h3>
        <div className="play-composer-row">
          <select
            value={selectedWorldItemId}
            onChange={(event) => setSelectedWorldItemId(event.target.value)}
          >
            <option value="">(none)</option>
            {selectedTileWorldItems.map((entry) => (
              <option key={entry.key} value={entry.itemId} title={`${entry.name} x${entry.quantity}`}>
                {entry.name} x{entry.quantity}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => onRunQuickAction('item_pickup')}>Pick Up 1</button>
        </div>
        </aside>
      ) : null}

      <aside className="debrief-medicine-panel" aria-label="Nightly debrief medicine">
        <h2>Nightly Debrief</h2>
        <div className="debrief-medicine-controls">
          <button
            type="button"
            onClick={onEndDayEnterDebrief}
            disabled={isDebriefActive || !playerAtCamp}
          >
            End Day
          </button>
          <button
            type="button"
            onClick={onBeginDay}
            disabled={!isDebriefActive || !canBeginDay}
          >
            Begin Day
          </button>
        </div>
        {isDebriefActive ? (
          <>
            <p className="debrief-medicine-note">
              Visit Meal tab once before Begin Day. {hasVisitedMealTab ? 'Meal tab visited.' : 'Meal tab not visited yet.'}
            </p>
            <div className="tile-panel-tabs" role="tablist" aria-label="Debrief tabs">
              <button type="button" className={selectedDebriefTab === 'summary' ? 'active' : ''} onClick={() => onSelectDebriefTab('summary')}>Summary</button>
              <button type="button" className={selectedDebriefTab === 'queue' ? 'active' : ''} onClick={() => onSelectDebriefTab('queue')}>Queue</button>
              <button type="button" className={selectedDebriefTab === 'meal' ? 'active' : ''} onClick={() => onSelectDebriefTab('meal')}>Meal</button>
              <button type="button" className={selectedDebriefTab === 'vision' ? 'active' : ''} onClick={() => onSelectDebriefTab('vision')}>Vision</button>
            </div>
            {selectedDebriefTab === 'summary' ? (
              <>
                {medicineNotifications.length > 0 ? (
                  <div className="debrief-medicine-notifications">
                    <h3>Summary</h3>
                    {medicineNotifications.map((entry) => (
                      <p key={`${entry.conditionInstanceId}:${entry.itemId}`}>{entry.message}</p>
                    ))}
                  </div>
                ) : (
                  <p className="debrief-medicine-empty">No treatments or summary updates logged yet.</p>
                )}
                <h3>Family Vitals</h3>
                {familyVitalGroups.map((group) => (
                  <div key={`summary-vitals-${group.actorId}`}>
                    <p className="debrief-medicine-note"><strong>{group.label}</strong></p>
                    {group.rows.map((row) => (
                      <p key={`summary-${group.actorId}-${row.key}`} className="debrief-medicine-note">{row.label}: {row.percent}%</p>
                    ))}
                  </div>
                ))}
                <h3>Spoilage Risk</h3>
                {debriefSpoilageEntries.length === 0 ? (
                  <p className="debrief-medicine-empty">No near-spoilage stockpile items.</p>
                ) : (
                  debriefSpoilageEntries.slice(0, 8).map((entry) => (
                    <p key={`spoil-${entry.key}`} className="debrief-medicine-note">
                      {entry.name} x{entry.quantity} - {entry.decayDaysRemaining.toFixed(1)} day(s) left
                    </p>
                  ))
                )}
              </>
            ) : null}
            {selectedDebriefTab === 'queue' ? (
              <div className="debrief-medicine-requests">
                <h3>Queue</h3>
                {queueActiveTask ? (
                  <p className="debrief-medicine-note">
                    Active: {queueActiveTask.kind || queueActiveTask.taskId || 'task'} ({Number(queueActiveTask.ticksRemaining) || 0}/{Number(queueActiveTask.ticksRequired) || 0} ticks remaining)
                  </p>
                ) : (
                  <p className="debrief-medicine-note">No active partner task.</p>
                )}
                <p className="debrief-medicine-note">Queued tasks: {queuePendingTasks.length}</p>
                {queuePendingTasks.slice(0, 5).map((task, idx) => (
                  <p key={`queued-${task.taskId || idx}`} className="debrief-medicine-note">
                    #{idx + 1} {task.kind || task.taskId || 'task'} ({Number(task.ticksRequired) || 0} ticks)
                  </p>
                ))}
                <p className="debrief-medicine-note">Recent completed tasks: {partnerTaskHistory.length}</p>
                <button type="button" onClick={() => onRunQuickAction('partner_task_set')}>Add Partner Task</button>
              </div>
            ) : null}
            {selectedDebriefTab === 'meal' ? (
              <div className="debrief-medicine-requests">
                <h3>Meal</h3>
                <p className="debrief-medicine-note">Set a meal plan item, then commit to finalize.</p>
                <p className="debrief-medicine-note">Current ingredients: {mealPlanIngredients.length}</p>
                {mealPlanIngredients.slice(0, 6).map((entry, idx) => (
                  <p key={`meal-ingredient-${idx}`} className="debrief-medicine-note">
                    {entry.itemId || 'item'} x{Number(entry.quantity) || 0}
                  </p>
                ))}
                {mealPlanPreview ? (
                  <p className="debrief-medicine-note">
                    Preview calories: {Math.round(Number(mealPlanPreview.totalCalories) || 0)} | Next-day tick bonus: {Math.max(0, Number(mealPlanPreview.nextDayTickBonus) || 0)}
                  </p>
                ) : null}
                {lastMealResult ? (
                  <p className="debrief-medicine-note">
                    Last meal: {Math.round(Number(lastMealResult.totalCalories) || 0)} calories at day {Number(lastMealResult.committedAtDay) || 0}
                  </p>
                ) : null}
                <div className="play-quick-actions">
                  <button type="button" onClick={() => onRunQuickAction('meal_plan_set')}>Set Meal Item</button>
                  <button type="button" onClick={() => onRunQuickAction('meal_plan_commit')}>Commit Meal</button>
                </div>
              </div>
            ) : null}
            {selectedDebriefTab === 'vision' ? (
              <>
                <div className="debrief-medicine-requests">
                  <h3>Vision Request</h3>
                  <p className="debrief-medicine-note">Season uses: {visionUsesThisSeason} / 2</p>
                  <button
                    type="button"
                    onClick={() => onRunQuickAction('partner_vision_request')}
                    disabled={!isDebriefActive || visionUsesThisSeason >= 2}
                  >
                    Request Vision
                  </button>
                  {visionSelectionOptions.length > 0 ? (
                    <div className="play-composer-row">
                      <label htmlFor="vision-confirm-item">Confirm Item</label>
                      <select
                        id="vision-confirm-item"
                        value={selectedVisionItemId}
                        onChange={(event) => setSelectedVisionItemId(event.target.value)}
                      >
                        <option value="">(pick item)</option>
                        {visionSelectionOptions.map((entry) => (
                          <option key={`vision-opt-${entry.itemId}`} value={entry.itemId}>
                            {entry.itemId} x{entry.quantity}
                          </option>
                        ))}
                      </select>
                      <button type="button" onClick={() => onRunQuickAction('partner_vision_confirm')}>Confirm Vision Item</button>
                    </div>
                  ) : null}
                  {pendingVisionChoices.length > 0 ? (
                    <div className="play-composer-row">
                      <label htmlFor="vision-category-choice">Vision Category</label>
                      <select
                        id="vision-category-choice"
                        value={selectedVisionCategory}
                        onChange={(event) => setSelectedVisionCategory(event.target.value)}
                      >
                        <option value="">(pick category)</option>
                        {pendingVisionChoices.map((entry) => (
                          <option key={`vision-choice-${entry.category}`} value={entry.category}>
                            {entry.category}: {entry.rewardLabel || entry.rewardId}
                          </option>
                        ))}
                      </select>
                      <button type="button" onClick={() => onRunQuickAction('partner_vision_choose')}>Choose Vision Reward</button>
                    </div>
                  ) : null}
                  <div className="play-composer-row">
                    <label htmlFor="nature-overlay-choice">Nature Sight Overlay</label>
                    <select
                      id="nature-overlay-choice"
                      value={selectedNatureOverlay}
                      onChange={(event) => setSelectedNatureOverlay(event.target.value)}
                    >
                      {natureSightOverlayOptions.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                    <button type="button" onClick={() => onRunQuickAction('nature_sight_overlay_set')}>
                      Apply Overlay
                    </button>
                  </div>
                  {visionNotifications.map((entry) => (
                    <p key={`vision-note-${entry.itemId}-${entry.partName}`}>{entry.message}</p>
                  ))}
                  {visionRequest ? (
                    <div className="debrief-medicine-request">
                      <p><strong>Plant:</strong> {visionRequest.plantName || visionRequest.speciesId}</p>
                      <p><strong>Needed Part:</strong> {visionRequest.partLabel || visionRequest.partName} ({visionRequest.subStageLabel || visionRequest.subStageId})</p>
                      <p><strong>Quantity:</strong> {visionRequest.quantity}</p>
                      <p>{visionRequest.message}</p>
                    </div>
                  ) : (
                    <p className="debrief-medicine-empty">No pending vision ingredient request.</p>
                  )}
                  {chosenVisionRewards.length > 0 ? (
                    <div className="debrief-medicine-notifications">
                      <h3>Chosen Vision Rewards</h3>
                      {chosenVisionRewards.map((reward, idx) => (
                        <p key={`chosen-vision-${reward.category || 'reward'}-${idx}`}>
                          {reward.category || 'reward'}: {reward.rewardLabel || reward.rewardId || 'applied'}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="debrief-medicine-requests">
                  <h3>Partner Requests</h3>
                  {medicineRequests.length <= 0 ? (
                    <p className="debrief-medicine-empty">No pending medicine requests.</p>
                  ) : (
                    medicineRequests.map((request) => (
                      <div key={request.conditionInstanceId || `${request.actorId}:${request.conditionId}`} className="debrief-medicine-request">
                        <p><strong>Plant:</strong> {request.plantName || request.speciesId}</p>
                        <p><strong>Needed Part:</strong> {request.partLabel || request.partName} ({request.subStageLabel || request.subStageId})</p>
                        <p><strong>Quantity:</strong> {request.quantity}</p>
                        <p><strong>For:</strong> {request.actorLabel} - {request.conditionLabel}</p>
                        <button
                          type="button"
                          onClick={() => onFocusConditionInstance(request.conditionInstanceId)}
                        >
                          Focus
                        </button>
                        <button
                          type="button"
                          onClick={() => onAdministerCondition(request.conditionInstanceId)}
                          disabled={!isDebriefActive}
                        >
                          Administer Now
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : null}
          </>
        ) : (
          <p className="debrief-medicine-empty">Debrief is inactive. Enter camp and start debrief at night.</p>
        )}
      </aside>
    </>
  );
}

export default GameModeChrome;
