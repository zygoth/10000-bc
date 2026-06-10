import { useEffect, useMemo, useState } from 'react';
import { buildInventoryGridItemTooltipTitle } from '../../../game/inventorySlotDecayDryness.mjs';
import { MODAL_INVENTORY_SLOT_PX } from '../../inventorySlotSpriteFill/hudInventorySlotWidthPx.mjs';
import InventorySlotSpriteStack from '../../inventorySlotSpriteFill/InventorySlotSpriteStack.jsx';
import DryingRackGrid from './DryingRackGrid.jsx';

const INV_STACK_DRAG_MIME = 'application/x-10000bc-inventory-stack';

function getStackFootprint(stack) {
  const w = Number.isInteger(stack?.footprintW) ? stack.footprintW : 1;
  const h = Number.isInteger(stack?.footprintH) ? stack.footprintH : 1;
  return { w: Math.max(1, w), h: Math.max(1, h) };
}

function findStackAtCell(stacks, x, y) {
  if (!Array.isArray(stacks)) {
    return null;
  }
  for (let i = 0; i < stacks.length; i += 1) {
    const s = stacks[i];
    if (!s || (Number(s.quantity) || 0) <= 0) {
      continue;
    }
    const sx = Number.isInteger(s.slotX) ? s.slotX : null;
    const sy = Number.isInteger(s.slotY) ? s.slotY : null;
    if (sx === null || sy === null) {
      continue;
    }
    const { w, h } = getStackFootprint(s);
    if (x >= sx && x < sx + w && y >= sy && y < sy + h) {
      return { stack: s, stackIndex: i };
    }
  }
  return null;
}

function gridEntryTooltip(entry, formatWeightLabel) {
  return buildInventoryGridItemTooltipTitle({
    name: entry.name,
    totalWeightKg: entry.totalWeightKg,
    formatWeightLabel,
    decayDays: entry.decayDays ?? null,
    decayDaysRemaining: entry.decayDaysRemaining ?? null,
    drynessPercent: entry.drynessPercent ?? null,
    isFullyDried: entry.isFullyDried === true,
    canDry: entry.canDry === true,
  });
}

function gridEntryAriaLabel(entry, formatWeightLabel) {
  const bits = [
    `${entry.name}`,
    `×${entry.quantity}`,
    formatWeightLabel(entry.totalWeightKg ?? 0),
  ];
  if (Number.isFinite(entry.decayDaysRemaining)) {
    bits.push(`decays in about ${Number(entry.decayDaysRemaining).toFixed(1)} days`);
  }
  if (entry.isFullyDried) {
    bits.push('fully dry');
  } else if (entry.canDry || (entry.drynessPercent != null && Number.isFinite(entry.drynessPercent))) {
    bits.push(`${Math.round(Number(entry.drynessPercent) || 0)} percent dry`);
  }
  return bits.join(', ');
}

/** Matches Summary-tab spoilage list: fully spoils before next debrief window. */
const SPOIL_BEFORE_NEXT_DEBRIEF_DAYS = 1.5;

function sortStockpileEntriesForDebrief(entries, mode) {
  const list = [...entries];
  if (mode === 'weight') {
    list.sort((a, b) => (b.totalWeightKg || 0) - (a.totalWeightKg || 0) || a.name.localeCompare(b.name));
    return list;
  }
  if (mode === 'category') {
    list.sort((a, b) => (a.category || '').localeCompare(b.category || '') || a.name.localeCompare(b.name));
    return list;
  }
  list.sort((a, b) => {
    const ar = Number.isFinite(a.decayDaysRemaining) ? a.decayDaysRemaining : 999;
    const br = Number.isFinite(b.decayDaysRemaining) ? b.decayDaysRemaining : 999;
    if (ar !== br) {
      return ar - br;
    }
    return a.name.localeCompare(b.name);
  });
  return list;
}

/** @typedef {'inventory' | 'stockpile' | 'dryingRack' | 'ground' | 'sled'} InventoryTabId */

export default function InventoryPanel({
  gameState = undefined,
  isDebriefActive,
  isOpen,
  carryWeightSeverity,
  playerCarryWeightKg,
  playerCarryCapacityKg,
  formatWeightLabel,
  playerInventoryEntries,
  playerInventoryForGrid,
  selectedInventoryStackIndex,
  setSelectedInventoryStackIndex,
  onOpenContextMenu,
  selectedInventoryEntry,
  equipmentSlots,
  playerEquipment,
  onUnequipSlot,
  playerAtCamp,
  campHasDryingRackStation = false,
  campStockpileStacks,
  selectedStockpileItemId,
  setSelectedStockpileItemId,
  selectedStockpileEntry,
  campDryingRackSlots,
  onDryingRackRemove,
  selectedTileWorldItems,
  selectedWorldItemId,
  setSelectedWorldItemId,
  worldItemPickupDisabled = false,
  worldItemPickupDisabledReason = null,
  stockpileWithdrawDisabled = false,
  stockpileWithdrawDisabledReason = null,
  sledPanelVisible = false,
  sledAttached = false,
  sledPanelSubtitle = '',
  sledStacks = [],
  selectedSledItemId = '',
  setSelectedSledItemId,
  onRunSledQuickAction,
  onRunQuickAction,
  onRequestClose = () => {},
}) {
  const [stockpileSortMode, setStockpileSortMode] = useState('spoilage');
  /** @type {[InventoryTabId, import('react').Dispatch<import('react').SetStateAction<InventoryTabId>>]} */
  const [activeTab, setActiveTab] = useState('inventory');

  useEffect(() => {
    if (!isDebriefActive) {
      setStockpileSortMode('spoilage');
    }
  }, [isDebriefActive]);

  const displayStockpileEntries = useMemo(() => {
    const rows = Array.isArray(campStockpileStacks) ? campStockpileStacks : [];
    if (!isDebriefActive) {
      return rows;
    }
    return sortStockpileEntriesForDebrief(rows, stockpileSortMode);
  }, [campStockpileStacks, isDebriefActive, stockpileSortMode]);

  const tabDefs = useMemo(() => {
    /** @type {{ id: InventoryTabId, label: string }[]} */
    const tabs = [{ id: 'inventory', label: 'Inventory' }];
    if (playerAtCamp) {
      tabs.push({ id: 'stockpile', label: 'Stockpile' });
    }
    if (playerAtCamp && campHasDryingRackStation) {
      tabs.push({ id: 'dryingRack', label: 'Drying rack' });
    }
    if (Array.isArray(selectedTileWorldItems) && selectedTileWorldItems.length > 0) {
      tabs.push({ id: 'ground', label: 'On ground' });
    }
    if (sledPanelVisible) {
      tabs.push({ id: 'sled', label: 'Sled' });
    }
    return tabs;
  }, [playerAtCamp, campHasDryingRackStation, selectedTileWorldItems, sledPanelVisible]);

  useEffect(() => {
    if (!tabDefs.some((t) => t.id === activeTab)) {
      setActiveTab('inventory');
    }
  }, [activeTab, tabDefs]);

  if (!isOpen) {
    return null;
  }

  const gw = Math.max(1, Number(playerInventoryForGrid?.gridWidth) || 6);
  const gh = Math.max(1, Number(playerInventoryForGrid?.gridHeight) || 4);
  const rawStacks = Array.isArray(playerInventoryForGrid?.stacks) ? playerInventoryForGrid.stacks : [];

  const handleInvDrop = (event, cellX, cellY) => {
    event.preventDefault();
    const raw = event.dataTransfer?.getData(INV_STACK_DRAG_MIME);
    let stackIndex = null;
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Number.isInteger(parsed?.stackIndex)) {
          stackIndex = parsed.stackIndex;
        }
      } catch {
        /* ignore */
      }
    }
    if (!Number.isInteger(stackIndex)) {
      return;
    }
    onRunQuickAction('inventory_relocate_stack', {
      stackIndex,
      slotX: cellX,
      slotY: cellY,
    });
  };

  const inventoryGridCells = [];
  for (let gy = 0; gy < gh; gy += 1) {
    for (let gx = 0; gx < gw; gx += 1) {
      const found = findStackAtCell(rawStacks, gx, gy);
      const stack = found?.stack;
      const stackIndex = found?.stackIndex;
      if (stack) {
        const sx = Number.isInteger(stack.slotX) ? stack.slotX : 0;
        const sy = Number.isInteger(stack.slotY) ? stack.slotY : 0;
        if (gx !== sx || gy !== sy) {
          continue;
        }
      }
      const { w, h } = stack ? getStackFootprint(stack) : { w: 1, h: 1 };
      const gridEntry = stack && Number.isInteger(stackIndex)
        ? playerInventoryEntries[stackIndex]
        : null;

      if (!stack || !gridEntry) {
        inventoryGridCells.push(
          <div
            key={`inv-${gx}-${gy}`}
            className="inventory-slot inventory-slot--empty"
            style={{ gridColumn: `${gx + 1} / span 1`, gridRow: `${gy + 1} / span 1` }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleInvDrop(e, gx, gy)}
          />,
        );
        continue;
      }

      const selected = selectedInventoryStackIndex === stackIndex;
      inventoryGridCells.push(
        <button
          key={`inv-${gx}-${gy}-${stackIndex}`}
          type="button"
          role="option"
          draggable
          aria-selected={selected}
          aria-label={gridEntryAriaLabel(gridEntry, formatWeightLabel)}
          className={`inventory-slot inventory-slot--anchor ${selected ? 'selected' : ''}`}
          style={{ gridColumn: `${gx + 1} / span ${w}`, gridRow: `${gy + 1} / span ${h}` }}
          onClick={() => setSelectedInventoryStackIndex(stackIndex)}
          onContextMenu={(event) => {
            event.preventDefault();
            onOpenContextMenu({
              source: 'inventory',
              itemId: gridEntry.itemId,
              inventoryStackIndex: stackIndex,
              x: event.clientX,
              y: event.clientY,
            });
          }}
          onDragStart={(event) => {
            event.dataTransfer.setData(
              INV_STACK_DRAG_MIME,
              JSON.stringify({ stackIndex }),
            );
            event.dataTransfer.effectAllowed = 'move';
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleInvDrop(e, gx, gy)}
          title={gridEntryTooltip(gridEntry, formatWeightLabel)}
        >
          <InventorySlotSpriteStack
            sprite={gridEntry.inventorySprite}
            fallbackLabel={gridEntry.name}
            isFullyDried={gridEntry.isFullyDried === true}
            spoilageProgress={gridEntry.spoilageProgress}
            fixedSlotWidthPx={MODAL_INVENTORY_SLOT_PX}
          />
          <span className="slot-overlay">
            <span className="slot-overlay-text slot-overlay-qty">×{gridEntry.quantity}</span>
            <span className="slot-overlay-text slot-overlay-wt">{formatWeightLabel(gridEntry.totalWeightKg ?? 0)}</span>
          </span>
        </button>,
      );
    }
  }

  const equipmentBar = (
    <aside className="hud-inventory-equipment-bar" aria-label="Equipment">
      <span className="hud-inventory-equipment-bar-label">Equip</span>
      <div className="hud-inventory-equipment-chips">
        {equipmentSlots.map((slot) => {
          const equipped = playerEquipment?.[slot];
          const itemId = equipped?.itemId;
          return (
            <div key={`equip-${slot}`} className="hud-equip-chip">
              <span className="hud-equip-chip-slot" title={slot}>{slot}</span>
              <span className="hud-equip-chip-item" title={itemId || undefined}>
                {itemId || '—'}
              </span>
              {equipped ? (
                <button type="button" className="hud-equip-chip-unequip" onClick={() => onUnequipSlot(slot)} aria-label={`Unequip ${slot}`}>✕</button>
              ) : null}
            </div>
          );
        })}
      </div>
    </aside>
  );

  const showFooter = (
    (activeTab === 'inventory' && selectedInventoryEntry)
    || (activeTab === 'stockpile' && selectedStockpileEntry)
    || (activeTab === 'ground' && selectedTileWorldItems.length > 0)
    || (activeTab === 'sled' && sledPanelVisible)
  );

  return (
    <div
      className="hud-inventory-modal-backdrop"
      onClick={() => onRequestClose()}
      role="presentation"
    >
      <div
        className={`hud-inventory-modal${isDebriefActive ? ' hud-inventory-modal--debrief' : ''}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Inventory"
      >
        <div className="hud-inventory-main">
          <nav className="hud-inventory-tabs hud-inventory-tabs--modal-top" aria-label="Inventory sections">
            {tabDefs.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                className={`hud-inventory-tab${activeTab === id ? ' hud-inventory-tab--active' : ''}`}
                onClick={() => setActiveTab(id)}
              >
                {label}
              </button>
            ))}
          </nav>
          <section className="hud-inventory-tab-content">
            {activeTab === 'inventory' ? (
              <div
                className="inventory-grid hud-inventory-player-grid"
                style={{ '--inv-cols': gw }}
                role="listbox"
                aria-label="Inventory items"
              >
                {inventoryGridCells}
              </div>
            ) : null}

            {activeTab === 'stockpile' && playerAtCamp ? (
              <>
                <h4>Camp stockpile</h4>
                {isDebriefActive ? (
                  <div className="stockpile-sort-bar" role="group" aria-label="Stockpile sort">
                    {[
                      { id: 'spoilage', label: 'Spoilage' },
                      { id: 'weight', label: 'Weight' },
                      { id: 'category', label: 'Category' },
                    ].map(({ id, label }) => (
                      <button
                        key={id}
                        type="button"
                        className={`stockpile-sort-btn${stockpileSortMode === id ? ' stockpile-sort-btn--active' : ''}`}
                        onClick={() => setStockpileSortMode(id)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="inventory-grid" role="listbox" aria-label="Stockpile items">
                  {displayStockpileEntries.length === 0 ? (
                    <p className="hud-empty-note">Empty</p>
                  ) : (
                    displayStockpileEntries.map((entry) => {
                      const spoilageUrgent = Number.isFinite(entry.decayDaysRemaining)
                        && entry.decayDaysRemaining <= SPOIL_BEFORE_NEXT_DEBRIEF_DAYS;
                      return (
                        <button
                          key={entry.key}
                          type="button"
                          role="option"
                          aria-selected={selectedStockpileItemId === entry.itemId}
                          aria-label={gridEntryAriaLabel(entry, formatWeightLabel)}
                          className={`inventory-slot inventory-slot--stockpile ${selectedStockpileItemId === entry.itemId ? 'selected' : ''}`}
                          onClick={() => setSelectedStockpileItemId(entry.itemId)}
                          onContextMenu={(event) => {
                            event.preventDefault();
                            onOpenContextMenu({
                              source: 'stockpile',
                              itemId: entry.itemId,
                              x: event.clientX,
                              y: event.clientY,
                            });
                          }}
                          title={gridEntryTooltip(entry, formatWeightLabel)}
                        >
                          {spoilageUrgent ? (
                            <span
                              className="stockpile-spoil-clock"
                              title="Will hit full spoilage before next debrief"
                              aria-label="Spoilage warning"
                            />
                          ) : null}
                          <InventorySlotSpriteStack
                            sprite={entry.inventorySprite}
                            fallbackLabel={entry.name}
                            isFullyDried={entry.isFullyDried === true}
                            spoilageProgress={entry.spoilageProgress}
                            fixedSlotWidthPx={MODAL_INVENTORY_SLOT_PX}
                          />
                          <span className="slot-overlay">
                            <span className="slot-overlay-text slot-overlay-qty">×{entry.quantity}</span>
                            <span className="slot-overlay-text slot-overlay-wt">{formatWeightLabel(entry.totalWeightKg ?? 0)}</span>
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </>
            ) : null}

            {activeTab === 'dryingRack' && playerAtCamp && campHasDryingRackStation ? (
              <>
                <h4>Drying rack</h4>
                <p className="hud-empty-note" style={{ marginTop: 0, marginBottom: '6px', fontSize: '12px' }}>
                  Right-click the rack tile → Inspect Drying Rack for details.
                </p>
                <DryingRackGrid
                  gameState={gameState}
                  slots={campDryingRackSlots}
                  showEmptyHint
                  onRemoveSlot={onDryingRackRemove}
                />
              </>
            ) : null}

            {activeTab === 'ground' && selectedTileWorldItems.length > 0 ? (
              <>
                <h4>On ground</h4>
                <div className="inventory-grid" role="listbox" aria-label="Ground items">
                  {selectedTileWorldItems.map((entry) => (
                    <button
                      key={entry.key}
                      type="button"
                      role="option"
                      aria-selected={selectedWorldItemId === entry.itemId}
                      aria-label={gridEntryAriaLabel(entry, formatWeightLabel)}
                      className={`inventory-slot ${selectedWorldItemId === entry.itemId ? 'selected' : ''}`}
                      onClick={() => setSelectedWorldItemId(entry.itemId)}
                      title={gridEntryTooltip(entry, formatWeightLabel)}
                    >
                      <InventorySlotSpriteStack
                        sprite={entry.inventorySprite}
                        fallbackLabel={entry.name}
                        isFullyDried={entry.isFullyDried === true}
                        spoilageProgress={entry.spoilageProgress}
                        fixedSlotWidthPx={MODAL_INVENTORY_SLOT_PX}
                      />
                      <span className="slot-overlay">
                        <span className="slot-overlay-text slot-overlay-qty">×{entry.quantity}</span>
                        <span className="slot-overlay-text slot-overlay-wt">{formatWeightLabel(entry.totalWeightKg ?? 0)}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </>
            ) : null}

            {activeTab === 'sled' && sledPanelVisible ? (
              <>
                <h4>Sled {sledAttached ? '(attached)' : ''}</h4>
                {sledPanelSubtitle ? <p className="hud-empty-note">{sledPanelSubtitle}</p> : null}
                <div className="inventory-grid" role="listbox" aria-label="Sled items">
                  {Array.isArray(sledStacks) && sledStacks.length > 0 ? (
                    sledStacks.map((entry) => (
                      <button
                        key={`sled-${entry.itemId}`}
                        type="button"
                        role="option"
                        aria-selected={selectedSledItemId === entry.itemId}
                        className={`inventory-slot ${selectedSledItemId === entry.itemId ? 'selected' : ''}`}
                        onClick={() => setSelectedSledItemId?.(entry.itemId)}
                        title={gridEntryTooltip(entry, formatWeightLabel)}
                      >
                        <InventorySlotSpriteStack
                          sprite={entry.inventorySprite}
                          fallbackLabel={entry.name}
                          isFullyDried={entry.isFullyDried === true}
                          spoilageProgress={entry.spoilageProgress}
                          fixedSlotWidthPx={MODAL_INVENTORY_SLOT_PX}
                        />
                        <span className="slot-overlay">
                          <span className="slot-overlay-text slot-overlay-qty">×{entry.quantity}</span>
                          <span className="slot-overlay-text slot-overlay-wt">{formatWeightLabel(entry.totalWeightKg ?? 0)}</span>
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="hud-empty-note">No items in sled</p>
                  )}
                </div>
              </>
            ) : null}
          </section>
        </div>

        <aside className="hud-inventory-side" aria-label="Inventory actions and filters">
          <div className="hud-inventory-side-header">
            <h3 className="hud-inventory-modal-title">Inventory</h3>
            <button
              type="button"
              className="hud-inventory-modal-close"
              onClick={() => onRequestClose()}
              aria-label="Close inventory"
            >
              ✕
            </button>
          </div>
          <span
            className={`hud-weight-label hud-weight-label--side ${carryWeightSeverity === 'critical' ? 'hud-weight-critical' : carryWeightSeverity === 'warning' ? 'hud-weight-warn' : ''}`}
          >
            <span className="hud-weight-prefix">Carry: </span>
            {formatWeightLabel(playerCarryWeightKg)} / {formatWeightLabel(playerCarryCapacityKg)}
          </span>
          {activeTab === 'inventory' ? equipmentBar : null}
          {showFooter ? (
            <div className="hud-inventory-footer">
              {activeTab === 'inventory' && selectedInventoryEntry ? (
                <div className="hud-item-actions">
                  <p className="hud-item-name">{selectedInventoryEntry.name} ×{selectedInventoryEntry.quantity}</p>
                  <p className="hud-empty-note">Right-click an item to open actions.</p>
                </div>
              ) : null}

              {activeTab === 'stockpile' && selectedStockpileEntry ? (
                <div className="hud-item-actions">
                  <p className="hud-item-name">{selectedStockpileEntry.name} ×{selectedStockpileEntry.quantity}</p>
                  <p className="hud-empty-note">Right-click an item for more actions.</p>
                  <div className="hud-item-btns">
                    <button
                      type="button"
                      disabled={stockpileWithdrawDisabled}
                      title={stockpileWithdrawDisabled && stockpileWithdrawDisabledReason ? stockpileWithdrawDisabledReason : undefined}
                      onClick={() => onRunQuickAction('camp_stockpile_remove')}
                    >
                      Withdraw
                    </button>
                    {stockpileWithdrawDisabled && stockpileWithdrawDisabledReason ? (
                      <p className="hud-empty-note hud-pickup-blocked-note">{stockpileWithdrawDisabledReason}</p>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {activeTab === 'ground' && selectedTileWorldItems.length > 0 ? (
                <div className="hud-item-btns">
                  <button
                    type="button"
                    disabled={worldItemPickupDisabled}
                    title={worldItemPickupDisabled && worldItemPickupDisabledReason ? worldItemPickupDisabledReason : undefined}
                    onClick={() => onRunQuickAction('item_pickup')}
                  >
                    Pick up
                  </button>
                  {worldItemPickupDisabled && worldItemPickupDisabledReason ? (
                    <p className="hud-empty-note hud-pickup-blocked-note">{worldItemPickupDisabledReason}</p>
                  ) : null}
                </div>
              ) : null}

              {activeTab === 'sled' && sledPanelVisible ? (
                <div className="hud-item-btns">
                  <button
                    type="button"
                    onClick={() => onRunSledQuickAction?.('add')}
                    disabled={!selectedInventoryEntry}
                  >
                    Add from inventory
                  </button>
                  <button
                    type="button"
                    onClick={() => onRunSledQuickAction?.('remove')}
                    disabled={!selectedSledItemId}
                  >
                    Take from sled
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
