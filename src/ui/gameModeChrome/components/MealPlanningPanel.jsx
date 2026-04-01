import { useMemo } from 'react';
import { resolveStewIngredientDescriptor } from '../../../game/stewIngredientDescriptor.mjs';
import { buildInventoryGridItemTooltipTitle } from '../../../game/inventorySlotDecayDryness.mjs';
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
  return buildInventoryGridItemTooltipTitle({
    name: entry.name,
    totalWeightKg: entry.totalWeightKg,
    formatWeightLabel: (kg) => `${Number(kg || 0).toFixed(2)}kg`,
    decayDays: entry.decayDays ?? null,
    decayDaysRemaining: entry.decayDaysRemaining ?? null,
    drynessPercent: entry.drynessPercent ?? null,
    isFullyDried: entry.isFullyDried === true,
    canDry: entry.canDry === true,
  }) + (Number.isFinite(calories) ? ` — ${Math.round(calories)} cal` : '');
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
                const need = Math.max(0, Number(row.dailyCalories) || 0);
                const share = Math.max(0, Number(row.shareCalories) || 0);
                const effective = Math.max(0, Number(row.effectiveCalories) || 0);
                const deficit = Math.max(0, Number(row.deficitCalories) || 0);
                const intakeFraction = Math.max(0, Math.min(1, Number(row.intakeFraction) || 0));
                const intakeCap = deficit * intakeFraction;
                const pct = need > 0 ? Math.max(0, Math.min(100, (effective / need) * 100)) : 0;
                const limited = share > 0 && effective < share;
                const limitedByShare = share > 0 && share < (intakeCap - 1e-6);
                return (
                  <div key={`meal-need-${row.actorId}`} className="meal-need-row">
                    <span className="meal-need-label">{row.actorId}</span>
                    <span className="meal-need-values">
                      {Math.round(effective)} / {Math.round(need)} cal
                      {limited ? ' (limited)' : ''}
                    </span>
                    <span className="meal-need-bar" aria-hidden="true">
                      <span className="meal-need-fill" style={{ width: `${pct}%` }} />
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

      <div className="meal-grid-wrap">
        <div className="meal-grid-block">
          <h4>Ingredients (Inventory + Stockpile)</h4>
          <p className="debrief-note">Double-click to add 1 to stew.</p>
          <div className="inventory-grid meal-inventory-grid" role="listbox" aria-label="Meal candidates">
            {candidateEntries.map(({ source, entry, calories }) => {
              const spoilSoon = Number.isFinite(entry.decayDaysRemaining)
                && entry.decayDaysRemaining <= SPOIL_BEFORE_NEXT_DEBRIEF_DAYS;
              return (
                <button
                  key={`${source}:${entry.itemId}`}
                  type="button"
                  className={`inventory-slot inventory-slot--meal ${source === 'stockpile' ? 'inventory-slot--meal-stockpile' : 'inventory-slot--meal-inventory'}`}
                  title={gridEntryTooltip(entry, calories)}
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
          <p className="debrief-note">Double-click to remove 1.</p>
          <div className="inventory-grid meal-inventory-grid" role="listbox" aria-label="Stew ingredients">
            {stewRows.length === 0 ? (
              <p className="hud-empty-note">Empty</p>
            ) : (
              stewRows.map(({ entry, calories }) => (
                <button
                  key={`stew:${entry.itemId}`}
                  type="button"
                  className="inventory-slot inventory-slot--meal inventory-slot--meal-stew"
                  title={gridEntryTooltip(entry, calories)}
                  onDoubleClick={() => onRemoveIngredient(entry.itemId, 1)}
                >
                  <InventorySlotSpriteStack
                    sprite={entry.inventorySprite}
                    fallbackLabel={entry.name || entry.itemId}
                    isFullyDried={entry.isFullyDried === true}
                    spoilageProgress={entry.spoilageProgress}
                  />
                  <span className="slot-overlay">
                    <span className="slot-overlay-text slot-overlay-qty">×{entry.quantity}</span>
                    <span className="slot-overlay-text slot-overlay-wt">{Math.round(calories)} cal</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

