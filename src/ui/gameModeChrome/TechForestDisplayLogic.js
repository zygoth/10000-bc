/**
 * Pure visibility rules for Tech Forest entrypoints (UI/UX §13).
 * Play HUD and debrief Queue tab both surface the same overlay (see docs/10000bc_uiux_design.md §13.1).
 */
export function getTechForestEntrySurface({ isDebriefActive, debriefSelectedTab }) {
  const tab = typeof debriefSelectedTab === 'string' ? debriefSelectedTab : '';
  const inDebrief = isDebriefActive === true;
  return {
    /** Main foraging HUD (not during nightly debrief). */
    showInPlayHud: !inDebrief,
    /** Debrief is open (any tab). */
    showInDebrief: inDebrief,
    /** Queue tab: primary flow from design doc (Research → View Tech Forest). */
    showInDebriefQueueTab: inDebrief && tab === 'queue',
  };
}
