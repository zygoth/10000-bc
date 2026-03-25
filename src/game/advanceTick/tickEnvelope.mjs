export function normalizeInProgressTicks(value, fallback = 1) {
  const parsed = Number.isInteger(value)
    ? value
    : Math.floor(Number(value || 0));
  if (parsed > 0) {
    return parsed;
  }
  return Math.max(1, Math.floor(Number(fallback) || 1));
}

export function isInProgressActionEnvelope(action) {
  return Boolean(
    action
      && action.__inProgressAction === true
      && action.normalizedAction
      && typeof action.normalizedAction === 'object',
  );
}

export function createInProgressActionEnvelope(action, remainingTicks, totalTicks, budgetConsumed = false) {
  const normalizedAction = action && typeof action === 'object'
    ? {
      ...action,
      payload: action.payload && typeof action.payload === 'object'
        ? { ...action.payload }
        : {},
    }
    : {};

  const normalizedTotal = normalizeInProgressTicks(totalTicks, normalizedAction.tickCost);
  const normalizedRemaining = normalizeInProgressTicks(remainingTicks, normalizedTotal);

  return {
    __inProgressAction: true,
    actionId: typeof normalizedAction.actionId === 'string' ? normalizedAction.actionId : null,
    actorId: typeof normalizedAction.actorId === 'string' ? normalizedAction.actorId : null,
    kind: typeof normalizedAction.kind === 'string' ? normalizedAction.kind : null,
    issuedAtTick: Number.isInteger(normalizedAction.issuedAtTick)
      ? normalizedAction.issuedAtTick
      : 0,
    normalizedAction,
    remainingTicks: normalizedRemaining,
    totalTicks: normalizedTotal,
    budgetConsumed: budgetConsumed === true,
  };
}
