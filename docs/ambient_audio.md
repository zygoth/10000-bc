# Ambient audio (wildlife, camp, partner)

The play view drives **tile-based ambient sound** from JSON in [`src/ambientAudio/catalog/`](../src/ambientAudio/catalog/) via [`AmbientAudioBridge`](../src/ambientAudio/ambientAudioBridge.mjs) hooked from [`PixiWorldView.js`](../src/rendering/PixiWorldView.js). The **listener** is the **player** (tile center + 0.5), not the drifting isometric camera — so camp loops and panners track where you are. Mobile one-shots only consider emitters within **Chebyshev distance 8** tiles of the player (`AMBIENT_MOBILE_LISTEN_CHEBYSHEV` in [`ambientPlayHeadless.mjs`](../src/ambientAudio/ambientPlayHeadless.mjs)); that is a radius around you, not “on-screen only.”

**Year vs day:** **Emitter positions** are redrawn each new `totalDaysSimulated` day. **Population weight maps** rebuild when the 40-day ambient **bucket** changes, when sim **`year`** changes, or when **`dayOfYear`** changes (needed for `calendar_timeline` and correct season weighting) — see [`syncAmbientLayerCache`](../src/ambientAudio/ambientLayerCache.mjs).

## What you need to do to hear everything

1. **Generate** the sound assets (your pipeline / ElevenLabs / etc.).
2. **Save** each file under **`public/sounds/ambient/`** using the **exact filenames** referenced in the catalog `calls[].url` fields (paths are `/sounds/ambient/...`).
3. **Reload** the game. The Web Audio layer loads on first **pointer down** on the world canvas (browser autoplay policy).

Starter species (late Pleistocene / early Holocene **Indiana-region** natives, aligned with in-game plant ids):

- **Bird** — *Meleagris gallopavo* (`meleagris_gallopavo.json`) — wild turkey; mast affinity **`juglans_nigra`** (black walnut in the plant catalog). `shared_trapping_species_id` matches `species_id` for future trap integration.
- **Insect** — *Magicicada septendecim* (`magicicada_septendecim.json`) — 17-year “pharaoh” cicada; hardwood affinity **`juglans_nigra`**, emergence years only. *Neotibicen canicularis* (`neotibicen_canicularis.json`) — dog-day (annual) cicada; same hardwood affinity, summer-weighted.
- **Frog** — *Pseudacris crucifer* (`pseudacris_crucifer.json`) — spring peeper; wet habitat + **`asclepias_syriaca`** (common milkweed) wet-meadow affinity.

Plus **campfire**, **beehive buzz** (adjacent to active hive), and **camp maintenance** partner loop when that queue row is active.

## Headless “will it play?” checks (cooldowns, loops)

Runtime **decisions** (mobile one-shots, loop ensure/stop) live in [`ambientPlayHeadless.mjs`](../src/ambientAudio/ambientPlayHeadless.mjs). [`AmbientAudioBridge`](../src/ambientAudio/ambientAudioBridge.mjs) only forwards the results to Web Audio.

- **`computeMobileAmbientOneShots`** — same rules as in-game: `day_activity`, distance filter, RNG gate, **per-emitter-tile cooldown** (`emitterKey` = `speciesId@x,y`).
- **`computeAmbientLoopCommands`** — campfire / partner / beehive **ensure** vs **stop** in one list (assert in Jest without `AudioContext`).
- **`simulateMobileOneShotFrames`** — drive many frames with fixed **`dtSec`**, **`startNowMs`**, and an injectable **`rng()`** to simulate minutes of play in milliseconds of test time.

Run: `npm test -- --testPathPattern=ambientPlayHeadless --watchAll=false`

## Missing-sound report

From the **repository root**:

```bash
npm run sounds:missing
```

For **sprite / art migration** status (plants SVG sheets, inventory gaps, world manifest), see [`sprite_missing_report.md`](sprite_missing_report.md) (`npm run sprites:missing` → `temp/missing-sprites-report.json`).

This writes **`missing-sounds-report.json`** at the repo root with every catalog URL, whether the file exists under `public/`, and optional **`generation_prompt`** text from JSON for batch generation. It also writes **`public/sounds/ambient/variant-manifest.json`**: for each catalog base name, any extra files `name_v1.ogg`, `name_v2.ogg`, … on disk are grouped; the Web Audio layer picks **at random** per one-shot (see `ambientWebAudio.mjs` + `ambientSoundVariants.mjs`).

## Catalog JSON reference

All entries live under [`src/ambientAudio/catalog/`](../src/ambientAudio/catalog/) and are registered in [`ambientCatalog.mjs`](../src/ambientAudio/ambientCatalog.mjs). Each file is one object. **Common fields:**

| Field | Required | Description |
| --- | --- | --- |
| `species_id` | yes | Stable id string; for `ambient_mobile`, used in emitters and weight maps. |
| `display_name` | yes | Human label (UI / debug). |
| `audio_role` | yes | Drives which pipeline runs: `ambient_mobile`, `camp_campfire`, `sim_beehive`, `partner_station_work`, etc. |
| `placement` | role-dependent | How the sim places or anchors sound (see below). |
| `population_response` | often | Habitat weights for **mobile** species; `null` for pure loops. |
| `day_activity` | usually | Intra-**day** activity 0–1 by `dayTick` (400 ticks per day). |
| `calls` | yes | Audio assets: at least one `{ url, pick_weight, ... }`. Paths are `/sounds/ambient/...`. |
| `scheduling` | usually | Cooldowns, voice caps, loop options; shape varies by `audio_role`. |
| `audibility` | some roles | e.g. camp / beehive distance and footprint rules ([`ambientEligibility.mjs`](../src/ambientAudio/ambientEligibility.mjs)). |
| `shared_trapping_species_id` | optional | Reserved for future link to `ANIMAL_CATALOG` / trap density (not wired yet). |

### `audio_role: ambient_mobile`

**Tile weights + daily emitters** — [`buildYearWeightMaps`](../src/ambientAudio/buildAmbientLayer.mjs) and [`placeDailyEmitters`](../src/ambientAudio/buildAmbientLayer.mjs). **One-shots** when the player is within **Chebyshev 8** tiles of an emitter — [`computeMobileAmbientOneShots`](../src/ambientAudio/ambientPlayHeadless.mjs).

| Field | Description |
| --- | --- |
| `placement.strategy` | Use `year_weights_then_daily_emitters`. |
| `placement.max_emitters_on_map` | Cap on placed emitter points for this species. |
| `placement.max_emitters_per_tile` | Max emitters sharing one tile. |
| `one_shot_gain` | optional. **Linear multiplier** on one-shot **playback** gain (default `1`). Does not change habitat weights; use to tame loud assets (e.g. `0.48`). |
| `population_response.base` | Base positive weight before multipliers. |
| `population_response.season_multiplier_by_key` | Used **only if** `calendar_timeline` is **absent**: multipliers for `spring` / `summer` / `fall` / `winter` from sim `dayOfYear` ([`getSeason`](../src/game/plantCatalog.mjs): days 1–10 spring, 11–20 summer, 21–30 fall, 31–40 winter). |
| `population_response.calendar_timeline` | If present, **replaces** season keys for the calendar factor. `kind: "day_segments"`, `default_relative` (usually `0` outside song season), `segments[]` with **inclusive** `from_day` / `to_day` (1–40) and `relative` (0–1). **First matching segment wins.** |
| `population_response.terms` | List of factors multiplied together. See **Population terms** below. |
| `population_response.weight_clamp` | `[lo, hi]` clamp on the final product. |
| `day_activity.kind` | `day_tick_segments` — `segments` with `from_tick` / `to_tick` (0–399) and `relative` 0–1. |
| `scheduling` | `min_seconds_between_calls_same_species`, `min_seconds_between_calls_same_emitter`, `max_simultaneous_voices_for_species`, optional `mobile_roll_scale` (scales random roll rate), `mute_when_listener_on_emitter_tile`, etc. |

**17-year periodical cicada** (`magicicada_septendecim`): Brood years are enforced in code ([`magicicadaEmergence.mjs`](../src/game/magicicadaEmergence.mjs), state `magicicadaSeptendecimEmergenceOffset` + `year`); the JSON does **not** carry the 17-year modulus. Off-brood years have **no** weight map for that species.

### Population `terms` (`population_response.terms[]`)

Each term has `kind` and is **multiplied** with the others. Implemented in [`populationTerms.mjs`](../src/ambientAudio/populationTerms.mjs):

| `kind` | Main fields | Role |
| --- | --- | --- |
| `trapezoid` | `feature` (tile snapshot key: `moisture`, `shade`, …), `peak_at`, `half_width`, `floor`, `ceiling` | Habitat curve. |
| `enum_weight` | `feature`, `weights` map (e.g. `water_type`: `land` / `river` / `pond`) | Per-enum factor. |
| `bool_weight` | `feature`, `if_true`, `if_false` | Boolean tile feature. |
| `plant_affinity_neighbors` | `target_plant_species_ids`, `max_distance`, `at_distance_0`, `beyond_max` | Stronger when close to listed plant species. |

`buildTileFeatureSnapshot` in [`tileFeatures.mjs`](../src/ambientAudio/tileFeatures.mjs) defines which `feature` names exist per tile.

### `audio_role: camp_campfire` (and similar loops)

`placement` is minimal; **`audibility`** controls when the loop plays. `scheduling` may include `playback_style: "loop_while_eligible"`, `crossfade_ms`. No mobile emitters.

### Minimal `ambient_mobile` example (illustrative)

```json
{
  "species_id": "example_bird",
  "display_name": "Example",
  "audio_role": "ambient_mobile",
  "one_shot_gain": 1,
  "placement": { "strategy": "year_weights_then_daily_emitters", "max_emitters_on_map": 8, "max_emitters_per_tile": 1 },
  "population_response": {
    "base": 0.1,
    "calendar_timeline": {
      "kind": "day_segments",
      "default_relative": 0,
      "segments": [{ "from_day": 1, "to_day": 40, "relative": 1 }]
    },
    "terms": [
      { "kind": "trapezoid", "feature": "moisture", "peak_at": 0.5, "half_width": 0.3, "floor": 0.1, "ceiling": 1 }
    ],
    "weight_clamp": [0, 10]
  },
  "day_activity": { "kind": "day_tick_segments", "segments": [{ "from_tick": 0, "to_tick": 400, "relative": 1 }] },
  "calls": [{ "call_id": "c1", "url": "/sounds/ambient/example.ogg", "pick_weight": 1, "flight_call": false, "tags": [] }],
  "scheduling": { "min_seconds_between_calls_same_species": 2, "min_seconds_between_calls_same_emitter": 1.5, "max_simultaneous_voices_for_species": 3, "mute_when_listener_on_emitter_tile": false }
}
```

## Editing species

Copy a catalog JSON in `src/ambientAudio/catalog/`, tune `population_response` / `day_activity` / `one_shot_gain` as needed, add the file to the array in [`ambientCatalog.mjs`](../src/ambientAudio/ambientCatalog.mjs), then re-run `sounds:missing`.
