## Implementation Plan (Living Status)

### Phase 1 - Deterministic sim vertical slice

Status: **In Progress**

- [x] Plant JSON + spritesheet pipeline for 3 species (test set)
- [x] Basic map generation (terrain, moisture, fertility, drainage, river + tributaries)
- [x] Core `advanceDay` simulation loop (growth, seeding, germination, deaths)
- [x] Observer renderer with overlays and species-support debugging
- [x] Sim test harness and deterministic regression coverage
- [ ] Full design-doc parity for `advanceDay` lifecycle rules
- [ ] Long-horizon validation pass (25-year focused scenarios + assertions)

---

### `advanceDay` parity check vs design doc (Section 5.1a)

#### Implemented

- [x] Daily age increment and life-stage selection by age + seasonal window
- [x] Death when no valid stage exists (annual/biennial gap behavior)
- [x] Daily seeding during seeding window for mature plants
- [x] Seed viability aging and expiry via dormant seed pool
- [x] Germination chance based on `germination_rate * soil_match`
- [x] Soil/environmental death checks
- [x] Plant occupancy reconciliation to prevent stale/phantom tile occupancy

#### Partially implemented / differs from spec

- [~] Soil mismatch death rule is currently broader than spec wording (current code also gates moisture/fertility/shade)
- [~] Seeding maturity gate currently uses `ageOfMaturity` rather than explicit stage-name checks (`mature`/`second_year`)
- [~] Environmental mismatch now causes gradual vitality loss (no immediate death), tuned for ecological stress gameplay; may need balance pass against final GDD values

#### Not yet implemented

- [ ] Harvest-damage vitality model (including regrowth countdown and seasonal regrowth cap)
- [x] Vitality recovery rules by season/longevity from spec (perennial spring/summer passive recovery)
- [x] Disturbance-aware germination (`requires_disturbance`, `pioneer` bonus)

---

### Next execution order

1. Add harvest/regrowth vitality mechanics and end-to-end lifecycle tests.
2. Revisit seeding maturity gate to be stage-name based (`mature`/`second_year`).
3. Run long-horizon (25-year) deterministic scenario suite and lock regressions.

### Phase 2 - Gameplay backend actions

Status: **Planned**

- Player actions that mutate world state (harvest/use/place/process)
- Action-time/tick budget integration with simulation state

### Phase 3 - Player-facing UI

Status: **Planned**

- Player HUD, inventory, interaction UX, and feedback loops