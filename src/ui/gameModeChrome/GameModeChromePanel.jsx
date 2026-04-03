import { useEffect, useState } from 'react';
import {
  formatWeightLabel,
  getActiveItemContextEntries,
  getCarryWeightSeverity,
  getSelectedStackEntry,
} from './GameModeChromeDisplayLogic.js';
import PauseOverlay from './components/PauseOverlay.jsx';
import HudTopBar from './components/HudTopBar.jsx';
import VitalsStrip from './components/VitalsStrip.jsx';
import WarningsStrip from './components/WarningsStrip.jsx';
import EndDayButton from './components/EndDayButton.jsx';
import InventoryPanel from './components/InventoryPanel.jsx';
import InspectPanel from './components/InspectPanel.jsx';
import ItemContextMenu from './components/ItemContextMenu.jsx';
import DebriefOverlay from './components/DebriefOverlay.jsx';
import TechForestOverlay from './components/TechForestOverlay.jsx';

function GameModeChromePanel({
  onSwitchToDebug,
  onNewGameFromSettings,
  showAnchorDebug,
  onToggleAnchorDebug,
  metrics,
  gameState,
  playerActor,
  partnerActor = null,
  playerAtCamp,
  campHasDryingRackStation = false,
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
  selectedInventoryStackIndex,
  setSelectedInventoryStackIndex,
  playerInventoryEntries,
  playerInventoryForGrid,
  inventoryQuickActionsByStackIndex,
  selectedInventoryEntry,
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
  worldItemPickupDisabled = false,
  worldItemPickupDisabledReason = null,
  stockpileWithdrawDisabled = false,
  stockpileWithdrawDisabledReason = null,
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
  mealCandidatesInventoryEntries,
  mealCandidatesStockpileEntries,
  onMealAddFromStockpile,
  onMealAddFromInventory,
  onMealRemoveIngredient,
  onBeginDay,
  selectedVisionItemId,
  setSelectedVisionItemId,
  selectedVisionCategory,
  setSelectedVisionCategory,
  selectedNatureOverlay,
  setSelectedNatureOverlay,
  natureSightOverlayOptions,
  medicineNotifications,
  medicineRequests,
  onFocusConditionInstance,
  onAdministerCondition,
  techForestOverlayOpen = false,
  onOpenTechForest,
  onCloseTechForest,
  techForest = null,
  techUnlocks = null,
  techUnlockVisionGranted = null,
  techUnlockPartnerResearch = null,
  onQueueTechResearch,
  formatTokenLabel,
  validateAction,
  onPartnerTaskAppend,
  onPartnerQueueReorder,
}) {
  const [itemContextMenu, setItemContextMenu] = useState(null);
  const selectedStockpileEntry = getSelectedStackEntry(campStockpileStacks, selectedStockpileItemId);
  const activeItemContextEntries = getActiveItemContextEntries({
    itemContextMenu,
    inventoryQuickActionsByStackIndex,
    stockpileQuickActionsByItemId,
  });

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

  const carryWeightSeverity = getCarryWeightSeverity({
    currentKg: playerCarryWeightKg,
    capacityKg: playerCarryCapacityKg,
  });

  return (
    <>
      <PauseOverlay
        isOpen={isPauseMenuOpen}
        onClosePauseMenu={onClosePauseMenu}
        onSwitchToDebug={onSwitchToDebug}
        onNewGameFromSettings={onNewGameFromSettings}
        showAnchorDebug={showAnchorDebug}
        onToggleAnchorDebug={onToggleAnchorDebug}
      />

      <HudTopBar
        isDebriefActive={isDebriefActive}
        calendarLabel={calendarLabel}
        dayProgressPercent={dayProgressPercent}
        nightThresholdPercent={nightThresholdPercent}
        dayTick={dayTick}
        ticksPerDay={ticksPerDay}
        hasTickOverdraft={hasTickOverdraft}
        playerTickBudgetBase={playerTickBudgetBase}
        playerTickBudgetCurrent={playerTickBudgetCurrent}
        playerOverdraftTicks={playerOverdraftTicks}
        playerNatureSightDays={playerNatureSightDays}
        onOpenTechForest={onOpenTechForest}
      />

      <VitalsStrip isDebriefActive={isDebriefActive} familyVitalGroups={familyVitalGroups} />

      <WarningsStrip
        isDebriefActive={isDebriefActive}
        warningEntries={warningEntries}
        onAcknowledgeWarning={onAcknowledgeWarning}
        actionComposerStatus={actionComposerStatus}
      />

      <EndDayButton
        isDebriefActive={isDebriefActive}
        playerAtCamp={playerAtCamp}
        onEndDayEnterDebrief={onEndDayEnterDebrief}
      />

      <InspectPanel
        isDebriefActive={isDebriefActive}
        tilePanelMode={tilePanelMode}
        selectedInspectData={selectedInspectData}
        isInventoryPanelOpen={isInventoryPanelOpen}
      />

      <InventoryPanel
        isDebriefActive={isDebriefActive}
        isOpen={isInventoryPanelOpen && !isDebriefActive}
        carryWeightSeverity={carryWeightSeverity}
        playerCarryWeightKg={playerCarryWeightKg}
        playerCarryCapacityKg={playerCarryCapacityKg}
        formatWeightLabel={formatWeightLabel}
        playerInventoryEntries={playerInventoryEntries}
        playerInventoryForGrid={playerInventoryForGrid}
        selectedInventoryStackIndex={selectedInventoryStackIndex}
        setSelectedInventoryStackIndex={setSelectedInventoryStackIndex}
        onOpenContextMenu={({ source, itemId, inventoryStackIndex, x, y }) => {
          queueMicrotask(() => {
            if (source === 'inventory' && Number.isInteger(inventoryStackIndex)) {
              setSelectedInventoryStackIndex(inventoryStackIndex);
            } else if (source === 'stockpile') {
              setSelectedStockpileItemId(itemId);
            }
            setItemContextMenu({
              source,
              itemId,
              inventoryStackIndex,
              x,
              y,
            });
          });
        }}
        selectedInventoryEntry={selectedInventoryEntry}
        equipmentSlots={equipmentSlots}
        playerEquipment={playerEquipment}
        onUnequipSlot={onUnequipSlot}
        playerAtCamp={playerAtCamp}
        campHasDryingRackStation={campHasDryingRackStation}
        campStockpileStacks={campStockpileStacks}
        selectedStockpileItemId={selectedStockpileItemId}
        setSelectedStockpileItemId={setSelectedStockpileItemId}
        selectedStockpileEntry={selectedStockpileEntry}
        campDryingRackSlots={campDryingRackSlots}
        onDryingRackRemove={onDryingRackRemove}
        selectedTileWorldItems={selectedTileWorldItems}
        selectedWorldItemId={selectedWorldItemId}
        setSelectedWorldItemId={setSelectedWorldItemId}
        worldItemPickupDisabled={worldItemPickupDisabled}
        worldItemPickupDisabledReason={worldItemPickupDisabledReason}
        stockpileWithdrawDisabled={stockpileWithdrawDisabled}
        stockpileWithdrawDisabledReason={stockpileWithdrawDisabledReason}
        onRunQuickAction={onRunQuickAction}
      />
      <ItemContextMenu
        isDebriefActive={isDebriefActive}
        itemContextMenu={itemContextMenu}
        activeItemContextEntries={activeItemContextEntries}
        onRunQuickAction={onRunQuickAction}
        onClose={() => setItemContextMenu(null)}
      />

      <DebriefOverlay
        isDebriefActive={isDebriefActive}
        calendarLabel={calendarLabel}
        selectedDebriefTab={selectedDebriefTab}
        onSelectDebriefTab={onSelectDebriefTab}
        hasVisitedMealTab={hasVisitedMealTab}
        onBeginDay={onBeginDay}
        canBeginDay={canBeginDay}
        familyVitalGroups={familyVitalGroups}
        debriefSpoilageEntries={debriefSpoilageEntries}
        medicineNotifications={medicineNotifications}
        queuePendingTasks={queuePendingTasks}
        partnerTaskHistory={partnerTaskHistory}
        gameState={gameState}
        partnerActor={partnerActor}
        formatTokenLabel={formatTokenLabel}
        validateAction={validateAction}
        onPartnerTaskAppend={onPartnerTaskAppend}
        onPartnerQueueReorder={onPartnerQueueReorder}
        onRunQuickAction={onRunQuickAction}
        mealPlanIngredients={mealPlanIngredients}
        mealPlanPreview={mealPlanPreview}
        lastMealResult={lastMealResult}
        mealCandidatesInventoryEntries={mealCandidatesInventoryEntries}
        mealCandidatesStockpileEntries={mealCandidatesStockpileEntries}
        onMealAddFromStockpile={onMealAddFromStockpile}
        onMealAddFromInventory={onMealAddFromInventory}
        onMealRemoveIngredient={onMealRemoveIngredient}
        selectedVisionItemId={selectedVisionItemId}
        setSelectedVisionItemId={setSelectedVisionItemId}
        selectedVisionCategory={selectedVisionCategory}
        setSelectedVisionCategory={setSelectedVisionCategory}
        medicineRequests={medicineRequests}
        onFocusConditionInstance={onFocusConditionInstance}
        onAdministerCondition={onAdministerCondition}
        onOpenTechForest={onOpenTechForest}
      />

      {techForestOverlayOpen && typeof onCloseTechForest === 'function' ? (
        <TechForestOverlay
          techForest={techForest}
          techUnlocks={techUnlocks}
          techUnlockVisionGranted={techUnlockVisionGranted}
          techUnlockPartnerResearch={techUnlockPartnerResearch}
          queueActiveTask={queueActiveTask}
          queuePendingTasks={queuePendingTasks}
          onQueueTechResearch={onQueueTechResearch}
          onClose={onCloseTechForest}
          isDebriefActive={isDebriefActive}
        />
      ) : null}
    </>
  );
}

export default GameModeChromePanel;

