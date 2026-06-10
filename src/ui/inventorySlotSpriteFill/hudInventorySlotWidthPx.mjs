/**
 * First-paint / fallback width for `InventorySlotSpriteFill`’s `fixedSlotWidthPx` in HUDs.
 * The real cell width (often ~48–50px in a 6× grid) is taken from `ResizeObserver` on the host;
 * this value is only a hint if layout has not reported a size yet. Keep in sync with
 * `PartnerRequestedPlantPreview` (56).
 */
export const HUD_INVENTORY_SLOT_PX = 56;

/** Larger cells for the centered inventory modal (`InventoryPanel`). */
export const MODAL_INVENTORY_SLOT_PX = 96;
