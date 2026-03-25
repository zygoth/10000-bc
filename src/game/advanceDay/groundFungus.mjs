export function rollGroundFungusYieldImpl(zone, targetTile, rng, deps) {
  const { rangeRollIntRandom } = deps;
  const baseYield = rangeRollIntRandom(zone.perTileYieldRange, rng, 1);
  const moisture = Number(targetTile?.moisture) || 0;

  let multiplier = 1;
  if (moisture > 0.9) {
    multiplier = 0.6;
  } else if (moisture >= 0.7) {
    multiplier = 1.4;
  } else if (moisture >= 0.4) {
    multiplier = 1.2;
  } else if (moisture >= 0.15) {
    multiplier = 0.5;
  } else {
    multiplier = 0.1;
  }

  return Math.max(1, Math.round(baseYield * multiplier));
}

export function applyGroundFungusFruitingImpl(state, rng, deps) {
  const { isDayInSeasonWindow, rollGroundFungusYield } = deps;
  const zoneTilesByZoneId = new Map();

  for (const tile of state.tiles) {
    const zone = tile.groundFungusZone;
    if (!zone?.zoneId) {
      continue;
    }
    if (!zoneTilesByZoneId.has(zone.zoneId)) {
      zoneTilesByZoneId.set(zone.zoneId, []);
    }
    zoneTilesByZoneId.get(zone.zoneId).push(tile);
  }

  for (const zoneTiles of zoneTilesByZoneId.values()) {
    if (zoneTiles.length === 0) {
      continue;
    }

    const sampleZone = zoneTiles[0].groundFungusZone;
    const windows = Array.isArray(sampleZone.fruitingWindows) ? sampleZone.fruitingWindows : [];
    const activeWindowIndices = windows
      .map((window, index) => (isDayInSeasonWindow(state.dayOfYear, window) ? index : -1))
      .filter((index) => index >= 0);

    if (activeWindowIndices.length === 0) {
      for (const tile of zoneTiles) {
        tile.groundFungusZone.yieldCurrentGrams = 0;
      }
      continue;
    }

    for (const windowIndex of activeWindowIndices) {
      const window = windows[windowIndex];
      if (!window || state.dayOfYear !== window.startDay) {
        continue;
      }

      const rolledYear = Number(sampleZone.rolledYearByWindow?.[windowIndex]);
      if (rolledYear === state.year) {
        continue;
      }

      for (const tile of zoneTiles) {
        tile.groundFungusZone.yieldCurrentGrams = 0;
        if (!tile.groundFungusZone.rolledYearByWindow) {
          tile.groundFungusZone.rolledYearByWindow = {};
        }
        tile.groundFungusZone.rolledYearByWindow[windowIndex] = state.year;
      }

      const availableTargetIndices = new Set(
        zoneTiles
          .map((tile, index) => (tile.plantIds.length === 0 ? index : -1))
          .filter((index) => index >= 0),
      );

      let pendingBlockedSuccesses = 0;
      for (let index = 0; index < zoneTiles.length; index += 1) {
        const tile = zoneTiles[index];
        const chance = Number(tile.groundFungusZone.annualFruitChance);
        const safeChance = Number.isFinite(chance) ? Math.max(0, Math.min(1, chance)) : 0;

        if (rng() > safeChance) {
          continue;
        }

        if (availableTargetIndices.has(index)) {
          tile.groundFungusZone.yieldCurrentGrams = rollGroundFungusYield(tile.groundFungusZone, tile, rng);
          availableTargetIndices.delete(index);
        } else {
          pendingBlockedSuccesses += 1;
        }
      }

      while (pendingBlockedSuccesses > 0 && availableTargetIndices.size > 0) {
        const candidates = [...availableTargetIndices];
        const targetIndex = candidates[Math.floor(rng() * candidates.length)];
        const targetTile = zoneTiles[targetIndex];
        targetTile.groundFungusZone.yieldCurrentGrams = rollGroundFungusYield(
          targetTile.groundFungusZone,
          targetTile,
          rng,
        );
        availableTargetIndices.delete(targetIndex);
        pendingBlockedSuccesses -= 1;
      }
    }
  }
}

export function assignGroundFungusZoneToTileImpl(tile, fungus, zoneId) {
  tile.groundFungusZone = {
    type: 'ground_fungus_zone',
    speciesId: fungus.id,
    zoneId,
    annualFruitChance: fungus.annualFruitChance,
    fruitingWindows: fungus.fruitingWindows.map((window) => ({ ...window })),
    perTileYieldRange: [...fungus.perTileYieldRange],
    yieldCurrentGrams: 0,
    rolledYearByWindow: {},
  };
}

export function generateGroundFungusZonesInternalImpl(state, rng, deps) {
  const {
    GROUND_FUNGUS_CATALOG,
    computeGroundFungusSoilMatch,
    isRockTile,
    rangeRollIntRandom,
    tileIndex,
    inBounds,
    assignGroundFungusZoneToTile,
  } = deps;
  if (state.groundFungusZonesGenerated) {
    return;
  }

  const eligibleSpecies = GROUND_FUNGUS_CATALOG.filter((fungus) => state.tiles.some(
    (tile) => computeGroundFungusSoilMatch(fungus, tile) > 0,
  ));
  if (eligibleSpecies.length === 0) {
    state.runGroundFungusPool = [];
    state.groundFungusZonesGenerated = true;
    return;
  }

  const shuffled = [...eligibleSpecies].sort(() => rng() - 0.5);
  const desiredPoolSize = 4 + Math.floor(rng() * 4);
  const poolSize = Math.max(1, Math.min(desiredPoolSize, shuffled.length));
  const runPool = shuffled.slice(0, poolSize);

  state.runGroundFungusPool = runPool.map((fungus) => fungus.id);

  for (const fungus of runPool) {
    const candidateTiles = state.tiles.filter(
      (tile) => !tile.waterType && !isRockTile(tile) && computeGroundFungusSoilMatch(fungus, tile) > 0,
    );
    if (candidateTiles.length === 0) {
      continue;
    }

    const zoneCount = rangeRollIntRandom(fungus.zoneCountRange, rng, 15);
    const placedCenters = [];

    for (let zoneIndex = 0; zoneIndex < zoneCount; zoneIndex += 1) {
      let centerTile = candidateTiles[Math.floor(rng() * candidateTiles.length)];
      if (placedCenters.length > 0) {
        const anchor = placedCenters[Math.floor(rng() * placedCenters.length)];
        let walkX = anchor.x;
        let walkY = anchor.y;
        const walkSteps = 3 + Math.floor(rng() * 12);

        for (let step = 0; step < walkSteps; step += 1) {
          const directionRoll = rng();
          if (directionRoll < 0.25) {
            walkX -= 1;
          } else if (directionRoll < 0.5) {
            walkX += 1;
          } else if (directionRoll < 0.75) {
            walkY -= 1;
          } else {
            walkY += 1;
          }
          walkX = Math.max(0, Math.min(state.width - 1, walkX));
          walkY = Math.max(0, Math.min(state.height - 1, walkY));
        }

        const walkedTile = state.tiles[tileIndex(walkX, walkY, state.width)];
        if (walkedTile && !walkedTile.waterType && !isRockTile(walkedTile)
          && computeGroundFungusSoilMatch(fungus, walkedTile) > 0) {
          centerTile = walkedTile;
        }
      }

      if (!centerTile) {
        continue;
      }

      placedCenters.push({ x: centerTile.x, y: centerTile.y });
      const zoneRadius = rangeRollIntRandom(fungus.zoneRadiusRange, rng, 3);
      const zoneId = `${fungus.id}:${zoneIndex + 1}`;

      for (let oy = -zoneRadius; oy <= zoneRadius; oy += 1) {
        for (let ox = -zoneRadius; ox <= zoneRadius; ox += 1) {
          const nx = centerTile.x + ox;
          const ny = centerTile.y + oy;
          if (!inBounds(nx, ny, state.width, state.height)) {
            continue;
          }
          if (Math.hypot(ox, oy) > zoneRadius) {
            continue;
          }

          const tile = state.tiles[tileIndex(nx, ny, state.width)];
          if (tile.waterType || isRockTile(tile)) {
            continue;
          }
          if (tile.groundFungusZone && tile.groundFungusZone.speciesId !== fungus.id) {
            continue;
          }
          if (tile.groundFungusZone && tile.groundFungusZone.speciesId === fungus.id) {
            continue;
          }
          if (computeGroundFungusSoilMatch(fungus, tile) <= 0) {
            continue;
          }

          assignGroundFungusZoneToTile(tile, fungus, zoneId);
        }
      }
    }
  }

  state.groundFungusZonesGenerated = true;
}
