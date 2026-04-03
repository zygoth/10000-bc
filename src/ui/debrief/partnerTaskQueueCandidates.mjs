/**
 * Curated partner task templates for the nightly debrief picker.
 * Each entry is validated live with validateAction(partner_task_set); expand as new task kinds ship.
 */

import { resolveCraftTagsForItem } from '../../game/simActions.mjs';

/** @typedef {{ id: string, group: 'crafting' | 'processing', label: string, task: Record<string, unknown> }} PartnerTaskBlueprint */

/** @type {PartnerTaskBlueprint[]} */
export const PARTNER_TASK_QUEUE_BLUEPRINTS = [
  {
    id: 'craft_basket',
    group: 'crafting',
    label: 'Craft basket',
    task: {
      kind: 'craft_basket',
      ticksRequired: 10,
      outputs: [{ itemId: 'tool:basket', quantity: 1 }],
    },
  },
];

export const PARTNER_TASK_GROUP_LABELS = {
  crafting: 'Crafting & fiber',
  processing: 'Station processing',
};

/**
 * Stockpile rows that can be spun into cordage (catalog `cordage_fiber` tag).
 * @param {unknown} gameState
 */
export function listCordageFiberStockpileRows(gameState) {
  const stacks = Array.isArray(gameState?.camp?.stockpile?.stacks)
    ? gameState.camp.stockpile.stacks
    : [];
  const out = [];
  for (const s of stacks) {
    const itemId = typeof s?.itemId === 'string' ? s.itemId : '';
    const q = Math.max(0, Math.floor(Number(s?.quantity) || 0));
    if (!itemId || q < 1) {
      continue;
    }
    if (!resolveCraftTagsForItem(itemId).includes('cordage_fiber')) {
      continue;
    }
    out.push({ itemId, maxQuantity: q });
  }
  return out;
}

/**
 * @param {unknown} gameState
 * @param {(state: unknown, action: unknown) => { ok: boolean, normalizedAction?: { payload?: { task?: Record<string, unknown> } }, message?: string }} validateAction
 */
export function listValidPartnerTaskCandidateEntries(gameState, validateAction) {
  /** @type {Array<PartnerTaskBlueprint & { validatedTicks: number }>} */
  const out = [];
  for (const bp of PARTNER_TASK_QUEUE_BLUEPRINTS) {
    const validation = validateAction(gameState, {
      actorId: 'player',
      kind: 'partner_task_set',
      payload: {
        queuePolicy: 'append',
        task: {
          ...bp.task,
          taskId: `preview-${bp.id}`,
        },
      },
    });
    if (!validation.ok || !validation.normalizedAction?.payload?.task) {
      continue;
    }
    const ticks = Number(validation.normalizedAction.payload.task.ticksRequired);
    out.push({
      ...bp,
      validatedTicks: Number.isInteger(ticks) ? ticks : Number(bp.task.ticksRequired) || 0,
    });
  }
  return out;
}
