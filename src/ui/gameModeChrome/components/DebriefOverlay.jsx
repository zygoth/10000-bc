import { getTechForestEntrySurface } from '../TechForestDisplayLogic.js';
import MealPlanningPanel from './MealPlanningPanel.jsx';

export default function DebriefOverlay({
  isDebriefActive,
  calendarLabel,
  selectedDebriefTab,
  onSelectDebriefTab,
  hasVisitedMealTab,
  onBeginDay,
  canBeginDay,
  familyVitalGroups,
  debriefSpoilageEntries,
  medicineNotifications,
  queueActiveTask,
  queuePendingTasks,
  partnerTaskHistory,
  onRunQuickAction,
  onOpenTechForest,
  mealPlanIngredients,
  mealPlanPreview,
  mealCandidatesInventoryEntries,
  mealCandidatesStockpileEntries,
  onMealAddFromStockpile,
  onMealAddFromInventory,
  onMealRemoveIngredient,
  onMealCommit,
  lastMealResult,
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
  chosenVisionRewards,
  medicineRequests,
  onFocusConditionInstance,
  onAdministerCondition,
}) {
  if (!isDebriefActive) {
    return null;
  }

  const techForest = getTechForestEntrySurface({
    isDebriefActive,
    debriefSelectedTab: selectedDebriefTab,
  });

  return (
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
              <span className="debrief-gate-note">Review tonight&apos;s stew first (Meal tab)</span>
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
              {techForest.showInDebriefQueueTab && typeof onOpenTechForest === 'function' ? (
                <button type="button" className="debrief-tech-forest-btn" onClick={onOpenTechForest}>
                  View Tech Forest
                </button>
              ) : null}
              {partnerTaskHistory.length > 0 ? (
                <p className="debrief-note">Completed today: {partnerTaskHistory.length} task(s)</p>
              ) : null}
            </div>
          ) : null}

          {selectedDebriefTab === 'meal' ? (
            <div className="debrief-tab-content">
              <h3>Tonight&apos;s Stew</h3>
              <MealPlanningPanel
                inventoryEntries={mealCandidatesInventoryEntries}
                stockpileEntries={mealCandidatesStockpileEntries}
                mealPlanIngredients={mealPlanIngredients}
                mealPlanPreview={mealPlanPreview}
                onAddIngredientFromStockpile={onMealAddFromStockpile}
                onAddIngredientFromInventory={onMealAddFromInventory}
                onRemoveIngredient={onMealRemoveIngredient}
              />
              {lastMealResult ? (
                <p className="debrief-note">Last meal: {Math.round(Number(lastMealResult.totalCalories) || 0)} cal on day {Number(lastMealResult.committedAtDay) || 0}</p>
              ) : null}
            </div>
          ) : null}

          {selectedDebriefTab === 'vision' ? (
            <div className="debrief-tab-content">
              <h3>Vision</h3>
              <p className="debrief-note">Season uses: {visionUsesThisSeason} / 2</p>
              <button
                type="button"
                onClick={() => onRunQuickAction('partner_vision_request')}
                disabled={visionUsesThisSeason >= 2}
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
                        <button type="button" onClick={() => onAdministerCondition(request.conditionInstanceId)}>Administer</button>
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
  );
}

