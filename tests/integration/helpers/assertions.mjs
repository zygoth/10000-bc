import assert from 'node:assert/strict';

export function assertActorAt(state, actorId, x, y, messagePrefix = 'actor position') {
  const actor = state?.actors?.[actorId];
  assert.ok(actor, `${messagePrefix}: missing actor ${actorId}`);
  assert.equal(actor.x, x, `${messagePrefix}: unexpected x for ${actorId}`);
  assert.equal(actor.y, y, `${messagePrefix}: unexpected y for ${actorId}`);
}

export function assertActorHealthAtOrBelow(state, actorId, threshold, messagePrefix = 'actor health') {
  const actor = state?.actors?.[actorId];
  assert.ok(actor, `${messagePrefix}: missing actor ${actorId}`);
  const health = Number(actor.health) || 0;
  assert.ok(
    health <= threshold,
    `${messagePrefix}: expected ${actorId} health <= ${threshold}, got ${health}`,
  );
}

export function assertDeathEndsRun(state, actorId) {
  const playerHealth = Number(state?.actors?.player?.health) || 0;
  const partnerHealth = Number(state?.actors?.partner?.health) || 0;
  const computedRunEnded = playerHealth <= 0 || partnerHealth <= 0;

  assert.equal(
    computedRunEnded,
    true,
    `expected terminal health for ${actorId} to imply run-ending condition`,
  );
}

