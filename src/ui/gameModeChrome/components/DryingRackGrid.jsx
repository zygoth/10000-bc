import { buildStockpileGridEntry } from '../../../game/inventoryPanelEntries.mjs';
import { buildInventoryGridItemTooltipTitle } from '../../../game/inventorySlotDecayDryness.mjs';
import InventorySlotSpriteStack from '../../inventorySlotSpriteFill/InventorySlotSpriteStack.jsx';
import { formatWeightLabel } from '../GameModeChromeDisplayLogic.js';

function getStackFootprint(stack) {
  const w = Number.isInteger(stack?.footprintW) ? stack.footprintW : 1;
  const h = Number.isInteger(stack?.footprintH) ? stack.footprintH : 1;
  return { w: Math.max(1, w), h: Math.max(1, h) };
}

function findStackAtCell(slots, x, y) {
  if (!Array.isArray(slots)) {
    return null;
  }
  for (let i = 0; i < slots.length; i += 1) {
    const s = slots[i];
    if (!s || (Number(s.quantity) || 0) <= 0) {
      continue;
    }
    const sx = Number.isInteger(s.slotX) ? s.slotX : 0;
    const sy = Number.isInteger(s.slotY) ? s.slotY : 0;
    const { w, h } = getStackFootprint(s);
    if (x >= sx && x < sx + w && y >= sy && y < sy + h) {
      return { stack: s, slotIndex: i };
    }
  }
  return null;
}

/**
 * 2×2 camp drying rack visualization. Optional `highlightCellKeys`: Set of "x,y" for proposed placement cells.
 */
export default function DryingRackGrid({
  slots = [],
  highlightCellKeys = null,
  onRemoveSlot = null,
  caption = null,
  showEmptyHint = true,
  formatWeightLabel: formatWeightLabelProp = formatWeightLabel,
}) {
  const rows = [];
  for (let gy = 0; gy < 2; gy += 1) {
    const row = [];
    for (let gx = 0; gx < 2; gx += 1) {
      const found = findStackAtCell(slots, gx, gy);
      const key = `${gx},${gy}`;
      const highlighted = Boolean(highlightCellKeys && highlightCellKeys.has(key));
      const stack = found?.stack;
      const slotIndex = found?.slotIndex;
      const sx = stack && Number.isInteger(stack.slotX) ? stack.slotX : 0;
      const sy = stack && Number.isInteger(stack.slotY) ? stack.slotY : 0;
      const isAnchor = Boolean(stack && gx === sx && gy === sy);
      const gridEntry = isAnchor && stack ? buildStockpileGridEntry(stack, slotIndex ?? 0) : null;
      const qty = stack ? Math.max(0, Math.floor(Number(stack.quantity) || 0)) : 0;
      const tooltip = gridEntry
        ? buildInventoryGridItemTooltipTitle({
          name: gridEntry.name,
          totalWeightKg: gridEntry.totalWeightKg,
          formatWeightLabel: formatWeightLabelProp,
          decayDays: gridEntry.decayDays,
          decayDaysRemaining: gridEntry.decayDaysRemaining,
          drynessPercent: gridEntry.drynessPercent,
          isFullyDried: gridEntry.isFullyDried === true,
          canDry: gridEntry.canDry === true,
        })
        : undefined;

      row.push(
        <div
          key={key}
          className={`hud-rack-cell ${highlighted ? 'hud-rack-cell-highlight' : ''} ${stack ? (isAnchor ? 'hud-rack-cell-anchor' : 'hud-rack-cell-fill') : ''}`}
          title={isAnchor ? tooltip : undefined}
        >
          {stack ? (
            <>
              {isAnchor ? (
                <>
                  <div className="hud-rack-cell-sprite">
                    <InventorySlotSpriteStack
                      sprite={gridEntry?.inventorySprite ?? null}
                      fallbackLabel={gridEntry?.name ?? stack.itemId}
                      isFullyDried={gridEntry?.isFullyDried === true}
                      spoilageProgress={gridEntry?.spoilageProgress ?? null}
                      fixedSlotWidthPx={44}
                    />
                  </div>
                  <div className="hud-rack-cell-meta">
                    <span className="hud-rack-cell-name">{gridEntry?.name ?? stack.itemId}</span>
                    <span className="hud-rack-cell-qty">×{qty}</span>
                    {gridEntry?.drynessPercent != null ? (
                      <span className="hud-rack-cell-dry">
                        {gridEntry.isFullyDried ? 'Dry' : `${gridEntry.drynessPercent}% dry`}
                      </span>
                    ) : null}
                    {gridEntry?.spoilageProgress != null && Number.isFinite(gridEntry.decayDaysRemaining) ? (
                      <span className="hud-rack-cell-decay">
                        ~{Number(gridEntry.decayDaysRemaining).toFixed(1)}d to spoil
                      </span>
                    ) : null}
                    {onRemoveSlot && typeof slotIndex === 'number' ? (
                      <button
                        type="button"
                        className="hud-rack-remove"
                        onClick={() => onRemoveSlot(slotIndex)}
                      >
                        Take off
                      </button>
                    ) : null}
                  </div>
                </>
              ) : (
                <div className="hud-rack-cell-continuation" aria-hidden />
              )}
            </>
          ) : showEmptyHint ? (
            <span className="hud-rack-cell-empty">Empty</span>
          ) : null}
        </div>,
      );
    }
    rows.push(
      <div key={`rack-row-${gy}`} className="hud-rack-row">
        {row}
      </div>,
    );
  }

  return (
    <div className="hud-drying-rack-grid" aria-label="Drying rack 2 by 2">
      {caption ? <p className="hud-rack-caption">{caption}</p> : null}
      <div className="hud-rack-board">{rows}</div>
    </div>
  );
}
