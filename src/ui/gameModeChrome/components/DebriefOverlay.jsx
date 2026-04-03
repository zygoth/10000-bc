import { useMemo } from 'react';
import {
  buildDebriefVisionPanelModel,
  getDebriefVisionTabShowsAlert,
} from '../DebriefVisionDisplayLogic.js';
import { getTechForestEntrySurface } from '../TechForestDisplayLogic.js';
import MealPlanningPanel from './MealPlanningPanel.jsx';
import PartnerTaskQueuePanel from './PartnerTaskQueuePanel.jsx';
import { partnerHistorySummaryLine } from '../../debrief/partnerQueueDisplay.mjs';

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
  queuePendingTasks,
  partnerTaskHistory,
  gameState,
  partnerActor,
  formatTokenLabel,
  validateAction,
  onPartnerTaskAppend,
  onPartnerQueueReorder,
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
  selectedVisionItemId,
  setSelectedVisionItemId,
  selectedVisionCategory,
  setSelectedVisionCategory,
  medicineRequests,
  onFocusConditionInstance,
  onAdministerCondition,
}) {
  const simDay = Number.isInteger(gameState?.totalDaysSimulated) ? gameState.totalDaysSimulated : null;
  const partnerHistoryToday = useMemo(() => {
    if (!isDebriefActive || simDay == null) {
      return [];
    }
    return partnerTaskHistory.filter((e) => Number(e?.day) === simDay);
  }, [isDebriefActive, partnerTaskHistory, simDay]);

  const visionPanel = useMemo(
    () => buildDebriefVisionPanelModel({
      isDebriefActive,
      gameState,
      formatTokenLabel,
    }),
    [isDebriefActive, gameState, formatTokenLabel],
  );

  if (!isDebriefActive) {
    return null;
  }

  const techForest = getTechForestEntrySurface({
    isDebriefActive,
    debriefSelectedTab: selectedDebriefTab,
  });

  const debriefForAlert = gameState?.camp?.debrief && typeof gameState.camp.debrief === 'object'
    ? gameState.camp.debrief
    : null;
  const showVisionTabAlert = getDebriefVisionTabShowsAlert({
    debrief: debriefForAlert,
    selectedDebriefTab,
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
                className={`debrief-tab ${selectedDebriefTab === tab ? 'active' : ''}${
                  tab === 'vision' && showVisionTabAlert ? ' debrief-tab-alert' : ''
                }`}
                onClick={() => onSelectDebriefTab(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {tab === 'vision' && showVisionTabAlert ? (
                  <span className="debrief-tab-alert-dot" aria-hidden />
                ) : null}
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
              <h3>Partner work today</h3>
              {partnerHistoryToday.length > 0 ? (
                <ul className="debrief-partner-history-list debrief-note">
                  {partnerHistoryToday.map((entry, idx) => (
                    <li key={`${entry.taskId || 'task'}-${idx}`}>
                      {partnerHistorySummaryLine(entry, formatTokenLabel)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="debrief-note">No partner tasks completed this day.</p>
              )}
            </div>
          ) : null}

          {selectedDebriefTab === 'queue' ? (
            <div className="debrief-tab-content">
              <h3>Partner Task Queue</h3>
              <PartnerTaskQueuePanel
                gameState={gameState}
                partnerActor={partnerActor}
                queuePendingTasks={queuePendingTasks}
                mealPlanPreview={mealPlanPreview}
                formatTokenLabel={formatTokenLabel}
                validateAction={validateAction}
                onPartnerTaskAppend={onPartnerTaskAppend}
                onPartnerQueueReorder={onPartnerQueueReorder}
                onOpenTechForest={techForest.showInDebriefQueueTab ? onOpenTechForest : undefined}
              />
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

          {selectedDebriefTab === 'vision' && visionPanel.visible ? (
            <div className="debrief-tab-content">
              <h3>Vision</h3>
              <p className="debrief-note">{visionPanel.seasonLine}</p>
              <p className="debrief-note">{visionPanel.helpLine}</p>
              <button
                type="button"
                onClick={() => onRunQuickAction('partner_vision_request')}
                disabled={visionPanel.requestVision.disabled}
              >
                Request Vision
              </button>
              {!visionPanel.requestVision.disabled ? null : visionPanel.requestVision.blockedMessage ? (
                <p className="debrief-note debrief-vision-block-reason">{visionPanel.requestVision.blockedMessage}</p>
              ) : null}
              {visionPanel.confirmItem.show ? (
                <div className="debrief-select-row">
                  <label htmlFor="vision-confirm-item">Confirm Item</label>
                  <select
                    id="vision-confirm-item"
                    value={selectedVisionItemId}
                    onChange={(e) => setSelectedVisionItemId(e.target.value)}
                  >
                    <option value="">(pick item)</option>
                    {visionPanel.confirmItem.options.map((opt) => (
                      <option key={`vo-${opt.value}`} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <button type="button" onClick={() => onRunQuickAction('partner_vision_confirm')}>Confirm</button>
                </div>
              ) : null}
              {visionPanel.rewardChoice.show ? (
                <div className="debrief-select-row">
                  <label htmlFor="vision-category-choice">Vision Reward</label>
                  <select
                    id="vision-category-choice"
                    value={selectedVisionCategory}
                    onChange={(e) => setSelectedVisionCategory(e.target.value)}
                  >
                    <option value="">(pick category)</option>
                    {visionPanel.rewardChoice.options.map((opt) => (
                      <option key={`vc-${opt.value}`} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <button type="button" onClick={() => onRunQuickAction('partner_vision_choose')}>Choose</button>
                </div>
              ) : null}
              {visionPanel.notifications.map((n) => (
                <p key={n.id} className="debrief-note">{n.text}</p>
              ))}
              {visionPanel.partnerRequestCard ? (
                <div className="debrief-request-card">
                  <p><strong>Plant:</strong> {visionPanel.partnerRequestCard.plantName}</p>
                  <p><strong>Part:</strong> {visionPanel.partnerRequestCard.partLine}</p>
                  <p><strong>Qty:</strong> {visionPanel.partnerRequestCard.quantity}</p>
                  <p>{visionPanel.partnerRequestCard.message}</p>
                </div>
              ) : null}
              {visionPanel.chosenRewardsHeading ? (
                <>
                  <h3>Chosen Rewards</h3>
                  {visionPanel.chosenRewardLines.map((line) => (
                    <p key={line.key} className="debrief-note">{line.text}</p>
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

