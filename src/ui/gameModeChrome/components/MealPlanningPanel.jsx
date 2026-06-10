import { useCallback, useEffect, useMemo, useState } from 'react';
import { resolveStewIngredientDescriptor } from '../../../game/stewIngredientDescriptor.mjs';
import { buildInventoryGridItemTooltipTitle } from '../../../game/inventorySlotDecayDryness.mjs';
import { HUD_INVENTORY_SLOT_PX } from '../../inventorySlotSpriteFill/hudInventorySlotWidthPx.mjs';
import InventorySlotSpriteStack from '../../inventorySlotSpriteFill/InventorySlotSpriteStack.jsx';

const SPOIL_BEFORE_NEXT_DEBRIEF_DAYS = 1.5;

function computeCaloriesForStack(itemId, quantity) {
  const desc = resolveStewIngredientDescriptor(itemId);
  if (!desc) {
    return 0;
  }
  const q = Math.max(1, Math.floor(Number(quantity) || 1));
  const factor = Number.isFinite(Number(desc.stewNutritionFactor)) ? Number(desc.stewNutritionFactor) : 1;
  const c = (Number(desc.nutrition?.calories) || 0) * q * (Number(desc.extraction) || 0) * factor;
  return Number.isFinite(c) ? c : 0;
}

function gridEntryTooltip(entry, calories) {
  const base = buildInventoryGridItemTooltipTitle({
    name: entry.name,
    totalWeightKg: entry.totalWeightKg,
    formatWeightLabel: (kg) => `${Number(kg || 0).toFixed(2)}kg`,
    decayDays: entry.decayDays ?? null,
    decayDaysRemaining: entry.decayDaysRemaining ?? null,
    drynessPercent: entry.drynessPercent ?? null,
    isFullyDried: entry.isFullyDried === true,
    canDry: entry.canDry === true,
  });
  const cal = Number.isFinite(calories) ? ` — ${Math.round(calories)} cal` : '';
  const stockNote = Number.isFinite(entry._mealStockGross) && entry._mealStockGross > (entry.quantity || 0)
    ? ` — ${entry.quantity} unallocated in stock (of ${entry._mealStockGross} in pile)`
    : '';
  return base + cal + stockNote;
}

function sortCandidatesByNutrition(candidates) {
  return [...candidates].sort((a, b) => {
    if (b.calories !== a.calories) {
      return b.calories - a.calories;
    }
    if (a.source !== b.source) {
      return a.source.localeCompare(b.source);
    }
    const aId = typeof a?.entry?.itemId === 'string' ? a.entry.itemId : '';
    const bId = typeof b?.entry?.itemId === 'string' ? b.entry.itemId : '';
    return aId.localeCompare(bId);
  });
}

export default function MealPlanningPanel({
  inventoryEntries,
  stockpileEntries,
  mealPlanIngredients,
  mealPlanPreview,
  onAddIngredientFromStockpile,
  onAddIngredientFromInventory,
  onRemoveIngredient,
}) {
  const previewCalories = Number(mealPlanPreview?.totalNutrition?.calories) || 0;
  const previewProtein = Number(mealPlanPreview?.totalNutrition?.protein) || 0;
  const previewCarbs = Number(mealPlanPreview?.totalNutrition?.carbs) || 0;
  const previewFat = Number(mealPlanPreview?.totalNutrition?.fat) || 0;
  const perActor = Array.isArray(mealPlanPreview?.perActor) ? mealPlanPreview.perActor : [];

  const [selected, setSelected] = useState(null);
  const [sliderQty, setSliderQty] = useState(1);

  function limitReasonLabel(reason) {
    if (reason === 'hunger_full') return 'Already full (hunger bar is full)';
    if (reason === 'edibility_limited') return 'Limited by edibility/harshness';
    if (reason === 'nausea_limited') return 'Limited by nausea';
    if (reason === 'share_limited') return 'Limited by stew calories (your share)';
    if (reason) return String(reason);
    return null;
  }

  function stewCapReasonLine(row) {
    const share = Math.max(0, Number(row?.shareCalories) || 0);
    const deficit = Math.max(0, Number(row?.deficitCalories) || 0);
    const intakeFraction = Math.max(0, Math.min(1, Number(row?.intakeFraction) || 0));
    const edibilityIntakeCap = Number.isFinite(Number(row?.edibilityIntakeCapCalories))
      ? Math.max(0, Number(row.edibilityIntakeCapCalories))
      : null;
    const baseCap = edibilityIntakeCap == null ? deficit : Math.min(deficit, edibilityIntakeCap);
    const intakeCap = baseCap * intakeFraction;
    const effective = Math.max(0, Number(row?.effectiveCalories) || 0);

    const edibilityCeiling = Number.isFinite(Number(row?.edibilityCeiling))
      ? Math.max(0, Math.min(1, Number(row.edibilityCeiling)))
      : null;
    const nauseaCeiling = Number.isFinite(Number(row?.nauseaCeiling))
      ? Math.max(0, Math.min(1, Number(row.nauseaCeiling)))
      : null;
    const nauseaCap = Number.isFinite(Number(row?.nauseaCap))
      ? Math.max(0, Math.min(1, Number(row.nauseaCap)))
      : null;

    const primary = limitReasonLabel(row?.limitReason) || (effective < share ? 'Limited' : null);
    const hungerPct = Number.isFinite(Number(row?.hungerBefore)) ? Math.round(Number(row.hungerBefore) * 100) : null;
    const parts = [
      hungerPct != null ? `Hunger ${hungerPct}%` : null,
      `Cap min(share ${Math.round(share)}, min(deficit ${Math.round(deficit)}, edibilityCap ${edibilityIntakeCap == null ? '∞' : Math.round(edibilityIntakeCap)}) × intake ${Math.round(intakeFraction * 100)}% = ${Math.round(intakeCap)})`,
      (edibilityCeiling != null || nauseaCeiling != null || nauseaCap != null)
        ? `Intake=min(edibility ${edibilityCeiling != null ? Math.round(edibilityCeiling * 100) : '?'}%, nausea ${nauseaCeiling != null ? Math.round(nauseaCeiling * 100) : '?'}%, actor ${nauseaCap != null ? Math.round(nauseaCap * 100) : '?'}%)`
        : null,
      primary ? `— ${primary}` : null,
    ].filter(Boolean);
    return parts.join(' ');
  }
  const stewByItemId = useMemo(() => {
    const map = new Map();
    for (const entry of mealPlanIngredients || []) {
      const itemId = typeof entry?.itemId === 'string' ? entry.itemId : '';
      const quantity = Math.max(0, Math.floor(Number(entry?.quantity) || 0));
      if (!itemId || quantity <= 0) continue;
      map.set(itemId, (map.get(itemId) || 0) + quantity);
    }
    return map;
  }, [mealPlanIngredients]);

  const candidateEntries = useMemo(() => {
    const inv = Array.isArray(inventoryEntries) ? inventoryEntries : [];
    const stock = Array.isArray(stockpileEntries) ? stockpileEntries : [];
    const candidates = [];

    for (const entry of inv) {
      const calories = computeCaloriesForStack(entry.itemId, entry.quantity);
      if (calories <= 0) continue;
      candidates.push({
        source: 'inventory',
        entry,
        calories,
      });
    }
    for (const entry of stock) {
      const calories = computeCaloriesForStack(entry.itemId, entry.quantity);
      if (calories <= 0) continue;
      candidates.push({
        source: 'stockpile',
        entry,
        calories,
      });
    }

    return sortCandidatesByNutrition(candidates);
  }, [inventoryEntries, stockpileEntries]);

  const stewRows = useMemo(() => {
    const byItemId = new Map();
    for (const e of Array.isArray(stockpileEntries) ? stockpileEntries : []) {
      if (e?.itemId) byItemId.set(e.itemId, e);
    }
    for (const e of Array.isArray(inventoryEntries) ? inventoryEntries : []) {
      if (e?.itemId && !byItemId.has(e.itemId)) byItemId.set(e.itemId, e);
    }
    const out = [];
    for (const [itemId, quantity] of stewByItemId.entries()) {
      const resolved = byItemId.get(itemId) || { itemId, name: itemId, quantity };
      out.push({
        entry: { ...resolved, quantity },
        calories: computeCaloriesForStack(itemId, quantity),
      });
    }
    out.sort((a, b) => b.calories - a.calories || a.entry.itemId.localeCompare(b.entry.itemId));
    return out;
  }, [stewByItemId, stockpileEntries, inventoryEntries]);

  const maxForSelection = useMemo(() => {
    if (!selected) {
      return 1;
    }
    if (selected.type === 'stew') {
      return Math.max(1, Math.floor(stewByItemId.get(selected.itemId) || 0));
    }
    const c = candidateEntries.find(
      (r) => r.source === selected.source
        && r.entry.itemId === selected.itemId,
    );
    if (!c) {
      return 1;
    }
    return Math.max(1, Math.floor(Number(c.entry.quantity) || 0));
  }, [selected, candidateEntries, stewByItemId]);

  useEffect(() => {
    if (!selected) {
      return;
    }
    setSliderQty((q) => Math.min(Math.max(1, q), maxForSelection));
  }, [selected, maxForSelection]);

  const selectCandidate = useCallback((source, itemId) => {
    setSelected({ type: 'candidate', source, itemId });
    setSliderQty(1);
  }, []);

  const selectStew = useCallback((itemId) => {
    setSelected({ type: 'stew', source: null, itemId });
    setSliderQty(1);
  }, []);

  const applyStewAction = useCallback(() => {
    if (!selected) {
      return;
    }
    const n = Math.min(maxForSelection, Math.max(1, Math.floor(sliderQty) || 1));
    if (selected.type === 'stew') {
      onRemoveIngredient(selected.itemId, n);
      return;
    }
    if (selected.source === 'stockpile') {
      onAddIngredientFromStockpile(selected.itemId, n);
    } else {
      onAddIngredientFromInventory(selected.itemId, n);
    }
  }, [selected, maxForSelection, sliderQty, onAddIngredientFromStockpile, onAddIngredientFromInventory, onRemoveIngredient]);

  const selectedLabel = useMemo(() => {
    if (!selected) {
      return null;
    }
    if (selected.type === 'stew') {
      const row = stewRows.find((r) => r.entry.itemId === selected.itemId);
      return row?.entry.name || selected.itemId;
    }
    const row = candidateEntries.find(
      (r) => r.source === selected.source && r.entry.itemId === selected.itemId,
    );
    return row?.entry.name || selected.itemId;
  }, [selected, stewRows, candidateEntries]);

  return (
    <div className="meal-planning">
      <div className="meal-planning-header">
        <div className="meal-preview">
          <p className="debrief-note">
            Calories: <strong>{Math.round(previewCalories)}</strong>
            {' · '}
            Protein: <strong>{Math.round(previewProtein)}g</strong>
            {' · '}
            Fat: <strong>{Math.round(previewFat)}g</strong>
            {' · '}
            Carbs: <strong>{Math.round(previewCarbs)}g</strong>
            {' · '}
            Next-day tick bonus: <strong>+{Math.max(0, Number(mealPlanPreview?.nextDayTickBonus) || 0)}</strong>
          </p>
          {perActor.length > 0 ? (
            <div className="meal-needs">
              {perActor.map((row) => {
                const toFull = Math.max(0, Number(row.deficitCalories) || 0);
                const dailyMaint = Math.max(0, Number(row.dailyCalories) || 0);
                const share = Math.max(0, Number(row.shareCalories) || 0);
                const effective = Math.max(0, Number(row.effectiveCalories) || 0);
                const intakeFraction = Math.max(0, Math.min(1, Number(row.intakeFraction) || 0));
                const intakeCap = toFull * intakeFraction;
                const barFillPct = toFull > 0
                  ? Math.max(0, Math.min(100, (effective / toFull) * 100))
                  : 0;
                const limited = share > 0 && effective < share;
                const limitedByShare = share > 0 && share < (intakeCap - 1e-6);
                const valueLine = toFull > 0
                  ? (
                    <span title={`Maintenance target ~${Math.round(dailyMaint)} cal/day`}>
                      {Math.round(effective)} / {Math.round(toFull)} to full
                    </span>
                  )
                  : (
                    <span title={`Maintenance ~${Math.round(dailyMaint)} cal/day`}>
                      {Math.round(effective)} cal{Number(row.hungerBefore) >= 1 - 1e-6 ? ' (satiated)' : ''}
                    </span>
                  );
                return (
                  <div key={`meal-need-${row.actorId}`} className="meal-need-row">
                    <span className="meal-need-label">{row.actorId}</span>
                    <span className="meal-need-values">
                      {valueLine}
                      {limited ? ' (limited)' : ''}
                    </span>
                    <span className="meal-need-bar" aria-hidden="true">
                      <span
                        className="meal-need-fill"
                        style={{ width: `${barFillPct}%` }}
                      />
                    </span>
                    <span className="meal-need-reason">
                      {stewCapReasonLine(row)}
                      {limitedByShare ? ' · Not enough stew calories allocated to this actor.' : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      {selected && maxForSelection >= 1 ? (
        <div className="meal-stew-qty-bar">
          <p className="debrief-note meal-stew-qty-label">
            {selected.type === 'stew' ? 'Remove from stew' : 'Add to stew'}
            : <strong>{selectedLabel}</strong>
            {' '}
            (1–{maxForSelection} units)
          </p>
          <div className="meal-stew-qty-controls">
            <input
              type="range"
              className="meal-stew-qty-slider"
              min={1}
              max={maxForSelection}
              value={Math.min(maxForSelection, Math.max(1, sliderQty))}
              onChange={(e) => {
                setSliderQty(Number(e.target.value) || 1);
              }}
              aria-label="Units to add or remove"
            />
            <span className="meal-stew-qty-value">{Math.min(maxForSelection, Math.max(1, Math.floor(sliderQty) || 1))}</span>
            <button type="button" className="meal-stew-apply-btn" onClick={applyStewAction}>
              {selected.type === 'stew' ? 'Remove' : 'Add'}
            </button>
          </div>
        </div>
      ) : null}

      <div className="meal-grid-wrap">
        <div className="meal-grid-block">
          <h4>Ingredients (Inventory + Stockpile)</h4>
          <p className="debrief-note">Select a slot, set amount, then Add. Double-click adds 1.</p>
          <div className="inventory-grid meal-inventory-grid" role="listbox" aria-label="Meal candidates">
            {candidateEntries.map(({ source, entry, calories }) => {
              const spoilSoon = Number.isFinite(entry.decayDaysRemaining)
                && entry.decayDaysRemaining <= SPOIL_BEFORE_NEXT_DEBRIEF_DAYS;
              const isSelected = selected?.type === 'candidate' && selected.source === source
                && selected.itemId === entry.itemId;
              return (
                <button
                  key={`${source}:${entry.itemId}`}
                  type="button"
                  className={`inventory-slot inventory-slot--meal ${source === 'stockpile' ? 'inventory-slot--meal-stockpile' : 'inventory-slot--meal-inventory'}${isSelected ? ' inventory-slot--meal-selected' : ''}`}
                  title={gridEntryTooltip(entry, calories)}
                  onClick={() => {
                    selectCandidate(source, entry.itemId);
                  }}
                  onDoubleClick={() => {
                    if (source === 'stockpile') {
                      onAddIngredientFromStockpile(entry.itemId, 1);
                    } else {
                      onAddIngredientFromInventory(entry.itemId, 1);
                    }
                  }}
                >
                  {spoilSoon ? <span className="meal-spoil-warn" aria-label="Spoils soon" /> : null}
                  <InventorySlotSpriteStack
                    sprite={entry.inventorySprite}
                    fallbackLabel={entry.name || entry.itemId}
                    isFullyDried={entry.isFullyDried === true}
                    spoilageProgress={entry.spoilageProgress}
                    fixedSlotWidthPx={HUD_INVENTORY_SLOT_PX}
                  />
                  <span className="slot-overlay">
                    <span className="slot-overlay-text slot-overlay-qty">×{entry.quantity}</span>
                    <span className="slot-overlay-text slot-overlay-wt">{Math.round(calories)} cal</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="meal-grid-block">
          <h4>Stew</h4>
          <p className="debrief-note">Select a slot, set amount, then Remove. Double-click removes 1.</p>
          <div className="inventory-grid meal-inventory-grid" role="listbox" aria-label="Stew ingredients">
            {stewRows.length === 0 ? (
              <p className="hud-empty-note">Empty</p>
            ) : (
              stewRows.map(({ entry, calories }) => {
                const isSelected = selected?.type === 'stew' && selected.itemId === entry.itemId;
                return (
                  <button
                    key={`stew:${entry.itemId}`}
                    type="button"
                    className={`inventory-slot inventory-slot--meal inventory-slot--meal-stew${isSelected ? ' inventory-slot--meal-selected' : ''}`}
                    title={gridEntryTooltip(entry, calories)}
                    onClick={() => {
                      selectStew(entry.itemId);
                    }}
                    onDoubleClick={() => onRemoveIngredient(entry.itemId, 1)}
                  >
                    <InventorySlotSpriteStack
                      sprite={entry.inventorySprite}
                      fallbackLabel={entry.name || entry.itemId}
                      isFullyDried={entry.isFullyDried === true}
                      spoilageProgress={entry.spoilageProgress}
                      fixedSlotWidthPx={HUD_INVENTORY_SLOT_PX}
                    />
                    <span className="slot-overlay">
                      <span className="slot-overlay-text slot-overlay-qty">×{entry.quantity}</span>
                      <span className="slot-overlay-text slot-overlay-wt">{Math.round(calories)} cal</span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
