import { validateAction } from '../../game/simCore.mjs';

/**
 * @param {object|null|undefined} debrief
 * @returns {boolean}
 */
export function getDebriefVisionTabNeedsAttention(debrief) {
  if (!debrief || typeof debrief !== 'object') {
    return false;
  }
  const pending = Array.isArray(debrief.pendingVisionChoices) ? debrief.pendingVisionChoices : [];
  if (pending.length > 0) {
    return true;
  }
  if (debrief.requiresVisionConfirmation === true) {
    return true;
  }
  if (debrief.visionRequest && typeof debrief.visionRequest === 'object') {
    return true;
  }
  return false;
}

/**
 * Red dot on Vision tab when something needs attention and user is elsewhere.
 * @param {{ debrief: object|null, selectedDebriefTab: string|null }} params
 */
export function getDebriefVisionTabShowsAlert({ debrief, selectedDebriefTab }) {
  if (selectedDebriefTab === 'vision') {
    return false;
  }
  return getDebriefVisionTabNeedsAttention(debrief);
}

/**
 * @param {import('../../game/simCore.mjs').GameState} gameState
 */
export function probeDebriefVisionRequest(gameState) {
  return validateAction(gameState, {
    actorId: 'player',
    kind: 'partner_vision_request',
    payload: {},
  });
}

/**
 * @param {object} reward
 * @param {(id: string) => string} formatTokenLabel
 * @returns {string}
 */
export function formatChosenVisionRewardLine(reward, formatTokenLabel) {
  const fmt = typeof formatTokenLabel === 'function' ? formatTokenLabel : (id) => String(id || '');
  const cat = reward?.category || 'reward';
  if (cat === 'plant' && Array.isArray(reward.plantNames) && reward.plantNames.length > 0) {
    const head = reward.rewardLabel || 'Plant Knowledge';
    return `${head}: ${reward.plantNames.join(', ')}`;
  }
  if (cat === 'tech') {
    const techLine = reward.techUnlockLabel || reward.techUnlockKey || 'Tech Knowledge';
    const head = reward.rewardLabel || 'Tech Knowledge';
    const suffix = !reward.techUnlockKey ? ' (everything in the tech forest was already known)' : '';
    return `${head}: ${techLine}${suffix}`;
  }
  return `${cat}: ${reward.rewardLabel || reward.rewardId || fmt('applied')}`;
}

const SEASON_LINE = 'Season uses: {uses} / 2 (resets each season)';
const HELP_LINE = 'Partner-led visions need a vision-capable plant or ground fungus present on the map and (usually) stockpiled material to confirm.';

/**
 * Headless surfacing model for the Vision debrief tab (matches DebriefOverlay).
 * @param {{
 *   isDebriefActive: boolean,
 *   gameState: object,
 *   formatTokenLabel: (id: string) => string,
 * }} params
 */
export function buildDebriefVisionPanelModel({
  isDebriefActive,
  gameState,
  formatTokenLabel,
}) {
  const fmt = typeof formatTokenLabel === 'function' ? formatTokenLabel : (id) => String(id || '');
  const debrief = gameState?.camp?.debrief && typeof gameState.camp.debrief === 'object'
    ? gameState.camp.debrief
    : null;

  if (!isDebriefActive || !debrief) {
    return {
      visible: false,
      seasonLine: '',
      helpLine: '',
      requestVision: { show: false, disabled: true, blockedMessage: null },
      confirmItem: { show: false, options: [] },
      rewardChoice: { show: false, options: [] },
      notifications: [],
      partnerRequestCard: null,
      chosenRewardLines: [],
      chosenRewardsHeading: false,
    };
  }

  const probe = probeDebriefVisionRequest(gameState);
  const requestAllowed = probe.ok === true;
  const blockedMessage = requestAllowed ? null : (typeof probe.message === 'string' ? probe.message : null);

  const visionUsesThisSeason = Number.isInteger(debrief.visionUsesThisSeason)
    ? debrief.visionUsesThisSeason
    : 0;
  const visionSelectionOptions = Array.isArray(debrief.visionSelectionOptions)
    ? debrief.visionSelectionOptions
    : [];
  const pendingVisionChoices = Array.isArray(debrief.pendingVisionChoices)
    ? debrief.pendingVisionChoices
    : [];
  const visionNotifications = Array.isArray(debrief.visionNotifications)
    ? debrief.visionNotifications
    : [];
  const chosenVisionRewards = Array.isArray(debrief.chosenVisionRewards)
    ? debrief.chosenVisionRewards
    : [];
  const visionRequest = debrief.visionRequest && typeof debrief.visionRequest === 'object'
    ? debrief.visionRequest
    : null;

  const confirmOptions = visionSelectionOptions.map((entry) => ({
    value: entry.itemId,
    label: `${(entry.displayName || fmt(entry.itemId))} ×${entry.quantity}`,
  }));

  const rewardOptions = pendingVisionChoices.map((entry) => ({
    value: entry.category,
    label: `${entry.category}: ${entry.rewardLabel || entry.rewardId}`,
  }));

  const notifications = visionNotifications.map((entry, idx) => ({
    id: `vn-${entry.itemId || idx}-${entry.partName || idx}`,
    text: entry.message || '',
  }));

  let partnerRequestCard = null;
  if (visionRequest) {
    partnerRequestCard = {
      plantName: visionRequest.plantName || visionRequest.speciesId || '',
      partLine: `${visionRequest.partLabel || visionRequest.partName || ''} (${visionRequest.subStageLabel || visionRequest.subStageId || ''})`,
      quantity: visionRequest.quantity,
      message: visionRequest.message || '',
    };
  }

  const chosenRewardLines = chosenVisionRewards.map((reward, idx) => ({
    key: `cvr-${reward.category || 'reward'}-${idx}`,
    text: formatChosenVisionRewardLine(reward, fmt),
  }));

  return {
    visible: true,
    seasonLine: SEASON_LINE.replace('{uses}', String(visionUsesThisSeason)),
    helpLine: HELP_LINE,
    requestVision: {
      show: true,
      disabled: !requestAllowed,
      blockedMessage,
      probeCode: probe.code || null,
    },
    confirmItem: {
      show: visionSelectionOptions.length > 0,
      options: confirmOptions,
    },
    rewardChoice: {
      show: pendingVisionChoices.length > 0,
      options: rewardOptions,
    },
    notifications,
    partnerRequestCard,
    chosenRewardLines,
    chosenRewardsHeading: chosenVisionRewards.length > 0,
  };
}
