# PixiJS Renderer Migration Plan

## Motivation

The current isometric game view renders hundreds of absolutely-positioned `<span>` elements per tile (terrain layers + occupant + hitbox). Every player move triggers a full React re-render of the entire visible tile set, causing noticeable lag. Switching to a PixiJS WebGL canvas renderer will:

- Eliminate per-tile DOM overhead entirely
- Enable true 60fps smooth camera scroll with per-frame lerp, fully decoupled from React state updates
- Allow a proper buffer zone of tiles beyond the viewport to prevent pop-in during movement
- Make diamond-shaped hit areas trivial (PixiJS `Graphics` polygon with `eventMode = 'static'`)

---

## Install

```
npm install pixi.js
```

---

## New File: `src/ui/IsoPixiRenderer.jsx`

### Props

```js
{
  gameState,          // full game state (tiles, plants, worldItems, camp)
  playerActor,        // for player position token
  cameraX, cameraY,   // target camera (React state, snaps to player)
  selectedTileX, selectedTileY,
  showAnchorDebug,
  windowSize,
  onTileClick(worldX, worldY),
  onTileRightClick(worldX, worldY, screenX, screenY),
}
```

### Initialization

On mount, create a `PIXI.Application` attached to a `<canvas>` ref:

```js
const app = new Application();
await app.init({ canvas: canvasRef.current, width, height, backgroundAlpha: 0 });
```

Pre-load all textures using `Assets.load()` for each unique `imagePath` across:
- `TERRAIN_SPRITES` (grass, dirt, water, ice)
- `getRockSpriteFrame` results
- All entries in `PLANT_SPRITE_CATALOG_SOURCE`
- Dead log sprite

Build a `textureCache: Map<imagePath, Texture>` for reuse.

### Sprite Positioning

Sprites use the same anchor math as the current CSS system:

```js
const tex = new Texture({ source: baseTexture, frame: new Rectangle(fx, fy, fw, fh) });
const sprite = new Sprite(tex);
sprite.x = Math.round(screenX - footAnchorX * scale);
sprite.y = Math.round(screenY - footAnchorY * scale);
sprite.scale.set(scale);
```

Where `footAnchorX = (frame.anchorX ?? frame.w / 2) * scale` and `footAnchorY = (frame.anchorY ?? frame.h) * scale`.

### Smooth Camera

Keep a `displayCamera = { x, y }` as a mutable ref (not React state). On each ticker frame:

```js
app.ticker.add(() => {
  const LERP = 0.18;
  displayCamera.x += (targetCamera.x - displayCamera.x) * LERP;
  displayCamera.y += (targetCamera.y - displayCamera.y) * LERP;
  if (Math.abs(displayCamera.x - targetCamera.x) < 0.01) displayCamera.x = targetCamera.x;
  if (Math.abs(displayCamera.y - targetCamera.y) < 0.01) displayCamera.y = targetCamera.y;
  renderFrame();
});
```

`targetCamera` is a ref updated whenever `cameraX/cameraY` props change.

### Buffer Zone

Visible + buffered tile range:

```js
const BUFFER = 3;
// Inverse-project viewport corners to find tile range, then expand by BUFFER
// Iterate worldX in [minWorldX - BUFFER, maxWorldX + BUFFER], same for Y
```

This keeps tiles pre-rendered during smooth scroll so no pop-in occurs at the edges.

### Camera Math (unchanged)

```
originX = canvasWidth / 2
originY = canvasHeight / 2 - ISO_TILE_HALF_HEIGHT_PX + elevationOffset

localX = worldX - displayCamera.x
localY = worldY - displayCamera.y

screenX = (localX - localY) * ISO_TILE_HALF_WIDTH_PX + originX
screenY = (localX + localY) * ISO_TILE_HALF_HEIGHT_PX + originY
```

### Diamond Hit Areas

Each tile gets a `Graphics` diamond (one-time created, repositioned each frame):

```js
const hit = new Graphics();
hit.poly([64,0, 128,32, 64,64, 0,32]).fill({ alpha: 0 });
hit.eventMode = 'static';
hit.cursor = 'pointer';
hit.on('pointerdown', (e) => {
  if (e.button === 0) onTileClick(worldX, worldY);
});
hit.on('rightclick', (e) => {
  onTileRightClick(worldX, worldY, e.global.x, e.global.y);
});
// Position: hit.x = screenX - 64; hit.y = tileTopCenterY;
```

### Rendering Loop (`renderFrame`)

Sort tiles by painter's order (`worldX + worldY` ascending, then `worldX` ascending). For each tile:

1. Position and show terrain sprite(s) (dirt underlay if needed, dirt side fills, grass/water/ice)
2. Position and show rock sprite if present
3. Position and show occupant sprite (plant or dead log) if present
4. Position entity tokens (player `@`, camp `▲`, world items `·`) as `Text` objects
5. Position hit `Graphics` diamond

Use a **sprite pool**: pre-allocate a pool of `Sprite` and `Graphics` objects. Each frame, assign pool objects to tiles rather than creating/destroying. Hide unused pool objects (`.visible = false`).

### React Integration (`src/App.js`)

- Remove `renderIsometricPlayView()` function
- Remove `visibleIsoTiles` useMemo
- Remove `cameraAnchorTile` / `cameraAnchorElevationPx` (move into renderer)
- Replace the `<section className="game-stage">` content with:
  ```jsx
  <IsoPixiRenderer
    gameState={gameState}
    playerActor={playerActor}
    cameraX={cameraX}
    cameraY={cameraY}
    selectedTileX={selectedTileX}
    selectedTileY={selectedTileY}
    showAnchorDebug={showAnchorDebug}
    windowSize={windowSize}
    onTileClick={(wx, wy) => { /* existing left-click logic */ }}
    onTileRightClick={(wx, wy, sx, sy) => { /* existing right-click logic, use sx/sy for menu position */ }}
  />
  ```
- Keep context menu JSX in `App.js` (positioned absolutely over the canvas using `sx/sy` from `onTileRightClick`)
- The `useEffect` that snaps `cameraX/Y` to player position stays — the Pixi renderer handles lerp internally

### CSS Changes

- Remove all `.iso-tile-hitbox`, `.iso-tile-stack`, `.iso-layer-*`, `.iso-mushroom-overlay`, `.iso-entity-token`, `.iso-anchor-debug` rules (no longer rendered as DOM)
- `.isometric-play-stage` becomes a simple full-screen container for the canvas
- `.iso-context-menu` and `.isometric-canvas` stay as-is (context menu is still DOM)

---

## Implementation Sequence

1. Install pixi.js, verify import works
2. Stub `IsoPixiRenderer` — canvas mounts, black background, no tiles
3. Load textures, draw terrain-only tiles at correct positions (no smooth scroll yet)
4. Add occupant sprites and entity tokens
5. Add diamond hit areas, wire click/right-click back to App.js
6. Add per-frame lerp camera + buffer zone
7. Add selected tile highlight (colored diamond outline)
8. Add anchor debug markers
9. Remove old `renderIsometricPlayView` and clean up App.js/App.css

---

## Notes

- PixiJS v8 uses `app.init()` (async) instead of `new Application(options)` — handle with `useEffect` + async IIFE
- Pixi v8 `Graphics` API changed: use `graphics.poly([...]).fill(...)` not `graphics.beginFill().drawPolygon()`
- `imageRendering: pixelated` equivalent in Pixi: set `texture.source.scaleMode = 'nearest'` on each loaded source
- All constants (`ISO_TILE_WIDTH_PX`, `ISO_BASE_SCALE`, etc.) should be moved to a shared constants file or passed as props so both App.js and IsoPixiRenderer can use them without duplication
