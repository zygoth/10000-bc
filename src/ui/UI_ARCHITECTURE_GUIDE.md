# 10,000 BC — UI Architecture Guide
*For AI-assisted development. Read this before writing any UI code.*

---

## What This Document Is

This guide defines how UI code is structured in this project. It exists because AI assistants tend to blend display logic and rendering into single components, which makes testing nearly impossible. Every UI task — new screen, new component, bug fix, refactor — must follow this pattern.

If you are implementing a UI feature, this document takes precedence over any general React conventions you might default to.

---

## The Core Rule

**Display logic and rendering are always separated.**

A React component has exactly one job: take prepared data and turn it into JSX. It does not sort, filter, calculate, or make decisions. All of that happens in plain JS functions before the component is involved.

This rule exists because:
- Plain JS functions are trivially testable without a DOM or renderer
- Components that only render are easy to read and hard to break
- Bugs almost always live in the logic, not the JSX — so that's what needs test coverage

---

## The Two-Layer Structure

Every UI feature consists of two layers. Each lives in a separate file.

```
src/ui/{feature}/
  {feature}DisplayLogic.js   ← Layer 1: pure functions, no React
  {feature}Panel.jsx         ← Layer 2: renders prepared data, calls advanceTick on events
```

### Layer 1 — Display Logic (`{feature}DisplayLogic.js`)

Pure functions that transform `gameState` into "view model" objects — exactly what the UI needs, shaped for rendering.

Rules:
- No React imports
- No side effects
- Same input always produces same output
- Every non-trivial function gets a corresponding test

```javascript
// ✅ Correct — pure function, returns shaped data
export function getInventoryDisplayItems(gameState) {
  return [...gameState.player.inventory]
    .sort((a, b) => b.spoilage - a.spoilage)
    .map(item => ({
      ...item,
      spoilageDisplay: getSpoilageDisplay(item),
      contextActions: getContextActions(item, gameState)
    }))
}

export function getSpoilageDisplay(item) {
  if (item.spoilage === null) return null
  if (item.spoilage >= 0.8) return { severity: 'critical', label: 'Spoils tonight' }
  if (item.spoilage >= 0.5) {
    const days = Math.ceil((1 - item.spoilage) / 0.15)
    return { severity: 'warning', label: `Spoils in ${days} days` }
  }
  return null
}
```

### Layer 2 — Component (`{feature}Panel.jsx`)

A React component that calls Layer 1 to get its data, renders it, and calls `advanceTick` directly on user events. Contains no logic of its own.

Rules:
- Calls display logic functions at the top of the component body
- No sorting, filtering, or conditionals based on raw game state — only on prepared view model data
- No inline calculations
- Event handlers call `advanceTick(gameState, { type, ...payload })` directly and pass the result up via `onStateChange`
- Pure UI state (open/closed panel, active tab, drag state) lives in `useState` — it has no game logic meaning and never touches `advanceTick`

```jsx
// ✅ Correct — dumb component, calls advanceTick directly for game actions
import { useState } from 'react'
import { getInventoryDisplayItems } from './inventoryDisplayLogic.js'
import { advanceTick } from '../../gameLogic/engine.js'

export function InventoryPanel({ gameState, onStateChange }) {
  const [isOpen, setIsOpen] = useState(false)  // pure UI state — useState only
  const items = getInventoryDisplayItems(gameState)

  return (
    <div className="inventory-panel">
      {items.map(item => (
        <InventoryItem
          key={item.id}
          item={item}
          onFieldButcher={() => onStateChange(
            advanceTick(gameState, { type: 'FIELD_BUTCHER', itemId: item.id })
          )}
        />
      ))}
    </div>
  )
}

// ❌ Wrong — sorting and label logic inside component
export function InventoryPanel({ gameState, onStateChange }) {
  const items = [...gameState.player.inventory]
    .sort((a, b) => b.spoilage - a.spoilage)  // ← belongs in displayLogic
    .map(item => ({
      ...item,
      label: item.spoilage > 0.8 ? 'Spoils tonight' : ''  // ← belongs in displayLogic
    }))
  // ...
}
```

---

## Test File Structure

Every feature folder includes a test file. Tests cover display logic only — components are not tested directly, and `advanceTick` actions are covered by the game logic test suite, not here.

```
src/ui/{feature}/
  {feature}DisplayLogic.js
  {feature}Panel.jsx
  {feature}.test.js          ← tests displayLogic only, never mounts a component
```

Test file structure:

```javascript
// {feature}.test.js
import { getFunctionName } from './{feature}DisplayLogic.js'
import { buildTestState } from '../../tests/fixtures/stateBuilder.js'

describe('{feature} display logic', () => {
  test('describe the specific behavior being tested', () => {
    const state = buildTestState({ /* minimal relevant state */ })
    const result = getFunctionName(state)
    expect(result).toEqual(/* expected output */)
  })

  test('boundary value — spoilage exactly at threshold', () => {
    const state = buildTestState({ player: { inventory: [{ spoilage: 0.8 }] } })
    const result = getFunctionName(state)
    expect(result.spoilageDisplay.severity).toBe('critical')
  })
})
```

### Test Fixtures

All tests build state from `stateBuilder.js`, never from hand-rolled objects. The builder provides defaults for every field so tests only specify what's relevant to them.

```javascript
// tests/fixtures/stateBuilder.js
export function buildTestState(overrides = {}) {
  return {
    player: {
      inventory: [],
      location: { type: 'field', tileId: 'tile_50_50' },
      ticksSpent: 0,
      passedOut: false,
      ...overrides.player
    },
    family: [],
    stockpile: [],
    calendar: { tick: 0, day: 1, season: 'spring', epoch: 1, ...overrides.calendar },
    ...overrides
  }
}
```

---

## What to Test vs. What to Skip

**Always test (display logic):**
- Sort order of display items (spoilage, spoilage alerts, queue order)
- Conditional logic in context menus (location-dependent options, tool requirements)
- Spoilage display thresholds — test exact boundary values (0.5, 0.8), not just obvious cases
- Nutrition preview calculations (calorie totals, threshold flags, variety labels)
- Warning states (critical vs. warning vs. null)
- Any branching based on player location (field vs. camp)

**Don't test here — covered elsewhere:**
- Tick costs and state transitions from `advanceTick` actions — these belong in the game logic test suite
- Pure UI state (panel open/closed, active tab) — no logic to test

**Always skip:**
- Whether a className is correct
- Whether a button label string is spelled right
- Component render snapshots
- Anything that requires mounting a React component

---

## Migration Pattern

When refactoring an existing blended component, do it in this order:

1. **Extract display logic first.** Identify every sort, filter, map, and conditional inside the component body. Move each to a named function in `{feature}DisplayLogic.js`. Do not change behavior — just move it.

2. **Write tests for what you extracted.** Before touching the component, write tests for each extracted function. If a test fails, the original component had a bug — fix it in the logic layer, not the component.

3. **Slim the component.** Replace the original logic in the component body with a call to the display logic function at the top. Event handlers should call `advanceTick` directly. Anything that was tracking UI-only state (active tab, panel visibility) moves to `useState`.

4. **Verify no behavior changed.** Run existing tests. If the component was previously tested with a DOM renderer, those tests should still pass.

---

## Common Mistakes to Avoid

**Putting location-dependent logic in the component:**
```javascript
// ❌ Wrong
{gameState.player.location.type === 'camp' && <button>Submit for Research</button>}

// ✅ Correct — the view model carries this decision
{item.contextActions.includes('submit_research') && <button>Submit for Research</button>}
```

**Deriving display values inline:**
```javascript
// ❌ Wrong
<span>{item.spoilage >= 0.8 ? 'Spoils tonight' : `Spoils in ${days} days`}</span>

// ✅ Correct
<span>{item.spoilageDisplay.label}</span>
```

**Writing tests that render components:**
```javascript
// ❌ Wrong — slow, brittle, tests the wrong thing
const { getByText } = render(<InventoryPanel gameState={state} />)
expect(getByText('Spoils tonight')).toBeInTheDocument()

// ✅ Correct — fast, direct, tests the actual logic
expect(getSpoilageDisplay({ spoilage: 0.85 }).label).toBe('Spoils tonight')
```

**Skipping tests because the logic "seems simple":**

Spoilage threshold logic seems simple. Context menu availability seems simple. These are exactly the cases that break silently when game state shape changes. Test them anyway.

---

## Checklist: Before Submitting Any UI Code

- [ ] Display logic lives in `{feature}DisplayLogic.js`, not in the component
- [ ] Component body contains no sorting, filtering, or inline calculations
- [ ] Event handlers call `advanceTick` directly — no wrapper functions in between
- [ ] Pure UI state (panel open/closed, active tab) uses `useState`, nothing else
- [ ] Test file exists and covers all display logic functions
- [ ] Tests include boundary values for any threshold logic
- [ ] Tests use `buildTestState()` fixtures, not hand-rolled state objects
- [ ] No test mounts a React component
- [ ] All tests pass before marking task complete
