# Tool icons (authoring)

Drop your **TexturePacker-style** tool sheet here:

- `atlas.json` with `textures[0].format: "SVG"` and per-frame `spriteId` values `tool_<suffix>` (maps to item id `tool:<suffix>`).
- The merged **single** `.svg` referenced by `textures[0].image` and/or frame `filename` fields.

Then run:

```bash
npm run tool-sprites:build
```

or any command that runs `catalog:build` (includes tool sprites). `npm start` runs a **prestart** hook that rebuilds the tool sheet so new assets are picked up when you launch the dev server.

Outputs (generated, do not edit by hand):

- `public/sprite_sheets/tools.png` — raster for the game
- `src/game/toolSpriteCatalog.source.mjs` — frame rects for the inventory UI
