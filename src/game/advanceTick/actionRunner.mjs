export function runActionQueue(nextState, options, hooks) {
  const {
    sortActionsDeterministically,
    isInProgressActionEnvelope,
    normalizeInProgressTicks,
    validateActionDefinition,
    isResumablePlayerAction,
    applyActionEffect,
    consumeActorTickBudget,
    advanceOneTick,
    resolveFishRodTickOutcome,
    inBounds,
    tileIndex,
    createInProgressActionEnvelope,
  } = hooks;

  const incomingActions = Array.isArray(options?.actions)
    ? options.actions.map((action) => ({ ...(action || {}) }))
    : [];
  const idleTicks = Number.isInteger(options?.idleTicks) ? Math.max(0, options.idleTicks) : 0;

  nextState.pendingActionQueue = sortActionsDeterministically([
    ...(nextState.pendingActionQueue || []),
    ...incomingActions,
  ]);

  const processedLogEntries = [];
  const deferredActions = [];
  for (const rawAction of nextState.pendingActionQueue) {
    let action = null;
    let actor = null;
    let totalTicks = 1;
    let remainingTicks = 1;
    let budgetConsumed = false;

    if (isInProgressActionEnvelope(rawAction)) {
      action = rawAction.normalizedAction;
      actor = nextState.actors?.[action.actorId] || null;
      totalTicks = normalizeInProgressTicks(rawAction.totalTicks, action.tickCost);
      remainingTicks = normalizeInProgressTicks(rawAction.remainingTicks, totalTicks);
      budgetConsumed = rawAction.budgetConsumed === true;

      if (!actor) {
        processedLogEntries.push({
          actionId: typeof action?.actionId === 'string' ? action.actionId : null,
          actorId: typeof action?.actorId === 'string' ? action.actorId : null,
          kind: typeof action?.kind === 'string' ? action.kind : null,
          status: 'rejected',
          code: 'missing_actor',
          message: 'in-progress action actor does not exist',
          startedAtTick: nextState.dayTick,
          endedAtTick: nextState.dayTick,
        });
        continue;
      }
    } else {
      const validation = validateActionDefinition(nextState, rawAction, {
        fallbackIssuedAtTick: nextState.dayTick,
      });

      if (!validation.ok) {
        processedLogEntries.push({
          actionId: typeof rawAction?.actionId === 'string' ? rawAction.actionId : null,
          actorId: typeof rawAction?.actorId === 'string' ? rawAction.actorId : null,
          kind: typeof rawAction?.kind === 'string' ? rawAction.kind : null,
          status: 'rejected',
          code: validation.code,
          message: validation.message,
          startedAtTick: nextState.dayTick,
          endedAtTick: nextState.dayTick,
        });
        continue;
      }

      action = validation.normalizedAction;
      actor = nextState.actors[action.actorId] || null;
      totalTicks = Number.isInteger(action.tickCost) ? action.tickCost : 1;
      remainingTicks = totalTicks;
      budgetConsumed = false;
    }

    const startedAtTick = nextState.dayTick;
    const resumable = isResumablePlayerAction(action);
    if (!resumable) {
      applyActionEffect(nextState, action);
      if (actor) {
        consumeActorTickBudget(actor, totalTicks);
      }

      for (let i = 0; i < totalTicks; i += 1) {
        nextState = advanceOneTick(nextState);
      }

      processedLogEntries.push({
        actionId: action.actionId,
        actorId: action.actorId,
        kind: action.kind,
        status: 'applied',
        code: null,
        message: 'ok',
        tickCost: totalTicks,
        startedAtTick,
        endedAtTick: nextState.dayTick,
      });
      continue;
    }

    const isFishRodCast = action.kind === 'fish_rod_cast';
    if (!budgetConsumed && actor && !isFishRodCast) {
      consumeActorTickBudget(actor, totalTicks);
      budgetConsumed = true;
    }

    let ticksExecuted = 0;
    let interrupted = false;
    let fishBiteResolved = false;
    while (ticksExecuted < remainingTicks) {
      const currentActor = nextState.actors?.[action.actorId] || null;
      if (!currentActor || (Number(currentActor.health) || 0) <= 0) {
        interrupted = true;
        break;
      }

      if (isFishRodCast) {
        const fishTickOutcome = resolveFishRodTickOutcome(nextState, action, currentActor, ticksExecuted);
        consumeActorTickBudget(currentActor, 1);
        budgetConsumed = true;
        nextState = advanceOneTick(nextState);
        ticksExecuted += 1;
        if (fishTickOutcome?.biteResolved === true) {
          fishBiteResolved = true;
          break;
        }
        continue;
      }

      nextState = advanceOneTick(nextState);
      ticksExecuted += 1;
    }

    const ticksRemaining = Math.max(0, remainingTicks - ticksExecuted);
    if (interrupted && ticksRemaining > 0) {
      if (action.kind === 'dig') {
        const targetX = Number.isInteger(action.payload?.x) ? action.payload.x : null;
        const targetY = Number.isInteger(action.payload?.y) ? action.payload.y : null;
        const canMarkTile = Number.isInteger(targetX)
          && Number.isInteger(targetY)
          && inBounds(targetX, targetY, nextState.width, nextState.height);
        const digTicksRequired = Math.max(1, totalTicks);
        const digTicksCompleted = Math.max(0, digTicksRequired - ticksRemaining);
        const digCompletionRatio = Math.max(0, Math.min(1, digTicksCompleted / digTicksRequired));
        const digProgressSnapshot = {
          ticksRequired: digTicksRequired,
          ticksCompleted: digTicksCompleted,
          ticksRemaining,
          completionRatio: Number(digCompletionRatio.toFixed(4)),
          interrupted: true,
        };

        if (canMarkTile) {
          const tile = nextState.tiles[tileIndex(targetX, targetY, nextState.width)];
          if (tile) {
            tile.disturbed = true;
            tile.lastDigProgress = {
              ...digProgressSnapshot,
              actorId: action.actorId,
              x: targetX,
              y: targetY,
              day: Number(nextState.totalDaysSimulated) || 0,
              dayTick: Number(nextState.dayTick) || 0,
            };
          }
        }

        const digActor = nextState.actors?.[action.actorId] || null;
        if (digActor) {
          digActor.lastDig = {
            x: canMarkTile ? targetX : Number(action.payload?.x) || Number(digActor.x) || 0,
            y: canMarkTile ? targetY : Number(action.payload?.y) || Number(digActor.y) || 0,
            day: Number(nextState.totalDaysSimulated) || 0,
            dayTick: Number(nextState.dayTick) || 0,
            interruptedBySquirrelCache: false,
            ...digProgressSnapshot,
          };
        }
      }

      deferredActions.push(createInProgressActionEnvelope(action, ticksRemaining, totalTicks, budgetConsumed));
      processedLogEntries.push({
        actionId: action.actionId,
        actorId: action.actorId,
        kind: action.kind,
        status: 'interrupted',
        code: 'actor_unavailable',
        message: 'action interrupted; progress preserved for later resume',
        tickCost: totalTicks,
        ticksExecuted,
        ticksRemaining,
        startedAtTick,
        endedAtTick: nextState.dayTick,
      });
      continue;
    }

    if (!isFishRodCast) {
      applyActionEffect(nextState, action);
    }
    processedLogEntries.push({
      actionId: action.actionId,
      actorId: action.actorId,
      kind: action.kind,
      status: 'applied',
      code: null,
      message: fishBiteResolved ? 'ok (bite_resolved_early)' : 'ok',
      tickCost: isFishRodCast ? ticksExecuted : totalTicks,
      ticksExecuted,
      startedAtTick,
      endedAtTick: nextState.dayTick,
    });
  }

  nextState.pendingActionQueue = sortActionsDeterministically(deferredActions);

  for (let i = 0; i < idleTicks; i += 1) {
    nextState = advanceOneTick(nextState);
  }

  nextState.currentDayActionLog = [
    ...(nextState.currentDayActionLog || []),
    ...processedLogEntries,
  ];

  return nextState;
}
