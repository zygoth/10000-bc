import { ANIMAL_BY_ID } from './animalCatalog.mjs';
import { ITEM_BY_ID } from './itemCatalog.mjs';
import {
  landCarcassUnitWeightKgFromSpecies,
  resolveInnerBarkUnitWeightKgForItem,
} from './stockpileDefaultStackOptions.mjs';
import { computeSpoilageProgress } from './inventorySlotDecayDryness.mjs';
import { parsePlantPartItemId } from './plantPartDescriptors.mjs';
import { resolvePlantPartSpriteFrame } from './plantPartSpriteResolve.mjs';

/**
 * Pixel math shared with `gridSlotSpriteFillStyle` (atlas rect → CSS vars).
 * `ox` / `oy` are TexturePacker trim offsets (`spriteSourceSize` in the atlas JSON): where the
 * packed `frame.x/y` rect sits inside the logical source tile. `fx = frame.x - ox` shifts the
 * background so the untrimmed cell lines up; many frames use 0,0 when nothing was trimmed.
 */
export function gridSlotSpriteGeometry(sprite) {
  if (!sprite?.frame) {
    return null;
  }
  const ox = sprite.frame.offsetX ?? 0;
  const oy = sprite.frame.offsetY ?? 0;
  const fw = Math.max(1, sprite.frame.sourceW ?? sprite.frame.w);
  const fh = Math.max(1, sprite.frame.sourceH ?? sprite.frame.h);
  const fx = sprite.frame.x - ox;
  const fy = sprite.frame.y - oy;
  return {
    ox,
    oy,
    fw,
    fh,
    fx,
    fy,
    atlasWidth: sprite.atlasWidth,
    atlasHeight: sprite.atlasHeight,
    imagePath: sprite.imagePath,
    rawFrame: {
      x: sprite.frame.x,
      y: sprite.frame.y,
      w: sprite.frame.w,
      h: sprite.frame.h,
      offsetX: sprite.frame.offsetX ?? 0,
      offsetY: sprite.frame.offsetY ?? 0,
      sourceW: sprite.frame.sourceW ?? sprite.frame.w,
      sourceH: sprite.frame.sourceH ?? sprite.frame.h,
    },
  };
}

function logInventoryPlantPartSlot(payload) {
  if (process.env.NODE_ENV === 'test') {
    return;
  }
  // eslint-disable-next-line no-console
  console.log('[inventorySlotSprite]', payload);
}

/**
 * Atlas background for a square slot of known pixel width (`slotWidthPx`). Uses explicit pixel
 * `background-size` / `background-position` so we never depend on `cqw`/`calc` resolution (which often
 * collapses to 0 for inventory cells and shows atlas 0,0 = seedling).
 */
export function gridSlotSpriteFillStyleForWidth(sprite, slotWidthPx) {
  const g = gridSlotSpriteGeometry(sprite);
  if (!g) {
    return null;
  }
  const slotW = Math.max(1, Number(slotWidthPx) || 1);
  const scale = slotW / g.fw;
  const bw = g.atlasWidth * scale;
  const bh = g.atlasHeight * scale;
  const px = -g.fx * scale;
  const py = -g.fy * scale;
  const publicBase = process.env.PUBLIC_URL || '';
  return {
    backgroundImage: `url(${publicBase}${g.imagePath})`,
    backgroundRepeat: 'no-repeat',
    imageRendering: 'pixelated',
    backgroundSize: `${bw}px ${bh}px`,
    backgroundPosition: `${px}px ${py}px`,
  };
}

/** Nominal 64px slot (tests / static previews). In HUD, prefer `InventorySlotSpriteFill` + measured width. */
export function gridSlotSpriteFillStyle(sprite) {
  return gridSlotSpriteFillStyleForWidth(sprite, 64);
}

function maybeLogPlantPartGridSlot(grid, idx, itemId, descriptor, sprite, spriteStyle) {
  if (!descriptor) {
    return;
  }
  const geometry = gridSlotSpriteGeometry(sprite);
  logInventoryPlantPartSlot({
    event: 'plantPartGridCell',
    grid,
    idx,
    itemId,
    speciesId: descriptor.speciesId,
    partName: descriptor.partName,
    subStageId: descriptor.subStageId,
    spriteIsNull: sprite == null,
    geometry,
    publicUrl: process.env.PUBLIC_URL || '',
    css: spriteStyle
      ? {
          backgroundImage: spriteStyle.backgroundImage,
          backgroundSize: spriteStyle.backgroundSize,
          backgroundPosition: spriteStyle.backgroundPosition,
        }
      : null,
  });
}

function resolveCatalogDecayDays(item, plantPartDescriptor) {
  if (Number.isFinite(Number(item?.decay_days)) && Number(item.decay_days) > 0) {
    return Number(item.decay_days);
  }
  const fromPlant = Number(plantPartDescriptor?.subStage?.decay_days);
  if (Number.isFinite(fromPlant) && fromPlant > 0) {
    return fromPlant;
  }
  return null;
}

function resolveCatalogCanDry(item, plantPartDescriptor) {
  if (item?.can_dry === true) {
    return true;
  }
  return plantPartDescriptor?.subStage?.can_dry === true;
}

/** Remaining days for spoilage bar; if sim omitted decayDaysRemaining but catalog has shelf life, assume full freshness. */
function effectiveDecayDaysRemainingForDisplay(decayDaysRemaining, catalogDecayDays) {
  if (Number.isFinite(decayDaysRemaining)) {
    return decayDaysRemaining;
  }
  if (Number.isFinite(catalogDecayDays) && catalogDecayDays > 0) {
    return catalogDecayDays;
  }
  return null;
}

function resolveDisplayUnitWeightKg(record, item, plantPartDescriptor) {
  const stackedKg = Number(record?.unitWeightKg);
  if (Number.isFinite(stackedKg) && stackedKg > 0) {
    return stackedKg;
  }
  if (Number.isFinite(Number(item?.unit_weight_g))) {
    return Number(item.unit_weight_g) / 1000;
  }
  if (Number.isFinite(Number(plantPartDescriptor?.subStage?.unit_weight_g))) {
    return Number(plantPartDescriptor.subStage.unit_weight_g) / 1000;
  }
  const id = typeof record?.itemId === 'string' ? record.itemId : '';
  if (id === 'bark:inner_bark') {
    return resolveInnerBarkUnitWeightKgForItem();
  }
  const segs = id.split(':');
  if (segs.length === 2) {
    const [speciesId, partId] = segs;
    if (partId === 'carcass') {
      const carcassKg = landCarcassUnitWeightKgFromSpecies(ANIMAL_BY_ID[speciesId]);
      if (carcassKg != null && carcassKg > 0) {
        return carcassKg;
      }
    }
    const species = ANIMAL_BY_ID[speciesId];
    const part = (species?.parts || []).find((entry) => entry?.id === partId) || null;
    const g = Number(part?.unit_weight_g);
    if (Number.isFinite(g) && g > 0) {
      return g / 1000;
    }
  }
  return 0;
}

/** Mirrors `App.js` `playerInventoryEntries` mapping (what `GameModeChrome` gets as `playerInventoryStacks`). */
export function buildPlayerInventoryGridEntry(stack, idx) {
  const item = ITEM_BY_ID[stack.itemId] || null;
  const plantPartDescriptor = parsePlantPartItemId(stack.itemId);
  const quantity = Math.max(0, Number(stack.quantity) || 0);
  const unitWeightKg = resolveDisplayUnitWeightKg(stack, item, plantPartDescriptor);
  const totalWeightKg = unitWeightKg * quantity;
  const sprite = resolvePlantPartSpriteFrame(stack.itemId);
  const spriteStyle = gridSlotSpriteFillStyle(sprite);
  maybeLogPlantPartGridSlot('playerInventory', idx, stack.itemId, plantPartDescriptor, sprite, spriteStyle);
  const canDry = resolveCatalogCanDry(item, plantPartDescriptor);
  const drynessRaw = Number(stack.dryness);
  const dryness = Number.isFinite(drynessRaw) ? Math.max(0, Math.min(1, drynessRaw)) : null;
  const decayDays = resolveCatalogDecayDays(item, plantPartDescriptor);
  const decayDaysRemaining = Number.isFinite(Number(stack?.decayDaysRemaining))
    ? Number(stack.decayDaysRemaining)
    : null;
  const displayRemaining = effectiveDecayDaysRemainingForDisplay(decayDaysRemaining, decayDays);
  const drynessForPct = canDry ? (dryness !== null ? dryness : 0) : dryness;
  return {
    key: `${stack.itemId}-${idx}`,
    itemId: stack.itemId,
    name: item?.name
      || (plantPartDescriptor ? `${plantPartDescriptor.speciesName} ${plantPartDescriptor.partLabel}` : stack.itemId),
    quantity,
    unitWeightKg,
    totalWeightKg,
    canDry,
    decayDays,
    decayDaysRemaining,
    spoilageProgress: computeSpoilageProgress(displayRemaining, decayDays),
    dryness,
    drynessPercent: drynessForPct !== null
      ? Math.round(Math.max(0, Math.min(1, drynessForPct)) * 100)
      : null,
    isFullyDried: drynessForPct !== null && drynessForPct >= 1,
    spriteStyle,
    inventorySprite: sprite,
  };
}

/** Mirrors `App.js` `campStockpileEntries` mapping (`campStockpileStacks` prop). */
export function buildStockpileGridEntry(stack, idx) {
  const item = ITEM_BY_ID[stack.itemId] || null;
  const plantPartDescriptor = parsePlantPartItemId(stack.itemId);
  const sprite = resolvePlantPartSpriteFrame(stack.itemId);
  const quantity = Math.max(0, Number(stack.quantity) || 0);
  const unitWeightKg = resolveDisplayUnitWeightKg(stack, item, plantPartDescriptor);
  const totalWeightKg = unitWeightKg * quantity;
  const spriteStyle = gridSlotSpriteFillStyle(sprite);
  maybeLogPlantPartGridSlot('campStockpile', idx, stack.itemId, plantPartDescriptor, sprite, spriteStyle);
  const canDry = resolveCatalogCanDry(item, plantPartDescriptor);
  const decayDays = resolveCatalogDecayDays(item, plantPartDescriptor);
  const decayDaysRemaining = Number.isFinite(Number(stack?.decayDaysRemaining))
    ? Number(stack.decayDaysRemaining)
    : null;
  const displayRemaining = effectiveDecayDaysRemainingForDisplay(decayDaysRemaining, decayDays);
  const drynessNum = Number.isFinite(Number(stack?.dryness))
    ? Math.max(0, Math.min(1, Number(stack.dryness)))
    : null;
  const drynessForPct = canDry ? (drynessNum !== null ? drynessNum : 0) : drynessNum;
  return {
    key: `${stack.itemId}-${idx}`,
    itemId: stack.itemId,
    category: typeof item?.category === 'string' ? item.category : 'misc',
    name: item?.name
      || (plantPartDescriptor ? `${plantPartDescriptor.speciesName} ${plantPartDescriptor.partLabel}` : stack.itemId),
    quantity,
    unitWeightKg,
    totalWeightKg,
    canDry,
    decayDays,
    decayDaysRemaining,
    spoilageProgress: computeSpoilageProgress(displayRemaining, decayDays),
    freshness: Number.isFinite(Number(stack?.freshness))
      ? Number(stack.freshness)
      : null,
    dryness: drynessNum,
    drynessPercent: drynessForPct !== null ? Math.round(Math.max(0, Math.min(1, drynessForPct)) * 100) : null,
    isFullyDried: drynessForPct !== null && drynessForPct >= 1,
    spriteStyle,
    inventorySprite: sprite,
  };
}

/** Mirrors `App.js` `selectedTileWorldItemEntries` (“On Ground” grid). */
export function buildWorldGroundItemsGridEntry(entry, idx) {
  const item = ITEM_BY_ID[entry.itemId] || null;
  const plantPartDescriptor = parsePlantPartItemId(entry.itemId);
  const sprite = resolvePlantPartSpriteFrame(entry.itemId);
  const quantity = Math.max(0, Number(entry.quantity) || 0);
  const unitWeightKg = resolveDisplayUnitWeightKg(entry, item, plantPartDescriptor);
  const totalWeightKg = unitWeightKg * quantity;
  const spriteStyle = gridSlotSpriteFillStyle(sprite);
  maybeLogPlantPartGridSlot('worldGround', idx, entry.itemId, plantPartDescriptor, sprite, spriteStyle);
  const canDry = resolveCatalogCanDry(item, plantPartDescriptor);
  const decayDays = resolveCatalogDecayDays(item, plantPartDescriptor);
  const decayDaysRemaining = Number.isFinite(Number(entry?.decayDaysRemaining))
    ? Number(entry.decayDaysRemaining)
    : null;
  const displayRemaining = effectiveDecayDaysRemainingForDisplay(decayDaysRemaining, decayDays);
  const drynessRaw = Number(entry?.dryness);
  const dryness = Number.isFinite(drynessRaw) ? Math.max(0, Math.min(1, drynessRaw)) : null;
  const drynessForPct = canDry ? (dryness !== null ? dryness : 0) : dryness;
  return {
    key: `${entry.itemId}-${idx}`,
    itemId: entry.itemId,
    name: item?.name
      || (plantPartDescriptor ? `${plantPartDescriptor.speciesName} ${plantPartDescriptor.partLabel}` : entry.itemId),
    quantity,
    unitWeightKg,
    totalWeightKg,
    canDry,
    decayDays,
    decayDaysRemaining,
    spoilageProgress: computeSpoilageProgress(displayRemaining, decayDays),
    dryness,
    drynessPercent: drynessForPct !== null ? Math.round(Math.max(0, Math.min(1, drynessForPct)) * 100) : null,
    isFullyDried: drynessForPct !== null && drynessForPct >= 1,
    spriteStyle,
    inventorySprite: sprite,
  };
}
