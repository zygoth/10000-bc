import InventorySlotSpriteFill from './InventorySlotSpriteFill.jsx';

/**
 * Square slot: atlas sprite + optional freshness strip (green→red, shrinks left→right as it spoils).
 */
export default function InventorySlotSpriteStack({
  sprite,
  fallbackLabel = '',
  isFullyDried = false,
  fixedSlotWidthPx = null,
  spoilageProgress = null,
}) {
  const spoil = spoilageProgress != null && Number.isFinite(Number(spoilageProgress))
    ? Math.max(0, Math.min(1, Number(spoilageProgress)))
    : null;

  const freshnessWidthPct = spoil != null ? Math.max(0, (1 - spoil) * 100) : null;

  return (
    <span
      className={`inventory-slot-sprite-stack ${isFullyDried ? 'inventory-slot-sprite-stack--dried' : ''}`}
    >
      <InventorySlotSpriteFill
        sprite={sprite}
        fixedSlotWidthPx={fixedSlotWidthPx}
        fallbackLabel={fallbackLabel}
      />
      {freshnessWidthPct != null ? (
        <span className="inventory-slot-decay-bar-wrap" aria-hidden="true">
          <span
            className="inventory-slot-decay-bar-fill inventory-slot-decay-bar-fill--gradient"
            style={{ width: `${freshnessWidthPct}%` }}
          />
        </span>
      ) : null}
    </span>
  );
}
