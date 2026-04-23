# State Update Safety (React + Sim Core)

## Why this exists

The simulation now mutates the input state object in place by default (for speed and simplicity inside sim code).
In React development mode, state updater functions can be invoked more than once to detect side effects.
If an updater passes the previous React state object directly into mutating sim functions, one UI action can apply twice.

This caused a real bug where a single tech vision choose resulted in two unlock grants.

## Current architecture note (game store)

The app now uses a central external store (`src/game/gameStore.mjs`) and React subscribes to it.
In this setup, React is **not** passing a `prev` React state object into sim mutation functions, so the old
`setGameState((prev) => ...)` clone boundary is no longer required for normal gameplay UI updates.

## Rule

If you are calling mutating sim functions from a React state updater like `setGameState((prev) => ...)`,
**clone `prev` first**.

Mutating sim functions include (not exhaustive):
- `advanceTick(...)`
- `advanceDay(...)`
- and most other sim helpers in `src/game/simCore.mjs` (generation functions, etc.)

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

## Pure/clone boundaries (tests + snapshots)

The default sim entry points are mutating. When you need “before/after” comparisons (snapshots, regression fixtures),
clone explicitly first (or use the `*Pure` wrappers when available).

Examples:

```js
// Explicit clone boundary
const copy = deserializeGameState(serializeGameState(state));
advanceTick(copy, { actions: [...] });
```

```js
// Pure wrapper boundary (if imported)
const next = advanceTickPure(state, { actions: [...] });
```

## Preferred pattern (store-backed UI)

When working in the main app UI, prefer calling the store dispatch wrappers (which emit a single refresh event):
- `advanceTickAndEmit(...)`
- `advanceDayAndEmit(...)`

These live in `src/game/gameStore.mjs` and are exposed to React via `src/ui/useGameStore.js`.

## Code review checklist (AI + human)

- Any new `setGameState((prev) => ...)` path that calls sim mutation functions must clone first.
- Do not pass `prev` directly to `advanceTick` / `advanceDay`.
- If adding new mutating sim entry points, document them here and enforce the same rule.

## Performance note

This clone is a defensive boundary at the React layer. It adds overhead proportional to state size.
That overhead is acceptable for correctness in the current app architecture, especially in development mode.
If performance becomes a concern, preferred long-term direction is to avoid React state updaters that hand a mutable
reference into sim code (use the store), and use explicit clone boundaries only where needed (tests/snapshots).
