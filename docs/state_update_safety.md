# State Update Safety (React + Sim Core)

## Why this exists

The simulation mutates the input state object in place in several core paths (for speed and simplicity inside sim code).
In React development mode, state updater functions can be invoked more than once to detect side effects.
If an updater passes the previous React state object directly into mutating sim functions, one UI action can apply twice.

This caused a real bug where a single tech vision choose resulted in two unlock grants.

## Rule

When calling mutating sim functions from `setGameState((prev) => ...)`, **clone `prev` first**.

Mutating sim functions include (not exhaustive):
- `advanceTick(...)`
- `advanceDay(...)`

## Required pattern

Use this helper in `src/App.js`:

```js
function cloneGameStateForUpdate(state) {
  return deserializeGameState(serializeGameState(state));
}
```

Then:

```js
setGameState((prev) => {
  const safePrev = cloneGameStateForUpdate(prev);
  return applyAutoUnlockGenerations(advanceTick(safePrev, { actions: [...] }));
});
```

Do the same for `advanceDay`.

## Code review checklist (AI + human)

- Any new `setGameState((prev) => ...)` path that calls sim mutation functions must clone first.
- Do not pass `prev` directly to `advanceTick` / `advanceDay`.
- If adding new mutating sim entry points, document them here and enforce the same rule.

## Performance note

This clone is a defensive boundary at the React layer. It adds overhead proportional to state size.
That overhead is acceptable for correctness in the current app architecture, especially in development mode.
If performance becomes a concern, preferred long-term direction is to make sim entry points pure (no input mutation), then remove this defensive clone.
