import { isTileWithinCampFootprint } from '../game/campFootprint.mjs';
import { chebyshev } from './ambientMath.mjs';
import { partnerTaskMatches } from './partnerTaskMatch.mjs';

/**
 * Campfire loop: must be within `audibility.max_chebyshev_tiles_from_camp_anchor` of camp anchor
 * (default 3) so the loop **stops** when you walk away, even if another eligibility path misfires.
 */
export function isCampfireWithinAnchorDistance(entry, state, listenerTileX, listenerTileY) {
  if (!state?.camp) {
    return false;
  }
  const ax = Math.floor(Number(state.camp.anchorX));
  const ay = Math.floor(Number(state.camp.anchorY));
  if (!Number.isInteger(listenerTileX) || !Number.isInteger(listenerTileY)
    || !Number.isInteger(ax) || !Number.isInteger(ay)) {
    return false;
  }
  const raw = entry?.audibility?.max_chebyshev_tiles_from_camp_anchor;
  const maxD = (Number.isFinite(Number(raw)) && Number(raw) >= 0)
    ? Math.floor(Number(raw))
    : 3;
  return chebyshev(listenerTileX, listenerTileY, ax, ay) <= maxD;
}

export function listenerInCampFootprint(state, listenerTileX, listenerTileY) {
  if (!Number.isInteger(listenerTileX) || !Number.isInteger(listenerTileY)) {
    return false;
  }
  return isTileWithinCampFootprint(state, listenerTileX, listenerTileY);
}

export function isCampfireEligible(entry, state, listenerTileX, listenerTileY) {
  if (entry?.audio_role !== 'camp_campfire') {
    return false;
  }
  if (!state?.camp) {
    return false;
  }
  if (!isCampfireWithinAnchorDistance(entry, state, listenerTileX, listenerTileY)) {
    return false;
  }
  if (!entry.audibility?.requires_listener_in_camp_footprint) {
    return true;
  }
  return listenerInCampFootprint(state, listenerTileX, listenerTileY);
}

export function isBeehiveTileEligible(entry, state, hiveTile, listenerTileX, listenerTileY) {
  if (entry?.audio_role !== 'sim_beehive') {
    return false;
  }
  const bh = hiveTile?.beehive;
  if (!bh || bh.active !== true) {
    return false;
  }
  if (entry.audibility?.requires_beehive_active === false) {
    /* allow */
  }
  const sid = typeof bh.speciesId === 'string' ? bh.speciesId : 'bombus_pennsylvanicus_colony';
  if (sid !== entry.species_id) {
    return false;
  }
  if (!Number.isInteger(listenerTileX) || !Number.isInteger(listenerTileY)) {
    return false;
  }
  if (entry.audibility?.requires_listener_chebyshev_adjacent) {
    const d = chebyshev(listenerTileX, listenerTileY, hiveTile.x, hiveTile.y);
    return d <= 1;
  }
  return true;
}

export function isPartnerWorkEligible(entry, state, listenerTileX, listenerTileY) {
  if (entry?.audio_role !== 'partner_station_work') {
    return false;
  }
  const active = state?.camp?.partnerTaskQueue?.active;
  if (!partnerTaskMatches(entry, active)) {
    return false;
  }
  if (entry.audibility?.requires_listener_in_camp_footprint) {
    return listenerInCampFootprint(state, listenerTileX, listenerTileY);
  }
  return true;
}
