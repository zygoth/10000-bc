import { previewTickBudgetImpact } from '../../game/simCore.mjs';

export const CONTEXT_MENU_PASS_OUT_TICK_REASON = 'Not enough energy left today — you would pass out before finishing.';

function playerTickBudgetCurrentForUi(playerActor) {
  if (!playerActor) {
    return 0;
  }
  if (Number.isFinite(Number(playerActor.tickBudgetCurrent))) {
    return Number(playerActor.tickBudgetCurrent);
  }
  if (Number.isFinite(Number(playerActor.tickBudgetBase))) {
    return Number(playerActor.tickBudgetBase);
  }
  return 0;
}

/**
 * Adds tickOverdraftWarning, or disables the entry when the tick cost would exceed the daily overdraft cap.
 * Preserves existing disabled/disabledReason (e.g. carry capacity) and merges when both apply.
 */
export function annotateContextEntryTickBudget(entry, playerActor) {
  if (!entry || typeof entry !== 'object') {
    return entry;
  }
  const current = playerTickBudgetCurrentForUi(playerActor);
  const impact = previewTickBudgetImpact(current, entry.tickCost);
  const next = { ...entry };
  if (impact.exceedsDailyOverdraftLimit) {
    next.disabled = true;
    next.disabledReason = next.disabledReason
      ? `${next.disabledReason} ${CONTEXT_MENU_PASS_OUT_TICK_REASON}`
      : CONTEXT_MENU_PASS_OUT_TICK_REASON;
    return next;
  }
  if (impact.wouldOverdraft && next.disabled !== true) {
    next.tickOverdraftWarning = true;
  }
  return next;
}

function contextMenuLabelOmitsTickSuffix(label) {
  return typeof label === 'string' && label.trimEnd().endsWith('...');
}

/**
 * Action label with tick suffix, matching tile context menu (e.g. "Eat (2t)", "Inspect Drying Rack (0t)").
 * Labels ending with "..." (station sub-flows) show no suffix.
 */
export function formatContextMenuActionWithTickCost(entry) {
  if (!entry || typeof entry !== 'object') {
    return '';
  }
  const label = typeof entry.label === 'string' ? entry.label : String(entry.kind || '');
  if (contextMenuLabelOmitsTickSuffix(label)) {
    return label;
  }
  const raw = Number(entry.tickCost);
  const ticks = Number.isFinite(raw) ? raw : 0;
  return `${label} (${ticks}t)`;
}

export function formatWeightLabel(valueKg) {
  const numeric = Number(valueKg);
  if (!Number.isFinite(numeric)) return '0g';
  if (numeric < 0.1) return `${Math.round(numeric * 1000)}g`;
  return `${numeric.toFixed(2)}kg`;
}

export function getCarryWeightSeverity({ currentKg, capacityKg }) {
  const cur = Number(currentKg);
  const cap = Math.max(1, Number(capacityKg) || 1);
  if (!Number.isFinite(cur)) return 'normal';
  const ratio = cur / cap;
  if (ratio >= 0.95) return 'critical';
  if (ratio >= 0.8) return 'warning';
  return 'normal';
}

export function getSelectedStackEntry(stacks, selectedItemId) {
  const id = selectedItemId || '';
  if (!Array.isArray(stacks) || !id) return null;
  return stacks.find((e) => e?.itemId === id) || null;
}

export function getActiveItemContextEntries({
  itemContextMenu,
  inventoryQuickActionsByStackIndex,
  stockpileQuickActionsByItemId,
}) {
  const source = itemContextMenu?.source;
  if (source === 'stockpile') {
    const itemId = itemContextMenu.itemId;
    if (!itemId) {
      return [];
    }
    return stockpileQuickActionsByItemId?.[itemId] || [];
  }
  if (source === 'inventory') {
    const idx = itemContextMenu.inventoryStackIndex;
    if (!Number.isInteger(idx) || idx < 0) {
      return [];
    }
    return inventoryQuickActionsByStackIndex?.[idx] || [];
  }
  return [];
}

export function getWorstSeverity(groupRows) {
  const order = ['critical', 'low', 'warning', 'good'];
  const rows = Array.isArray(groupRows) ? groupRows : [];
  return rows.reduce((acc, row) => {
    const severity = row?.severity || 'good';
    const idx = order.indexOf(severity);
    return idx !== -1 && idx < order.indexOf(acc) ? severity : acc;
  }, 'good');
}

