import { ITEM_BY_ID } from './itemCatalog.mjs';
import { PLANT_BY_ID } from './plantCatalog.mjs';
import { resolveInventoryItemSpriteFrame } from './inventoryItemSpriteResolve.mjs';

export function formatTokenLabel(value) {
  if (typeof value !== 'string' || !value) {
    return '';
  }
  return value
    .split('_')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function formatItemTokenLabel(itemId) {
  const item = ITEM_BY_ID[itemId];
  if (item?.name) {
    return item.name.toLowerCase();
  }
  if (typeof itemId !== 'string' || !itemId) {
    return 'item';
  }
  const segments = itemId.split(':');
  if (segments.length === 3) {
    const [speciesId, partName] = segments;
    const species = PLANT_BY_ID[speciesId] || null;
    const speciesLabel = species?.name ? species.name.toLowerCase() : formatTokenLabel(speciesId || 'plant').toLowerCase();
    return `${speciesLabel} ${formatTokenLabel(partName || 'part').toLowerCase()}`;
  }
  if (segments.length === 2) {
    return `${formatTokenLabel(segments[1]).toLowerCase()}`;
  }
  return formatTokenLabel(itemId).toLowerCase() || 'item';
}

export function getStationIdAtTile(camp, x, y) {
  if (!Number.isInteger(x) || !Number.isInteger(y) || !camp?.stationPlacements || typeof camp.stationPlacements !== 'object') {
    return null;
  }
  for (const [stationId, placement] of Object.entries(camp.stationPlacements)) {
    if (Number.isInteger(placement?.x) && Number.isInteger(placement?.y) && placement.x === x && placement.y === y) {
      return stationId;
    }
  }
  return null;
}

export function buildWorldItemToken(worldItems) {
  if (!Array.isArray(worldItems) || worldItems.length === 0) {
    return '';
  }
  const uniqueItemIds = Array.from(new Set(
    worldItems
      .map((entry) => (typeof entry?.itemId === 'string' ? entry.itemId : ''))
      .filter(Boolean),
  ));
  if (uniqueItemIds.length === 0) {
    return '';
  }
  if (uniqueItemIds.length > 1) {
    return '[items]';
  }
  return `[${formatItemTokenLabel(uniqueItemIds[0])}]`;
}

export function buildTileEntityTokens(tile, context = {}) {
  const tokens = [];
  const {
    isPlayerTile = false,
    isCampTile = false,
    stationAtTile = null,
    worldItems = [],
    camp = null,
    /** When a camp/station world sprite is drawn, skip camp/station text labels. */
    omitCampEntityLabels = false,
  } = context;

  if (isPlayerTile) {
    tokens.push('[player]');
  }
  if (isCampTile && !omitCampEntityLabels) {
    tokens.push('[camp]');
    if (camp?.dryingRackUnlocked) {
      tokens.push('[drying rack]');
    }
  }
  if (typeof stationAtTile === 'string' && stationAtTile && !omitCampEntityLabels) {
    tokens.push(`[${formatTokenLabel(stationAtTile)}]`);
  }

  if (tile?.simpleSnare?.active) {
    tokens.push('[snare]');
  }
  if (tile?.deadfallTrap?.active) {
    tokens.push('[deadfall]');
  }
  if (tile?.fishTrap?.active) {
    tokens.push('[fish trap]');
  }
  if (tile?.autoRod?.active) {
    tokens.push('[auto rod]');
  }
  if (tile?.sapTap?.active) {
    tokens.push('[sap tap]');
  }
  if (tile?.leachingBasket?.active) {
    tokens.push('[leaching basket]');
  }
  const worldItemToken = buildWorldItemToken(worldItems);
  if (worldItemToken) {
    const uniqueItemIds = Array.from(new Set(
      worldItems
        .map((entry) => (typeof entry?.itemId === 'string' ? entry.itemId : ''))
        .filter(Boolean),
    ));
    if (uniqueItemIds.length === 1 && resolveInventoryItemSpriteFrame(uniqueItemIds[0])) {
      // Iso view draws a sprite at the foot of the tile; no duplicate text label.
    } else {
      tokens.push(worldItemToken);
    }
  }

  return tokens;
}
