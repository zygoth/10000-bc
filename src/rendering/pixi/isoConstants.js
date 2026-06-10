/** Matches isometric constants in `src/App.js` (keep in sync). */
export const ISO_GLOBAL_RENDER_SCALE = 1;
export const ISO_BASE_TILE_WIDTH_PX = 128;
export const ISO_BASE_TILE_HEIGHT_PX = 64;
export const ISO_TILE_WIDTH_PX = ISO_BASE_TILE_WIDTH_PX * ISO_GLOBAL_RENDER_SCALE;
export const ISO_TILE_HEIGHT_PX = ISO_BASE_TILE_HEIGHT_PX * ISO_GLOBAL_RENDER_SCALE;
export const ISO_TILE_HALF_WIDTH_PX = ISO_TILE_WIDTH_PX / 2;
export const ISO_TILE_HALF_HEIGHT_PX = ISO_TILE_HEIGHT_PX / 2;
export const ISO_SOURCE_TILE_WIDTH = 64;
export const ISO_BASE_SCALE = ISO_TILE_WIDTH_PX / ISO_SOURCE_TILE_WIDTH;
export const ISO_HALF_CUBE_FRAME_HEIGHT = 52;
export const ISO_FULL_CUBE_FRAME_HEIGHT = 64;
export const ISO_WATER_VERTICAL_OFFSET_PX = (ISO_FULL_CUBE_FRAME_HEIGHT - ISO_HALF_CUBE_FRAME_HEIGHT) * ISO_BASE_SCALE;
export const ISO_ROCK_STACK_OFFSET_PX = ISO_TILE_HALF_HEIGHT_PX;
export const ISO_OCCUPANT_VISUAL_NUDGE_PX = -4;
/** World camp sheet art (wigwam / stations) vs tile-native occupant scale. */
export const ISO_CAMP_WORLD_SPRITE_SCALE_MULT = 0.5;
/** Nudge camp sprites up on the tile (screen Y, negative = up). */
export const ISO_CAMP_WORLD_SPRITE_NUDGE_UP_PX = -6;
export const ISO_PLAY_TOP_HUD_CENTER_BIAS_PX = 80;
export const ISO_PLAY_VERTICAL_NUDGE_EXTRA_TILE_HEIGHTS = 1;
export const ISO_TILE_ENTITY_TEXT_NUDGE_DOWN_PX = (ISO_HALF_CUBE_FRAME_HEIGHT * ISO_BASE_SCALE) * 0.38;
/**
 * Ground fungus on the iso tile: small fruiting bodies (~inches tall), not full “plant” scale.
 * Applied with {@link plantPatchLayout.deterministicMushroomScaleJitter} on top of this base.
 */
export const ISO_GROUND_FUNGUS_ZONE_REL_TO_OCCUPANT = 0.2;
/**
 * Dropped ground stack: keep small (inventory art is 64px design); mult ~tile width so it fits the diamond.
 */
export const ISO_WORLD_ITEM_SCALE_MULT = 0.17;
/**
 * Move the foot *up* from `groundY` (smaller screen Y). Above the rock line so the stack sits higher
 * on the diamond and stays visible under “forward” iso tiles.
 */
export const ISO_WORLD_ITEM_FOOT_NUDGE_PX = ISO_ROCK_STACK_OFFSET_PX * 1.42;
export const ISO_ELEVATION_LEVELS = 6;
export const ISO_MAX_ELEVATION_OFFSET_PX = ISO_ELEVATION_LEVELS * ISO_TILE_HALF_HEIGHT_PX;
/**
 * When false, the isometric play view draws all tiles at one visual height (flat, like Don't Starve).
 * Simulation `tile.elevation` is unchanged; only rendering uses this.
 */
export const ISO_VISUALIZE_TILE_ELEVATION = false;

export function elevationToIsoOffsetPx(elevation) {
  if (!ISO_VISUALIZE_TILE_ELEVATION) {
    return 0;
  }
  const normalized = Math.max(0, Math.min(1, Number(elevation) || 0));
  return normalized * ISO_MAX_ELEVATION_OFFSET_PX;
}
