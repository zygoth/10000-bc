import { useCallback, useEffect, useRef, useState } from 'react';
import { Application } from 'pixi.js';
import { getGameState } from '../game/gameStore.mjs';
import { getTileAt } from '../game/simCore.mjs';
import { cameraDebugOnPixiSyncAnchors } from './cameraDebug.js';
import { IsoWorldScene } from './pixi/IsoWorldScene.js';
import { pickTopTileAtScreen } from './pixi/isoMath.js';
import { gameCameraFloatRef, stepGameCameraFollow } from './standaloneGameCamera.js';
import { AmbientAudioBridge } from '../ambientAudio/ambientAudioBridge.mjs';

/**
 * Pixi isometric world + picking. React owns context menu UI (sibling in App).
 *
 * Play view: camera motion is driven by `standaloneGameCamera` (no React on the hot path).
 * We `sync` when `gameStateVersion`/layout changes, or when the float crosses a tile boundary (rAF).
 */
export default function PixiWorldView({
  gameState,
  gameStateVersion,
  /** Retained for API compat; play view does not use these for Pixi (float ref is authoritative). */
  cameraX,
  cameraY,
  windowWidth,
  windowHeight,
  cameraAnchorElevationPx,
  /** 0..1, scales ambient + world SFX (Web Audio). */
  sfxVolume = 1,
  selectedTileX,
  selectedTileY,
  showAnchorDebug,
  className,
  getTileTooltip,
  onTilePrimaryClick,
  onTileContextMenu,
}) {
  const hostRef = useRef(null);
  const appRef = useRef(null);
  const sceneRef = useRef(null);
  const hoverMoveTargetRef = useRef(null);
  const lastPointerClientRef = useRef(null);
  const syncChainRef = useRef(Promise.resolve());
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;
  const gameStateVersionRef = useRef(gameStateVersion);
  gameStateVersionRef.current = gameStateVersion;
  /** Last tile anchor we built sprites for (float floor); avoids duplicate sync from rAF + effect. */
  const lastSyncedFloorRef = useRef({ x: NaN, y: NaN });
  const ambientBridgeRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [hoverTitle, setHoverTitle] = useState('');

  const pickAtClient = useCallback((clientX, clientY) => {
    const scene = sceneRef.current;
    const host = hostRef.current;
    if (!scene?.lastSorted?.length || !host || !gameCameraFloatRef?.current) {
      return null;
    }
    const rect = host.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const { originX, originY } = scene.lastOrigin;
    const { x: camFx, y: camFy } = gameCameraFloatRef.current;
    return pickTopTileAtScreen(
      scene.lastSorted,
      gameState,
      camFx,
      camFy,
      originX,
      originY,
      localX,
      localY,
    );
  }, [gameState]);

  const applyHoverPickAtClient = useCallback((clientX, clientY) => {
    const hit = pickAtClient(clientX, clientY);
    hoverMoveTargetRef.current = hit
      ? { worldX: hit.worldX, worldY: hit.worldY }
      : null;
    const cf = gameCameraFloatRef?.current;
    if (!cf) {
      return;
    }
    sceneRef.current?.drawHoverMoveTarget(
      gameState,
      cf.x,
      cf.y,
      hoverMoveTargetRef.current,
    );
    if (!hit) {
      setHoverTitle('');
      return;
    }
    const plantId = hit.tile.plantIds?.[0];
    const plant = plantId ? gameState.plants[plantId] : null;
    if (typeof getTileTooltip === 'function') {
      setHoverTitle(getTileTooltip(hit.worldX, hit.worldY, hit.tile, plant) || '');
    } else {
      setHoverTitle('');
    }
  }, [pickAtClient, gameState, getTileTooltip]);

  const updateHoverAtClient = useCallback((clientX, clientY) => {
    lastPointerClientRef.current = { clientX, clientY };
    applyHoverPickAtClient(clientX, clientY);
  }, [applyHoverPickAtClient]);

  const refreshHoverAfterSceneSync = useCallback(() => {
    const last = lastPointerClientRef.current;
    if (!last) {
      return;
    }
    applyHoverPickAtClient(last.clientX, last.clientY);
  }, [applyHoverPickAtClient]);

  const runSceneSync = useCallback(() => {
    const scene = sceneRef.current;
    const app = appRef.current;
    const cf = gameCameraFloatRef?.current;
    if (!ready || !scene || !cf) {
      return;
    }
    const anchorX = Math.floor(Number(cf.x) + 1e-9);
    const anchorY = Math.floor(Number(cf.y) + 1e-9);
    lastSyncedFloorRef.current = { x: anchorX, y: anchorY };
    const gs = gameStateRef.current;
    cameraDebugOnPixiSyncAnchors({
      anchorX,
      anchorY,
      propCameraX: anchorX,
      propCameraY: anchorY,
      floatX: cf.x,
      floatY: cf.y,
      gameStateVersion: gameStateVersionRef.current,
    });
    syncChainRef.current = syncChainRef.current
      .catch(() => {})
      .then(async () => {
        const latestGs = getGameState() || gs;
        await scene.sync({
          gameState: latestGs,
          cameraX: anchorX,
          cameraY: anchorY,
          windowWidth,
          windowHeight,
          cameraAnchorElevationPx,
          selectedTileX,
          selectedTileY,
          showAnchorDebug,
        });
        if (app) {
          app.stage.hitArea = app.screen;
        }
        const cf2 = gameCameraFloatRef?.current;
        if (cf2) {
          scene.applyCameraPixelRoll(cf2.x, cf2.y);
          scene.bumpWindViewportFrameAfterSync(cf2.x, cf2.y);
          scene.stepPlayerVisual(gs, cf2.x, cf2.y);
        }
        refreshHoverAfterSceneSync();
      });
  }, [
    ready,
    windowWidth,
    windowHeight,
    cameraAnchorElevationPx,
    selectedTileX,
    selectedTileY,
    showAnchorDebug,
    refreshHoverAfterSceneSync,
  ]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return undefined;
    }
    let cancelled = false;
    const app = new Application();
    const scene = new IsoWorldScene();

    (async () => {
      await app.init({
        resizeTo: host,
        background: '#120e0a',
        antialias: false,
        resolution: Math.min(typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1, 2),
        autoDensity: true,
      });
      if (cancelled) {
        app.destroy(true);
        return;
      }
      host.appendChild(app.canvas);
      app.stage.addChild(scene.root);
      app.stage.eventMode = 'static';
      app.stage.hitArea = app.screen;
      appRef.current = app;
      sceneRef.current = scene;
      scene.attachApplication(app);
      setReady(true);
    })();

    return () => {
      cancelled = true;
      syncChainRef.current = Promise.resolve();
      setReady(false);
      sceneRef.current = null;
      if (appRef.current) {
        try {
          appRef.current.destroy(true, { children: true });
        } catch {
          /* ignore */
        }
        appRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!ready || !host) {
      return undefined;
    }
    const bridge = new AmbientAudioBridge(host);
    ambientBridgeRef.current = bridge;
    return () => {
      bridge.dispose();
      if (ambientBridgeRef.current === bridge) {
        ambientBridgeRef.current = null;
      }
    };
  }, [ready]);

  useEffect(() => {
    const t = Number(sfxVolume);
    const linear = Number.isFinite(t) ? Math.max(0, Math.min(1, t)) : 1;
    ambientBridgeRef.current?.setSfxVolume(linear);
  }, [ready, sfxVolume]);

  /** World / layout / selection changes — not tied to React camera integers (float ref is authoritative). */
  useEffect(() => {
    if (!ready || !sceneRef.current) {
      return undefined;
    }
    const rafId = requestAnimationFrame(() => runSceneSync());
    return () => cancelAnimationFrame(rafId);
  }, [
    ready,
    gameStateVersion,
    windowWidth,
    windowHeight,
    cameraAnchorElevationPx,
    selectedTileX,
    selectedTileY,
    showAnchorDebug,
    runSceneSync,
  ]);

  /**
   * Single rAF loop: sub-pixel roll every frame; full `sync` when float crosses a tile edge
   * (same anchor `runSceneSync` uses — no React state involved).
   */
  useEffect(() => {
    if (!ready || !sceneRef.current) {
      return undefined;
    }
    const scene = sceneRef.current;
    let rafId = null;
    const tick = () => {
      rafId = requestAnimationFrame(tick);
      stepGameCameraFollow();
      const cf = gameCameraFloatRef.current;
      if (!cf) {
        return;
      }
      scene.stepPlayerVisual(gameStateRef.current, cf.x, cf.y);
      /** Authoritative sim state (same as camera follow). React `gameState` can lag a tick behind the store. */
      const gs = getGameState() || gameStateRef.current;
      const p = gs?.actors?.player;
      const px = Number(p?.x);
      const py = Number(p?.y);
      const usePlayer = Number.isFinite(px) && Number.isFinite(py);
      const earX = usePlayer ? px + 0.5 : cf.x;
      const earY = usePlayer ? py + 0.5 : cf.y;
      ambientBridgeRef.current?.tick(gs, earX, earY);
      const ax = Math.floor(Number(cf.x) + 1e-9);
      const ay = Math.floor(Number(cf.y) + 1e-9);
      scene.applyCameraPixelRoll(cf.x, cf.y);
      const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
      scene.stepWindEffects(nowMs, gs, windowWidth, windowHeight, cf.x, cf.y);
      if (ax !== lastSyncedFloorRef.current.x || ay !== lastSyncedFloorRef.current.y) {
        runSceneSync();
      }
    };
    rafId = requestAnimationFrame(tick);
    return () => {
      if (rafId != null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [ready, runSceneSync, windowWidth, windowHeight]);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) {
      return undefined;
    }
    el.setAttribute('title', hoverTitle || '');
    return undefined;
  }, [hoverTitle]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return undefined;
    }

    const onMove = (event) => {
      updateHoverAtClient(event.clientX, event.clientY);
    };

    const onLeave = () => {
      lastPointerClientRef.current = null;
      hoverMoveTargetRef.current = null;
      const cf = gameCameraFloatRef?.current;
      if (cf) {
        sceneRef.current?.drawHoverMoveTarget(
          gameState,
          cf.x,
          cf.y,
          null,
        );
      }
      setHoverTitle('');
    };

    const onPointerDown = (event) => {
      lastPointerClientRef.current = { clientX: event.clientX, clientY: event.clientY };
      if (event.button === 2) {
        event.preventDefault();
      }
      const hit = pickAtClient(event.clientX, event.clientY);
      if (!hit) {
        return;
      }
      const tile = getTileAt(gameState, hit.worldX, hit.worldY);
      if (!tile) {
        return;
      }
      if (event.button === 0) {
        onTilePrimaryClick?.({
          worldX: hit.worldX,
          worldY: hit.worldY,
          tile,
          screenX: hit.screenX,
          tileTopCenterY: hit.tileTopCenterY,
        });
      } else if (event.button === 2) {
        onTileContextMenu?.({
          worldX: hit.worldX,
          worldY: hit.worldY,
          tile,
          screenX: hit.screenX,
          tileTopCenterY: hit.tileTopCenterY,
          clientX: event.clientX,
          clientY: event.clientY,
        });
      }
    };

    const onCtx = (event) => {
      event.preventDefault();
    };

    host.addEventListener('pointermove', onMove);
    host.addEventListener('pointerdown', onPointerDown);
    host.addEventListener('pointerleave', onLeave);
    host.addEventListener('contextmenu', onCtx);
    return () => {
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerdown', onPointerDown);
      host.removeEventListener('pointerleave', onLeave);
      host.removeEventListener('contextmenu', onCtx);
    };
  }, [pickAtClient, updateHoverAtClient, gameState, onTilePrimaryClick, onTileContextMenu]);

  return (
    <div
      ref={hostRef}
      className={className}
      style={{
        width: '100%',
        height: '100%',
        touchAction: 'none',
        position: 'relative',
      }}
    />
  );
}
