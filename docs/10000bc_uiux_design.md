# 10,000 BC — UI/UX Design Document
*Working Draft — Functional Design Only (Aesthetics Deferred)*

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Screen Inventory & Navigation Map](#2-screen-inventory--navigation-map)
3. [The Foraging HUD](#3-the-foraging-hud)
4. [Tile Interaction & Context Menu](#4-tile-interaction--context-menu)
5. [Inventory Panel](#5-inventory-panel)
6. [Plant Inspect Panel](#6-plant-inspect-panel)
7. [Nature Sight Overlay System](#7-nature-sight-overlay-system)
8. [Camp View & Camp Tile Interactions](#8-camp-view--camp-tile-interactions)
9. [The Nightly Debrief Screen](#9-the-nightly-debrief-screen)
10. [Task Queue Panel](#10-task-queue-panel)
11. [Meal Planning Panel](#11-meal-planning-panel)
12. [Plant Library](#12-plant-library)
13. [Tech Forest](#13-tech-forest)
14. [Status & Warning Systems](#14-status--warning-systems)
15. [Day Flow: A Complete Annotated Session](#15-day-flow-a-complete-annotated-session)
16. [Open Questions & Unresolved Decisions](#16-open-questions--unresolved-decisions)

---

## 1. Design Philosophy

### 1.1 Core Tensions the UI Must Resolve

This game creates several tensions that the UI must manage simultaneously:

**Time scarcity vs. information richness.** Every tick spent reading a tooltip is a tick not spent moving. The UI must surface relevant information quickly without requiring the player to dig — but it must never dump information unprompted. The default state is minimal; detail is always one click away.

**Real knowledge vs. in-game knowledge.** A player who actually knows plants should be able to act on that knowledge before the game confirms it. The UI should never gatekeep what the player *can see* — only what the game has *confirmed*. Botanical sprites in full detail always; nutritional data only after identification. This is a feature, not a restriction.

**Spatial attention vs. status monitoring.** The player is navigating a world and also monitoring three health bars for up to six people. Most of the time the family is fine and the HUD should recede. When something needs attention, it should demand it clearly without obscuring the world.

**Daily decisions vs. long-horizon planning.** Each day is a sequence of small spatial decisions. Each night is a planning session that sets the direction for the next day and the weeks ahead. These are different cognitive modes. The UI should support context-switching — transitioning from a spatial, reactive mode during the day to a deliberate, analytical mode at night.

### 1.2 Interaction Model

The game uses a simple two-button click model on the isometric world:

- **Left-click** any tile: move there (pathfinding). Left-click always means move, regardless of what's on the tile. Plants, items, and stations are not a barrier to movement.
- **Right-click** any adjacent tile: open the action menu / inspect panel for that tile. All non-movement interactions — harvest, inspect, dig, trap, collect, etc. — are initiated via right-click.
- **Keyboard hotkeys** for frequent actions (see §3.6)

No drag-and-drop in the field. Drag-and-drop is available in the inventory panel and debrief screens where the player has time to deliberate.

### 1.3 Information Layers (Progressive Disclosure)

Everything in the UI follows this hierarchy:

| Layer | When shown | Examples |
|---|---|---|
| Ambient | Always visible, no interaction | HUD bars, tick counter, scent particles |
| Hover | On mouseover, no cost | Tile name, plant sprite tooltip |
| On-demand | After right-click, free | Inspect panel, context menu |
| Timed / Urgent | Triggered by game state | Warning banners, night threshold flash |
| Full-screen | Player navigates to | Debrief, Plant Library (from camp) |

---

## 2. Screen Inventory & Navigation Map

```
┌─────────────────────────────────────────────┐
│           FORAGING VIEW (default)           │
│  Isometric world + HUD overlay              │
│                                             │
│  → [Tab] Inventory panel (slides in)        │
│  → [Right-click] Inspect panel (slides in)  │
│  → [N] Nature Sight overlay toggle          │
│  → [Esc] Pause menu                         │
│  → Enter camp → Camp View mode (same screen)│
│  → End of day → Nightly Debrief (full screen│
└─────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│           NIGHTLY DEBRIEF                   │
│  Full-screen, four tabs:                    │
│    Summary | Queue | Meal | Vision           │
│                                             │
│  → [Begin Day button] → back to Foraging    │
└─────────────────────────────────────────────┘
         │
         (Plant Library accessible from camp
          context menu at any time, not debrief)
```

There are no interstitial loading screens during normal play. The transition from Foraging to Debrief is triggered when the player enters the camp area and selects "End Day" — or when their tick budget is exhausted while in camp. Camp View is not a separate screen; it is the foraging view with the camera over the camp tiles and a different set of available context menu actions.

---

## 3. The Foraging HUD

The HUD must be readable at a glance during active movement. Every element shown at rest must be justifiable — if it doesn't change the player's immediate decision, it should only appear on demand.

### 3.1 HUD Layout

```
┌────────────────────────────────────────────────────────────────────────────┐
│  [FAMILY STATUS — left edge]      [DAY INFO — top center]   [TOOLS — right]│
│                                                                            │
│  ● Player   ████░░  H                                                      │
│             ████░░  T      Season: Summer, Day 4     [Inventory tab]       │
│             ████░░  ♥      Epoch 2 / Year 6                               │
│                            Day Progress: ████████░░░░  tick 140/400       │
│  ● Partner  ████░░  H      Your Budget:  ████████░░░░  60/200 remaining   │
│             ████░░  T                                                      │
│             ████░░  ♥      [Night threshold marker at tick 200]            │
│                                                                            │
│  ● Child 1  ████░░  ♥      [SCENT PANEL — bottom left, toggleable]        │
│  (camp only)                                                               │
│                            [WIND INDICATOR — ambient particles, always]   │
│                                                                            │
│  [NATURE SIGHT: 2 days remaining] (only when active)                      │
└────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Family Status Section (Left Edge)

Each family member gets one row. The row contains:

- **Portrait icon** (small, indicates role: Player / Partner / Child)
- **Three micro-bars** stacked vertically: Hunger (H), Thirst (T), Health (♥)
- **Color logic:** Each bar is independent. Green = above 50%. Yellow = 25–50%. Orange = 10–25%. Red = below 10%.
- **Warning state:** When any bar goes yellow, the portrait icon pulses once and the bar label flashes. It does not repeat — the pulse is a one-time notification, not an ongoing animation. Ongoing status is readable from the bar colors alone.
- **Camp members:** Partner and children show only their health bar's worst-status color as a single dot, not individual bars — they are not in danger of field injury and the player has limited ability to act on their status mid-day anyway. Full three-bar breakdowns appear in the debrief.
- **Player** always shows all three bars explicitly because the player *can* act on them in the field (eat, drink, apply medicine).

**Rationale:** The player's own bars are the actionable ones. Partner and child bars are monitoring data, not decision triggers during the day. Compressing partner/child to a single status dot reduces HUD noise without losing safety information.

### 3.3 Day Progress & Tick Budget

Two bars displayed together in the top center:

**Day Progress bar:** Shows the global tick counter 0–400. A small marker at the darkness threshold (which shifts by season) shows when night begins. This bar is decorative/planning information — it tells the player where the day is, not what they can do.

**Your Budget bar:** Shows the player's personal remaining tick budget. This is the actionable number. When it hits zero the bar outline turns red (overdraft mode). Numbers displayed: remaining / base (e.g., "60 / 200").

**Overdraft indicator:** When the player goes into overdraft, the budget number shows in red with a minus sign (e.g., "-12 overdraft"). A brief tooltip on hover explains the carryover penalty.

**Night threshold marker:** A small notch on the Day Progress bar at the darkness threshold tick. As the day approaches it, the notch pulses once to draw attention. When the global tick crosses it, the screen edges darken slightly (vignette) as the ambient darkness effect begins.

### 3.4 Season & Epoch Display

A compact text block: "Summer · Day 4 · Epoch 2" — always visible, never intrusive. On hover, a small tooltip shows: days until season change, full year context.

### 3.5 Scent Panel (Toggleable)

A circular panel anchored bottom-left. Toggled with a hotkey (default: S). When active:

- Particles drift through the panel in the direction wind is blowing from
- Each particle is the 8×8 pixel scent icon for its source plant
- Particle color derived from plant family
- Hovering a particle: if identified, shows plant name + current sub-stage
- If unidentified: shows "Unknown Plant" with the field_description scent note (e.g., "a faint bitter, carroty smell")

The panel is persistent — closing it doesn't require a tick. It's purely ambient information.

### 3.6 Keyboard Shortcuts

| Key | Action |
|---|---|
| Click tile | Move (pathfinding) / context menu |
| Right-click | Inspect tile (free, no tick cost) |
| Tab | Toggle inventory panel |
| S | Toggle scent panel |
| N | Toggle Nature Sight overlay (only when active) |
| H | Repeat last harvest action on current tile (e.g. re-harvest berries from the same sub-stage). Only works if the previously harvested part/sub-stage is still available on this tile. Opens the context menu if it cannot match. |
| I | Inspect (current tile, 1 tick) |
| D | Dig (current tile) |
| F | Fish (current adjacent water tile, opens tick input) |
| E | Eat (opens quick-eat: shows top 3 most calorie-dense items in inventory) |
| Esc | Pause / options menu |
| Backspace | Undo last move (if no action taken yet this tick) |

**Design note on H (Harvest):** When the player presses H on a tile with multiple harvestable parts, the game picks the most recently harvested part type on that plant (or the highest calorie part if no history). A confirmation badge appears briefly showing what was harvested. This is a speed optimization for repeat harvesting.

---

## 4. Tile Interaction & Context Menu

### 4.1 Left-Click Behavior

Left-clicking any tile moves the player there (pathfinding). If the budget is fully spent, the bar flashes red briefly. Right-clicking an adjacent tile opens the action/inspect menu for that tile. The context menu is small — max 6 items — and disappears on any click outside it or on Esc.

### 4.2 Context Menu Structure

The context menu is a vertically stacked list of available actions. Each item shows:

- Action name
- Tick cost (small, greyed)
- Availability — unavailable actions are shown greyed with a one-word reason ("No knife", "No stool", "Budget gone")

**Showing unavailable actions** is a deliberate choice. The player needs to learn what tools unlock what. Hiding actions entirely prevents this learning. Greyed actions with reasons are tutorial and reminder in one.

**Action ordering within the context menu:**

1. Most probable action first (Harvest > Inspect for known edible plants; Inspect > Harvest for unknowns)
2. Collect / Pick Up
3. Dig (if tile has underground indicators — soft soil, root crown visible)
4. Secondary actions (Set Trap, Tap, etc.)
5. Drop item (always last, least likely to be accidental)

**Action ordering note:** If this is the first time the player has interacted with a plant, Inspect is listed first. If the player has harvested this plant before, Harvest leads. This is just list ordering — the player always chooses from the full menu.

### 4.3 Inspect (Right-Click)

Right-clicking any tile you are adjacent to opens the inspect panel at no tick cost. This is always free — there is no paid Inspect action. The player must be on an adjacent tile; right-clicking a distant tile has no effect (or could show a "move closer to inspect" hint). The inspect panel slides in from the right edge.

### 4.4 Multi-Part Plants: Part Selection

When a plant has multiple harvestable parts, each part is listed separately in the context menu. The player always chooses explicitly — there is no auto-selection of a "most likely" part. For example:

- "Harvest Leaves (1 tick)"
- "Harvest Berries — ground reach (1 tick) / +3 out of reach (stool needed)"

The split reach display from the GDD is surfaced here: the player sees available and inaccessible yields before committing. They can see that bringing a stool tomorrow would extend the harvest.

### 4.5 Tile Item Drops

If a tile has a dropped item, it appears in the context menu as:

- "Pick Up [Item Name] (1 tick)"

It is shown before the tile's plant actions, since the player explicitly dropped it there and is likely returning for it.

### 4.6 Auto-Rod / Trap Check

Auto-rods and traps show a visual state indicator above their tile sprite: a small icon indicating Live / Triggered / Broken state. This is visible without clicking — the player can scan their trap line while walking past. Clicking opens:

- State details
- "Check / Collect (2 ticks)" if triggered
- "Re-bait (2 ticks)" if escape or broken
- "Repair (5 ticks)" if broken

---

## 5. Inventory Panel

### 5.1 Opening & Layout

The inventory panel is a slide-in panel triggered by Tab or a button in the HUD. It does not require spending ticks to open. Opening and closing is instantaneous.

The panel occupies the right side of the screen and covers the world view. The family status bars and day progress bars remain visible (anchored to the top/left edges outside the panel area).

```
┌──────────────────────────┐
│ INVENTORY         [X]    │
│ Weight: 8.2 / 15 kg      │
│                          │
│  ┌──┬──┬──┬──┬──┬──┐     │
│  │  │  │  │  │  │  │     │
│  ├──┼──┼──┼──┼──┼──┤     │
│  │  │  │  │  │  │  │     │
│  ├──┼──┼──┼──┼──┼──┤     │
│  │  │  │  │  │  │  │     │
│  ├──┼──┼──┼──┼──┼──┤     │
│  │  │  │  │  │  │  │     │
│  └──┴──┴──┴──┴──┴──┘     │
│                          │
│  EQUIPMENT               │
│  [Head: —]  [Torso: —]   │
│                          │
│  TOOLS AVAILABLE:        │
│  Digging Stick | Knife   │
│  Stool | Basket          │
└──────────────────────────┘
```

### 5.2 Slot Behavior

**Hovering a slot:** Shows item tooltip (see §5.3) — no tick cost.

**Clicking a slot:** Opens item context menu:
- Eat (if edible; costs 2 ticks)
- Apply as Poultice (if applicable; costs ticks + cordage)
- Drop (no tick cost; drops to current tile)
- Add to Drying Rack (if at camp)
- Add to Stockpile (if at camp)
- Process (if processable; shows sub-menu with options)
- Submit for Research (right-click in inventory, only when at camp with 3+ samples of this plant)

**Weight display:** The total weight bar at the top of the panel turns yellow at 80% and red at 95%. A 2-kg per-slot visual indicator (a thin bar under each slot) shows if any individual slot is near its per-slot cap — relevant for bulk materials.

### 5.3 Item Tooltip

Tooltip appears on hover:
- Item name (common name if identified, "Unknown [Plant Type]" if not)
- Weight (total stack weight, e.g., "480g — 12 × 40g pods")
- Spoilage: shown at day granularity — "Spoils tonight", "Spoils in 2 days", "Fresh". Drying items show "Drying: 60% — ~1 day remaining"
- Edibility / field notes (field_description always; game_description if identified)
- Quick-action hint: "Press E to eat" or "H to use as harvest tool"

**Spoilage sorting note:** Items are not auto-sorted by spoilage in the inventory grid during the day. That sorting only applies to the stockpile view at debrief. The field inventory is the player's working pile.

### 5.4 Basket Overflow Area

When a basket is equipped, an additional 1×8 row appears below the main grid labeled "BASKET OVERFLOW." The main grid shows the 2×2 basket footprint as greyed slots with a basket icon. Items in the overflow row work identically to main grid slots.

### 5.5 Sled Inventory

When a sled is attached, a second grid appears in the panel below the main inventory, labeled "SLED." The player can drag items between grids to load/unload. (Drag-and-drop is available in the inventory panel — just not in the world.)

---

## 6. Plant Inspect Panel

### 6.1 Panel Structure

The inspect panel slides in from the right and shows information in layers based on identification status. It is opened by right-clicking an adjacent tile at no tick cost.

```
┌─────────────────────────────────────┐
│ [BOTANICAL SPRITE — large]          │
│                                     │
│ Unknown Plant                       │
│   or                                │
│ Cattail (Typha latifolia)           │
│                                     │
│ ─── FIELD NOTES ─────────────────── │
│ Tall emergent plant, flat ribbon    │
│ leaves. Dense brown sausage-shaped  │
│ spike. Rhizomatous — look for the   │
│ root crown in the mud.              │
│                                     │
│ ─── ACTIVE PARTS ─────────────────  │
│ [only if identified]                │
│                                     │
│ ► Pollen Head (mid_spring)          │
│   120 cal/100g · Fat 0.5g           │
│   Raw: yes · Dry: yes               │
│   "Harvest now — window closes soon"│
│                                     │
│ ► Root (year-round)                 │
│   Dig required · Digging stick: 0.6×│
│   200 cal/100g · Starch             │
│   "Best in fall and winter"         │
│                                     │
│ ─── REACH ──────────────────────── │
│ Ground: 4 actions available         │
│ Elevated: 3 actions (stool needed)  │
│                                     │
│ Unidentified: Bring 3 different     │
│ parts back to camp to submit for    │
│ research.                           │
│                                     │
```

### 6.2 Unidentified vs. Identified

**Unidentified:**
- Botanical sprite shown in full detail
- "Unknown Plant" header
- field_description for the plant's current life stage
- field_description for each active above-ground part sub-stage
- No nutritional data, no processing info, no game_description
- inspect panel shows the instructional note: "Bring 3 different parts back to camp to submit for research"

**Identified:**
- Latin + common name header
- game_description as a plant overview (flavor and ecological context)
- For each active part: both field_description and game_description, plus nutritional data, processing options, decay days, and any toxicity note
- Seasonal window indicator per part: "In season", "Season ends in 3 days", "Out of season until early summer"
- Reach breakdown for elevated/canopy parts

### 6.3 Urgency Cues in the Inspect Panel

For identified plants only, the panel shows a time-sensitive nudge if a part's seasonal window closes within 3 days: "⚠ Harvest soon — window closes in 2 days." No other status cues are shown.

---

## 7. Nature Sight Overlay System

### 7.1 Activation & Duration

Nature Sight is granted by vision events (see §11.3). When active, a persistent indicator appears in the HUD: "Nature Sight: 2 days remaining."

On the first morning it's active, the player receives a prompt to choose their overlay for the day. This is a deliberate choice, not automatic — the player should think about what they need.

### 7.2 Overlay Selection

A small in-world popover (not full-screen) shows five options:

| Overlay | What it shows |
|---|---|
| Calorie Heatmap | Tile-level calorie density — red = high value, blue = low |
| Animal Density | Movement corridors and territory zones |
| Mushroom Zones | Highlighted tiles with fungal colonization potential |
| Plant Compatibility | For each tile, whether current species thrive or struggle (soil match) |
| Fishing Hotspots | Water tile productivity by season |

The player picks one. It's active for the day. Soil fertility and pH data becomes readable on all tile hovers while any overlay is active.

### 7.3 Overlay Rendering

Overlays are color washes on top of the tile diamond — semi-transparent, not obscuring the plant sprites. The world remains navigable. The overlay is a planning tool, not a mode that changes interaction.

### 7.4 Nature Sight Is a Planning Mode

The design intent is that Nature Sight turns a foraging day into a scouting/analysis day. The player is likely to move more slowly, read more tile hovers, and make notes. The UI supports this by expanding the hover tooltip automatically when Nature Sight is active to include soil fertility, pH, drainage, and any other soil properties — no additional click required. These are shown for every tile regardless of which overlay is currently selected.

---

## 8. Camp View & Camp Tile Interactions

### 8.1 Camp View

When the player enters the 3×3 camp tiles, the camera centers on the camp area. There is no mode switch — it's the same isometric view, same HUD, same input model. The difference is that camp tiles have different available context actions.

### 8.2 Camp Tile Context Menus

**Wigwam tile:**
- Open Stockpile (opens stockpile panel)
- Transfer items to/from stockpile (see §8.3)
- Cooking and fire are handled inside the wigwam by the partner automatically — no direct player interaction needed on the wigwam tile for those purposes

**Drying Rack tile:**
- Add item (from inventory, 1 tick)
- Remove item (1 tick)
- Inspect: shows all 4 slots, dryness progress, estimated days to fully dried

**Other stations (workbench, thread spinner, hide frame, etc.):**
- Current task: who's working, estimated ticks remaining
- Start task (if player is at camp and wants to use remaining budget here)
- (Partner task assignment happens at debrief, not inline)

**General camp tile:**
- Build Station (if unlocked and materials present) — opens a sub-menu of buildable stations with material requirements and tick costs shown inline

### 8.3 Stockpile Panel

The stockpile opens when the player right-clicks the wigwam tile (or from the debrief). When open, the player's inventory and the stockpile are shown side by side. Items are transferred by clicking the item in either panel and choosing "Move to Stockpile" or "Move to Inventory" — or by holding a modifier key and clicking to quick-transfer. The player can also move partial stacks using a quantity input that appears when transferring stackable items. Weight and slot limits are enforced live; the button is greyed if a transfer would exceed capacity.

The stockpile panel is also the full-screen view in the debrief. It shows:

- All items grouped by category (Food, Materials, Tools)
- Sort options: by spoilage (default at debrief), by weight, by category
- Items flagged for spoilage (will hit decay 1.0 before next debrief) have a red clock icon
- Drag to rearrange (at debrief); click-to-interact (in field)

---

## 9. The Nightly Debrief Screen

The debrief is the game's planning headquarters. It is full-screen and has no time pressure — the player can spend as long as they want here. The transition from day to debrief should feel like settling in by the fire.

### 9.1 Entry

The debrief is triggered when the player selects "End Day" while inside the camp tiles. The "End Day" button only appears in the HUD when the player is within the camp area — it is not accessible from the field. If the player's budget hits zero in the field, the pass-out mechanic resolves first and they are returned to camp before the debrief opens.

### 9.2 Tab Structure

The debrief has four tabs, laid out across the top:

```
[ Summary ] [ Queue ] [ Meal ] [ Vision ]
```

On first open each night, the player always starts on **Summary**. A red dot appears on tabs that have unresolved items (e.g., a spoilage alert visible on Meal, a pending vision choice on Vision).

### 9.3 Summary Tab

The Summary tab shows current household status — it is not a day recap, but a starting point for planning the night.

**Family status:** Full three-bar breakdown for all members. If any bar is in the orange or red zone, a plain warning appears beneath that member's row: "Hunger critical" or "Thirst low." No prescriptive text.

**Partner discoveries:** A small botanical sprite card for each plant the partner completed research on today — now showing the plant's name for the first time. If no research completed: "No research completed today."

**Spoilage alerts:** Any stockpile item that will fully spoil before the next debrief is listed here by name.

**Overdraft notice** (if applicable): "You overworked today — tomorrow starts at tick [N]."

### 9.4 Navigating Between Tabs

The Begin Day button is visible in the bottom-right corner of the debrief screen. Red dot alerts on tabs are cleared when the player visits that tab.

**Meal tab gate:** The Begin Day button is inactive until the player has visited the Meal tab at least once that night. If the player tries to click it before visiting Meal, the button is greyed with a brief note: "Review tonight's stew first."

**Ticks-remaining confirmation:** If the player still has tick budget remaining when they open the debrief, clicking Begin Day shows a single confirmation: "You have [N] ticks remaining. End the day?" Accept or Cancel. This only fires once — if they dismiss and spend more ticks before pressing Begin Day again, the dialog reflects the updated remaining amount.

---

## 10. Task Queue Panel

This is the Queue tab of the debrief. It is the player's primary lever for managing the partner (and children in later epochs).

### 10.1 Queue Layout

```
┌────────────────────────────────────────────────────────────┐
│ TASK QUEUE                              [Clear All]        │
│                                                            │
│  Today's worker budget:                                    │
│  Partner: ~180 ticks available (after camp maintenance)    │
│  Child 1 (age 10): ~120 ticks available                    │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 1. Research: [🌿 sprite] Unidentified plant [Partner only] 75 ticks│   │
│  │    ████████░░░░░░  Progress: 40%  (~45 ticks left)  │   │
│  │    [↑] [↓] [✕]                                      │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ 2. Craft: Simple Snare  [Partner / Child]  8 ticks  │   │
│  │    Not started                                       │   │
│  │    [↑] [↓] [✕]                                      │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ 3. Process: Fiber extraction (10× dogbane stalk)    │   │
│  │    [Partner / Child]  ~30 ticks                     │   │
│  │    Not started                                       │   │
│  │    [↑] [↓] [✕]                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                            │
│  Estimated total: ~153 ticks  (within budget)              │
│  ⚠ If all tasks complete, partner/child will idle.        │
│                                                            │
│  [+ Add Task ▼]                                            │
└────────────────────────────────────────────────────────────┘
```

### 10.2 Adding Tasks

Clicking "+ Add Task" opens a grouped picker:

- **Research** — lists all plants in stockpile that can be researched (have 3+ samples). Shows estimated tick cost. Research tasks are marked "[Partner only]." Below the list of queueable plants is a "View Tech Forest" button — this opens the Tech Forest as a full-screen overlay from which the player can browse and queue tech research tasks. Tech research tasks also appear in the queue labeled "[Partner only]" with an estimated tick cost.
- **Crafting** — lists all craftable tools and stations given current stockpile contents. Unavailable recipes are shown greyed with missing materials listed. Clicking a greyed recipe does nothing but hover shows what's missing.
- **Processing** — lists current stockpile items that have processing options (fiber extraction, hide scraping, bone crushing, etc.). Batch size is configurable.
- **Build Station** — lists researchable and already-unlocked stations the player hasn't built, with material requirements.

### 10.3 Queue Rules Surfaced in UI

- Research tasks are labeled "[Partner only]" — visual distinction, and children cannot pull them
- Processing tasks show "[Parallel OK]" if multiple workers can collaborate on them simultaneously
- Crafting/construction tasks show "[One worker]" — only one worker at a time
- The estimated total at the bottom updates live as tasks are added/removed
- If estimated total exceeds combined worker budgets: "⚠ Queue exceeds daily capacity — lower-priority tasks will carry over"

### 10.4 Task Carry-Over

If a task was partially completed the previous day, it shows a progress bar and a "Carry-over" badge. The queue is editable — the player can reprioritize or remove it.

---

## 11. Meal Planning Panel

This is the Meal tab of the debrief. It is the most mechanically complex panel in the game and deserves careful design.

### 11.1 Layout

The panel is split into two halves:

**Left half: Ingredient Selection**

The stockpile's food items are shown here, sorted by spoilage by default (soonest spoiling first). Items flagged for imminent spoilage are highlighted. The player clicks items to add them to the stew.

Items with spoilage alerts show a small red clock. Adding a flagged item to the stew clears the alert in real-time.

Each food item shows:
- Name + quantity available
- Calories per 100g (small)
- Nausea family (small color dot — the player learns to recognize these)

**Right half: Stew Composition & Preview**

The current stew composition is shown as a list of ingredients added. Below it, a live nutritional preview:

```
┌─────────────────────────────────────────────────┐
│ TONIGHT'S STEW                                  │
│                                                 │
│ • Cattail root flour   200g                     │
│ • Rabbit (whole)       800g                     │
│ • Elderberries         150g                     │
│ • Black walnut         100g          [Remove ✕] │
│                                                 │
│ ─── PROJECTED NUTRITION ──────────────────────  │
│ Total calories:  2,840 kcal                     │
│ Protein:         48g  ✓  (threshold met)        │
│ Fat:             22g  ✓  (threshold met)        │
│                                                 │
│ ─── FAMILY HUNGER FILL ──────────────────────── │
│ Player       ████████████ 100%  (was 55%)       │
│ Partner      ████████████ 100%  (was 70%)       │
│ Child 1      ██████████░░  85%  (was 30%)       │
│                                                 │
│ ─── NAUSEA ──────────────────────────────────── │
│ Household    ██░░░░░░░░░░  Low (good variety)   │
│                                                 │
│ ─── BONUSES ─────────────────────────────────── │
│ ✓ Tick bonus: +20 ticks tomorrow (all adults)  │
│ Variety:  Good (4 nausea families)              │
│                                                 │
│ [Commit Stew]                                   │
└─────────────────────────────────────────────────┘
```

### 11.2 Key UX Decisions

**Live preview:** Every change to the stew composition updates all numbers instantly. The player sees cause and effect in real time.

**Hunger fill bars** show current hunger level AND the projected post-stew level. A family member at 30% hunger with projected 85% fill is a satisfying visual. A member who won't reach 70% is an obvious problem.

**Protein/fat threshold indicators** show clearly whether the tick bonus will be granted. They are highlighted in green (✓ threshold met) or red (✗ threshold not met) — the player knows exactly whether tonight's meal earns the bonus.

**Nausea display:** The household nausea bar shows aggregate nausea trend. Below it, a brief note on variety: "Good (4 families)" / "Monotonous (1 family) — nausea will increase." This is the only nausea information the player needs at meal planning time.

**Quantity input:** When adding a stackable item to the stew, a small quantity field appears defaulting to the full available amount. The player can reduce it to add a partial stack — the remainder stays in stockpile. Discrete items use a unit count; bulk items use a weight input. The live preview updates as the quantity changes.

**Spoilage panel integration:** Items near spoilage are shown first and highlighted. When the player adds a spoilage-flagged item to the stew, the flag clears immediately.

**Empty stew option:** The "Commit Stew" button works with a partial or empty stew. An empty stew is a hard resource situation and the game should let the player face it clearly without blocking UI.

### 11.3 Stew Commit

Clicking "Commit Stew" finalizes the meal plan. The confirmed ingredients are flagged in the stockpile as "Reserved for Stew" — the partner will cook them automatically. The player can revisit and change the meal plan at any point before pressing "Begin Day."

---

## 12. Plant Library

### 12.1 Access

The Plant Library is accessible from the camp context menu (right-clicking the wigwam tile, or any camp tile) at any time — during the day or at debrief. It is free to open; no tick cost. It is not part of the debrief tabs.

### 12.2 Layout

A scrollable list/grid of botanical cards for every plant the player has had identified. Each card:

- Botanical sprite (displayed at larger size)
- Common name + Latin name
- Epoch identified
- All parts listed with sub-stage properties: seasonal window, edibility notes, nutrition, processing options
- Medicinal notes (shown regardless of who identified it — represents shared household knowledge)

The library is read-only. Since plant data is surfaced whenever the player inspects a tile, this library is most useful for meal planning reference or cross-checking processing options at camp.

---

## 13. Tech Forest

### 13.1 Access

The Tech Forest is accessible only from the Queue tab's "+ Add Task → Research → View Tech Forest" flow (see §10.2). It is a full-screen overlay that opens over the debrief and returns to the debrief on dismiss.

### 13.2 Layout

A scrollable/pannable graph. All nodes are visible from the start — no fog. Each node shows:

- Tech name
- Research cost (ticks estimate)
- Lock status: "Available", "Locked — requires [prerequisite]", "Researched ✓"

Locked nodes are slightly desaturated but fully readable. The player needs to plan 3–4 nodes ahead.

### 13.3 Category Filter

A filter bar across the top:

```
[All] [Food Acquisition] [Food Processing] [Storage & Transport] [Clothing] [Materials] [Land & Harvest]
```

Active filter highlights matched nodes with a ring. Unmatched nodes remain visible at reduced contrast — full tree structure is always readable.

### 13.4 Queuing Research from the Tech Forest

Clicking a node opens a small info card:
- Full description of the tech's effect
- Prerequisites (linked; clickable to scroll to them)
- Estimated research ticks
- "Add to Queue" button — adds the tech research task to the partner queue and returns focus to the queue

Nodes already queued show a "Queued" badge. Researched nodes show a "Complete ✓" badge.

---

## 14. Status & Warning Systems

### 14.1 Warning Hierarchy

The game uses a three-tier escalation for status warnings:

**Tier 1 — Ambient (bar color change):** Bar drops below 50%. Color change to yellow. No other UI change. Player notices if they're watching.

**Tier 2 — Day-start text (yellow threshold):** When a family member is in the yellow zone, a brief message appears at the start of the following day (after the debrief ends, before the player gets control): "Partner is hungry." One line, dismisses automatically after 3 seconds or on click.

**Tier 3 — Debrief gate (orange threshold):** When any bar hits orange, the Summary tab of the debrief shows a red-bordered alert that cannot be dismissed by navigating away. The player must read it and click "Acknowledge" before the tab badge clears. The Begin Day button still works — the acknowledgment requirement is about ensuring the player saw it, not forcing a specific response.

### 14.2 Night Warning

**10 ticks before the darkness threshold:** The screen edges pulse once (a single flash of the vignette). A small banner appears: "Dusk — returning to camp soon is wise." Disappears after 5 seconds.

**At the threshold:** The vignette darkens permanently. The banner changes to "Night — injury risk now increasing." Stays visible until the player is in camp.

**Dusk/night banners are not alarms** — they are informational. The player might intentionally be working late. The system communicates the state without demanding action.

### 14.3 Spoilage Warnings

At debrief open: items that will fully spoil before the next debrief are highlighted in the stockpile (red clock icon) and listed in the Summary tab. These are actionable at the meal planning stage. No mid-day spoilage warnings — the player can't act on them until the debrief anyway.

### 14.4 Overdraft & Pass-Out

**Overdraft starting:** The budget bar turns red and shows "-N overdraft" when the player exceeds their budget. No sound, no popup — the visual is sufficient. The player is making an intentional choice to push further.

**Pass-out (40+ overdraft ticks in field):** The screen cuts to black briefly. A brief text appears: "You pushed too far — you don't remember getting back to camp." Then the debrief runs normally. The consequence (missing stew, next day starting at tick 40 or 70) is shown in the Summary tab.

**Pass-out in winter without coat:** Immediate game-over screen. This is a dramatic failure state — it should be treated as such. Brief pause, then the death screen with context: "You passed out in the cold without protection. There was no one to bring you home."

### 14.5 Child Birth & Epoch Transitions

Epoch transitions are not a UI crisis — they're a milestone. The transition screen (separate from the game UI) shows:

- The updated landscape overview
- Family composition changes (new child, ages of existing children)
- Stockpile carried forward
- A brief narrative caption

This is a moment of reflection, not a warning.

---

## 15. Day Flow: A Complete Annotated Session

This section walks through a full simulated day to validate the UI design end-to-end.

### Day Start (Morning — Camp, Tick 0)

The player enters the day from the debrief. The world loads with the player at camp.

**What the player sees:** Foraging HUD, family status bars all green (last night's stew was good — bars near 100%), day progress at 0/400, budget at 220/220 (200 base + 20 tick bonus from last night's protein/fat stew).

**What they do:** No mandatory morning ritual. They might check the inventory panel (Tab) to review what they're carrying, or head directly into the world.

**First decision:** Where to go today? The player knows from prior days roughly where they're headed. If they have Nature Sight active, they might check the overlay briefly for route guidance — one click to toggle, one click to dismiss.

### Early Foraging (Ticks 1–80)

The player walks northwest toward a cattail marsh they've been harvesting. Each tile costs 1 tick.

**Auto-rod check:** Their auto-rod is on a pond tile they pass. The rod sprite shows a triggered state indicator (small icon above the tile). They right-click it: "Collect Fish (2 ticks) — Bluegill 340g." They collect it. The rod transitions back to Live (they left it baited yesterday).

**Cattail harvest:** They reach the marsh. Right-click a cattail tile → Context menu appears: Harvest Pollen Head (1 tick), Inspect, Dig Root. They press H to repeat the pollen harvest on subsequent tiles. A brief "Pollen head harvested — 80g" flytext appears over the tile. They repeat across 8 tiles, spending 8 ticks for ~640g pollen.

**Unknown plant discovery:** They see a plant they haven't inspected before. Right-click → Inspect panel slides in. "Unknown Plant — dark green rosette, milky sap, slightly hairy. Smells faintly acrid." No nutritional data. Panel note: "Bring 3 different parts back to camp to submit for research." They note the location and place a marker stick (craftable in 5 ticks, drop with 1 tick).

### Mid-Day (Ticks 80–160)

**Trap check:** A snare is set on a deer trail 30 tiles from camp. They left-click (move) to the snare tile (30 ticks). Right-clicking the snare shows its current state. If sprung: "Check Trap (2 ticks)" — they select it, collect the rabbit, and it goes into inventory. They open the inventory panel, right-click the rabbit stack, and select "Process — Field Butchering (3 ticks, knife required)." Raw meat, pelt, and bone now in inventory.

**Budget awareness:** At tick 140, the budget is at 80/220 remaining. The night threshold is at tick 200 (spring baseline). They still have 60 ticks of planned foraging, which would leave them 20 ticks to return. They glance at the day progress bar — the darkness marker is visible. Enough time.

### Return & Camp Work (Ticks 160–200)

The player starts heading back to camp at tick 160, arriving around tick 195 (roughly 35 tiles back).

**At camp with ticks to spare:** They're at camp with ~25 ticks remaining. They could:
- Add items to stockpile (1 tick each)
- Add the hide to the drying rack if space (1 tick)
- Hand-craft a snare from fiber they collected (8 ticks)

This is a satisfying end-of-day spending phase. Camp tasks at night have no injury risk, just tick cost.

**Budget at 0:** The "End Day" button is visible in the HUD only while the player is within the camp tiles. Their budget is exhausted here at camp, so the button is active. They click it.

### Transition to Debrief

The screen transitions to the debrief. The Summary tab is shown automatically.

**Summary tab shows:** Family status bars all healthy. Partner completed: "Fiber extraction — 3 cordage units." Spoilage alert: "Elderberry clusters (2 stacks) — spoils tonight." No health warnings.

### Debrief Work (No Time Pressure)

**Queue tab:** The player reviews the partner's queue. An ongoing research task (plant sprite, 40% progress) is in progress. They add "Process hide (scrape + frame dry)" and "Craft 2× Simple Snares." The elderberry spoilage will be addressed in the Meal tab.

**Meal tab:** Sorted by spoilage, elderberries are first. The player clicks them to add to stew. The spoilage alert clears. They add the rabbit, cattail root flour, and elderberries. Live preview: protein threshold met ✓, fat threshold ✓ (rabbit fat), tick bonus granted ✓, variety "Good." Hunger fill preview shows everyone reaching 95–100%.

**End Day:** Click "Begin Day." The screen returns to the world, morning of the next day.

---

## 16. Open Questions & Unresolved Decisions

These are design decisions that require either prototyping or explicit choices before implementation:

**1. H key repeat harvest — resolved.** H repeats the last harvest action taken on any tile (same part, same sub-stage). If the last action cannot be matched on the current tile, or if this is the first interaction with the tile, the right-click context menu opens instead. H never auto-selects from a multi-part plant.

**2. Pathfinding hover preview.** When the player hovers over a tile for a short delay (~300ms), show a dotted path preview from the player's current position to that tile. This gives enough time to scan the world without the path display flickering on every mouseover. On click, the player moves along the path. The preview disappears immediately on any movement or action.

**3. Inspect panel dismissal.** The inspect panel slides in on right-click and should slide out on... right-click again? Any left-click? A dedicated close button? Given the panel overlays part of the world, it should close on any action in the world — clicking a tile to move there should dismiss it implicitly.

**4. Spoilage display granularity — resolved.** Display at day granularity: "Spoils tonight", "Spoils in 2 days", "Spoils in 3 days", then "Fresh" for anything beyond that. Dryness shows as a percentage with days-to-fully-dried: "Drying: 60% — ~1 day remaining."

**5. Research submission UX — resolved.** The inspect panel shows instructional text when a plant is unidentified: "Bring 3 different parts back to camp to submit for research." At camp, the item's right-click context menu in inventory gains a "Submit for Research" option when 3+ samples are present. This is more discoverable than a greyed button in the inspect panel.

**6. Meal plan quantity control — resolved.** When the player adds a stackable item to the stew, a quantity input appears allowing them to specify a partial amount (e.g., "200g of a 400g stack"). The remainder stays in the stockpile. For countable discrete items, the input is a unit count. The live nutrition preview updates as the quantity changes.

**7. Plant Library access — resolved.** Opening the Plant Library is always free. It is accessible from the camp context menu at any time and costs no ticks.

**8. Child health bars in HUD.** Children at camp are shown as a single status dot in the foraging HUD. In later epochs (Epoch 5 foraging child), the child is in the field with the player and should probably get a full three-bar display. This is a future concern but should be architecturally anticipated.

**9. Multiplayer turn indicators.** In multiplayer, all players act simultaneously. The global tick advances at the slowest player. The day progress bar shows global ticks, but the player's own budget shows local ticks. This can create a visible mismatch — the day progress bar advancing slowly while the player's own budget drains fast. Consider: a secondary indicator showing "Waiting for [Player B]" when the global clock is behind the local player's pace.

**10. Traveler event UI — deferred.** The traveler interaction and trade screen design is deferred pending other core systems. The traveler tile entity and basic inspect text will be scaffolded but no trade UI will be built in the initial implementation.

---

*End of Document — v0.1 draft for design review*
