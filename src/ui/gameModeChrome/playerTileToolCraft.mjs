import { ITEM_BY_ID } from '../../game/itemCatalog.mjs';
import { TOOL_RECIPES } from '../../game/simActions.mjs';
import { getActionTickCost, validateAction } from '../../game/simCore.mjs';

/**
 * Valid tool_craft rows for the player when the context menu targets the player's current tile
 * (right-click self). Workbench only affects tick cost in validation, not availability.
 */
export function listPlayerTileToolCraftEntries(gameState, playerActor) {
  const entries = [];
  const recipeIds = Object.keys(TOOL_RECIPES).sort((a, b) => a.localeCompare(b));
  for (const recipeId of recipeIds) {
    const v = validateAction(gameState, {
      actorId: 'player',
      kind: 'tool_craft',
      payload: { recipeId },
    });
    if (!v.ok) {
      continue;
    }
    const recipe = TOOL_RECIPES[recipeId];
    const outputId = typeof recipe?.outputItemId === 'string' ? recipe.outputItemId : '';
    const name = (outputId && ITEM_BY_ID[outputId]?.name) || recipeId.replace(/_/g, ' ');
    entries.push({
      kind: 'tool_craft',
      label: `Craft ${name}`,
      tickCost: Number(v.normalizedAction?.tickCost) || getActionTickCost('tool_craft', { recipeId }),
      payload: v.normalizedAction.payload,
    });
  }
  return entries;
}

/**
 * Rows for the workbench station overlay ({@link App.js} `stationProcessPanel`): same recipes as
 * player-tile craft, shaped for pick_item / pick_quantity + `submitStationProcess`.
 */
export function listWorkbenchToolCraftStationEntries(gameState) {
  return listPlayerTileToolCraftEntries(gameState, null)
    .map((row) => ({
      source: 'tool_recipe',
      stationId: 'workbench',
      recipeId: row.payload?.recipeId,
      actionKind: 'tool_craft',
      maxQuantity: 1,
      label: row.label,
      toolCraftPayload: row.payload,
    }))
    .filter((e) => typeof e.recipeId === 'string' && e.recipeId.length > 0);
}
