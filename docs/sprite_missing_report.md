# Missing sprites report (`sprites:missing`)

This repo tracks art migration toward **per-species SVG sheets** (`data/plants/<species>/atlas.json` + merged `.svg`, as in `juglans_nigra`) and other world/inventory assets.

## Run

From the repository root:

```bash
npm run sprites:missing
```

- **Output:** `temp/missing-sprites-report.json` (the `temp/` directory is gitignored).
- **Environment:** The script runs with `NODE_ENV=test` so inventory sprite resolution does not spam the console (see `plantPartSpriteResolve.mjs`).

## What the report contains

| Section | Purpose |
|--------|---------|
| **`authoringIntegration`** | For image / model gen and one-step integration: **`repositoryRootPath`** (absolute path to this repo on the machine that ran the report), **`forGenerationAi`**, **`dropPaths`** (each with **`dropPathAbsolute`** for copy targets), and **`refreshCommands`** (includes **`runFrom`**: `cd` to the repo before `npm run …`). |
| **`spriteSheetRegistry`** | Copy of [`src/spriteAssetManifest.json`](../src/spriteAssetManifest.json) **`spriteSheets`** plus **extended** sheets used only in the report: **`species_plants`**, **`terrain`**, **`ground_fungus`**. Each entry has **`authoringPathHint`**, **`atlasAuthoringHint`**, and suggested atlas paths for batch / codegen. |
| **`atlasCompilation`** | High-level pipeline notes plus **`missingArtBySpriteSheet`**: every pending art row **grouped by `spriteSheet`**, with **`suggestedAtlasSpriteId`** / **`compileIntoAtlas`** so a sprite-gen or atlas pack step knows which merged atlas a cell belongs to. |
| **`plantSpeciesSvg`** | Each folder under `data/plants/` with `plant.json`: SVG pipeline status (`ok`, `legacy_png_only`, `missing_merged_svg`, `invalid_svg_atlas`, …). Legacy `spritesheet_rd_final` counts as **not** migrated. Optional cross-check with `sprite_list.json` vs atlas `spriteId`s. |
| **`universalAssets`** | `data/plants/universal` dead-log art (PNG today vs future SVG + atlas). |
| **`isometricOrTileArt`** | Terrain / water / ice / rocks / dead-log **public** paths from `plantSpriteCatalog.mjs`, plus whether matching files exist under `data/isometric_sprites` and `public/`. |
| **`groundFungus`** | One row per ground-fungus species (placeholder status until dedicated art exists). |
| **`inventoryArtBuckets`** | Collapsed art needs: **waterskin** → **`spriteSheet`: `tools`**, two **`suggestedAtlasSpriteIds`**. **placeable_tools…** → inventory rows on **`tools`**, tile rows on **`placeables`**. |
| **`inventoryItemsWithoutSprite`** | Flat list with **`spriteSheet`** derived from item **`category`**: **`tool`** → `tools`; **`food`** and **`intermediate`** → **`crafting_intermediates`** (food shares the intermediates atlas). Excludes **`debug:`** items and bucketed waterskin / placeable tools. Each row includes **`suggestedAtlasSpriteId`** (slug from `itemId`). |
| **`worldEntitySpriteQueue`** | Manifest entries with **`spriteSheet`** (actors, camp, placeables, …), **`suggestedAtlasSpriteId`**, and status. **Not listed in manifest:** squirrel caches, beehives (see earlier notes). |

### Manifest (`spriteAssetManifest.json`)

- **`spriteSheets`**: canonical sheet ids — **`actors`**, **`camp`**, **`placeables`**, **`tools`**, **`crafting_intermediates`**.
- **`entries[].spriteSheet`**: which merged atlas the row targets (same ids as above).
- **Authoring convention:** one folder per sheet under `data/sprite_sheets/<id>/` (hints only until the build copies/rasterizes), with **`atlas.json` (format SVG)** + merged **`.svg`**, matching the [`juglans_nigra`](../data/plants/juglans_nigra/atlas.json) pattern.

## Implementation

- **Script:** [`scripts/list-missing-sprite-assets.mjs`](../scripts/list-missing-sprite-assets.mjs)
- **Shared SVG checks:** [`scripts/lib/plantSvgAtlasProbe.mjs`](../scripts/lib/plantSvgAtlasProbe.mjs) — keep aligned with [`scripts/build-plant-sprite-catalog.mjs`](../scripts/build-plant-sprite-catalog.mjs) (`readSvgAtlasIfPresent`, `resolveMergedSvgFile`).

## Related

- Ambient sound equivalent: `npm run sounds:missing` → `missing-sounds-report.json` (see [`docs/ambient_audio.md`](ambient_audio.md)).
- Design notes: [`.cursor/plans/missing-sprites-report.md`](../.cursor/plans/missing-sprites-report.md) (plan / checklist for manifest semantics such as `on_tree` vs `ground_rescale`).
