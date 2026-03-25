import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import GameModeChrome from './GameModeChrome.jsx';

function renderIntoContainer(element) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  act(() => {
    ReactDOM.render(element, container);
  });
  return container;
}

function cleanupContainer(container) {
  if (!container) {
    return;
  }
  act(() => {
    ReactDOM.unmountComponentAtNode(container);
  });
  container.remove();
}

function makeProps(overrides = {}) {
  return {
    onSwitchToDebug: jest.fn(),
    onNewGameFromSettings: jest.fn(),
    showAnchorDebug: false,
    onToggleAnchorDebug: jest.fn(),
    metrics: { year: 1, dayOfYear: 12 },
    gameState: { dayTick: 120, camp: { anchorX: 10, anchorY: 10 } },
    playerActor: { x: 10, y: 10 },
    playerAtCamp: true,
    playerNatureSightDays: 0,
    dayProgressPercent: 30,
    nightThresholdPercent: 50,
    dayTick: 120,
    ticksPerDay: 400,
    calendarLabel: 'Summer · Day 12 · Epoch 1',
    playerTickBudgetCurrent: 150,
    playerTickBudgetBase: 200,
    playerOverdraftTicks: 0,
    hasTickOverdraft: false,
    familyVitalGroups: [
      {
        actorId: 'player',
        label: 'Player',
        rows: [
          { key: 'hunger', label: 'Hunger', severity: 'good', percent: 90 },
          { key: 'thirst', label: 'Thirst', severity: 'good', percent: 88 },
          { key: 'health', label: 'Health', severity: 'good', percent: 96 },
        ],
      },
    ],
    warningEntries: [],
    onAcknowledgeWarning: jest.fn(),
    selectedTileX: 10,
    selectedTileY: 10,
    selectedTileEntity: { waterType: null, plantIds: [] },
    selectedTileWorldItems: [],
    tilePanelMode: 'context',
    onSetTilePanelMode: jest.fn(),
    selectedInspectData: null,
    contextActionEntries: [{ kind: 'inspect', tickCost: 1, enabled: true, reason: '' }],
    onRunQuickAction: jest.fn(),
    isInventoryPanelOpen: true,
    isPauseMenuOpen: false,
    onClosePauseMenu: jest.fn(),
    actionComposerStatus: '',
    playActionFeed: [],
    playerCarryWeightKg: 1.2,
    playerCarryCapacityKg: 15,
    selectedInventoryItemId: '',
    setSelectedInventoryItemId: jest.fn(),
    playerInventoryStacks: [],
    selectedStockpileItemId: '',
    setSelectedStockpileItemId: jest.fn(),
    campStockpileStacks: [],
    playerEquipment: { gloves: null, coat: null, head: null },
    equipmentSlots: ['gloves', 'coat', 'head'],
    onUnequipSlot: jest.fn(),
    campDryingRackSlots: [],
    onDryingRackRemove: jest.fn(),
    selectedWorldItemId: '',
    setSelectedWorldItemId: jest.fn(),
    isDebriefActive: false,
    onEndDayEnterDebrief: jest.fn(),
    selectedDebriefTab: null,
    onSelectDebriefTab: jest.fn(),
    canBeginDay: false,
    hasVisitedMealTab: false,
    debriefSpoilageEntries: [],
    queueActiveTask: null,
    queuePendingTasks: [],
    partnerTaskHistory: [],
    mealPlanIngredients: [],
    mealPlanPreview: null,
    lastMealResult: null,
    chosenVisionRewards: [],
    onBeginDay: jest.fn(),
    visionUsesThisSeason: 0,
    visionSelectionOptions: [],
    selectedVisionItemId: '',
    setSelectedVisionItemId: jest.fn(),
    pendingVisionChoices: [],
    selectedVisionCategory: '',
    setSelectedVisionCategory: jest.fn(),
    selectedNatureOverlay: 'calorie_heatmap',
    setSelectedNatureOverlay: jest.fn(),
    natureSightOverlayOptions: ['calorie_heatmap'],
    visionNotifications: [],
    visionRequest: null,
    medicineNotifications: [],
    medicineRequests: [],
    onFocusConditionInstance: jest.fn(),
    onAdministerCondition: jest.fn(),
    ...overrides,
  };
}

describe('GameModeChrome UI flows', () => {
  it('disables End Day when player is not at camp', () => {
    const container = renderIntoContainer(<GameModeChrome {...makeProps({ playerAtCamp: false })} />);
    try {
      const endDayButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'End Day');
      expect(endDayButton).toBeTruthy();
      expect(endDayButton.disabled).toBe(true);
    } finally {
      cleanupContainer(container);
    }
  });

  it('shows only debrief shell panels when debrief is active', () => {
    const container = renderIntoContainer(<GameModeChrome {...makeProps({ isDebriefActive: true, selectedDebriefTab: 'summary' })} />);
    try {
      const tilePanel = container.querySelector('.forage-interaction-panel');
      const inventoryPanel = container.querySelector('.forage-inventory-panel');
      const debriefPanel = container.querySelector('.debrief-medicine-panel');
      expect(tilePanel).toBeNull();
      expect(inventoryPanel).toBeNull();
      expect(debriefPanel).toBeTruthy();
    } finally {
      cleanupContainer(container);
    }
  });

  it('keeps Begin Day disabled until meal tab was visited', () => {
    const container = renderIntoContainer(
      <GameModeChrome
        {...makeProps({
          isDebriefActive: true,
          selectedDebriefTab: 'summary',
          canBeginDay: false,
          hasVisitedMealTab: false,
        })}
      />,
    );
    try {
      const beginDayButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Begin Day');
      expect(beginDayButton).toBeTruthy();
      expect(beginDayButton.disabled).toBe(true);
    } finally {
      cleanupContainer(container);
    }
  });

  it('fires tab-change handler when selecting debrief tabs', () => {
    const onSelectDebriefTab = jest.fn();
    const container = renderIntoContainer(
      <GameModeChrome
        {...makeProps({
          isDebriefActive: true,
          selectedDebriefTab: 'summary',
          onSelectDebriefTab,
        })}
      />,
    );
    try {
      const mealTabButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Meal');
      expect(mealTabButton).toBeTruthy();
      act(() => {
        mealTabButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      expect(onSelectDebriefTab).toHaveBeenCalledWith('meal');
    } finally {
      cleanupContainer(container);
    }
  });

  it('fires End Day handler when button is enabled', () => {
    const onEndDayEnterDebrief = jest.fn();
    const container = renderIntoContainer(
      <GameModeChrome
        {...makeProps({
          playerAtCamp: true,
          isDebriefActive: false,
          onEndDayEnterDebrief,
        })}
      />,
    );
    try {
      const endDayButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'End Day');
      expect(endDayButton).toBeTruthy();
      act(() => {
        endDayButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      expect(onEndDayEnterDebrief).toHaveBeenCalledTimes(1);
    } finally {
      cleanupContainer(container);
    }
  });

  it('shows and acknowledges status warnings', () => {
    const onAcknowledgeWarning = jest.fn();
    const container = renderIntoContainer(
      <GameModeChrome
        {...makeProps({
          warningEntries: [
            { id: 'nightfall', severity: 'warning', title: 'Night Is Falling', message: 'Return to camp.' },
          ],
          onAcknowledgeWarning,
        })}
      />,
    );
    try {
      expect(container.textContent).toContain('Night Is Falling');
      const acknowledgeButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Acknowledge');
      expect(acknowledgeButton).toBeTruthy();
      act(() => {
        acknowledgeButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      expect(onAcknowledgeWarning).toHaveBeenCalledWith('nightfall');
    } finally {
      cleanupContainer(container);
    }
  });

  it('formats tiny carry weight in grams', () => {
    const container = renderIntoContainer(
      <GameModeChrome
        {...makeProps({
          playerCarryWeightKg: 0.001,
          playerCarryCapacityKg: 0.015,
          playerInventoryStacks: [
            {
              key: 'earthworm-0',
              itemId: 'earthworm',
              name: 'Earthworm',
              quantity: 1,
              unitWeightKg: 0.001,
              totalWeightKg: 0.001,
              decayDays: 1,
            },
          ],
        })}
      />,
    );
    try {
      expect(container.textContent).toContain('Carry weight: 1g / 15g');
      expect(container.textContent).toContain('Earthworm x1 (1g)');
    } finally {
      cleanupContainer(container);
    }
  });

  it('toggles anchor debug from top controls', () => {
    const onToggleAnchorDebug = jest.fn();
    const container = renderIntoContainer(
      <GameModeChrome
        {...makeProps({
          showAnchorDebug: false,
          onToggleAnchorDebug,
        })}
      />,
    );
    try {
      const toggleButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent.includes('Anchor Debug'));
      expect(toggleButton).toBeTruthy();
      act(() => {
        toggleButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      expect(onToggleAnchorDebug).toHaveBeenCalledTimes(1);
    } finally {
      cleanupContainer(container);
    }
  });
});
