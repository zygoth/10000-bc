const LATEST_FIXTURE_VERSION = 1;

function clonePlainObject(value) {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  return JSON.parse(JSON.stringify(value));
}

function ensureFixtureDocumentShape(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('Invalid fixture document: expected object');
  }

  const fixtureVersion = Number.isInteger(input.fixtureVersion) ? input.fixtureVersion : 1;
  const schemaVersion = Number.isInteger(input.schemaVersion) ? input.schemaVersion : 1;
  const fixtureId = typeof input.fixtureId === 'string' && input.fixtureId ? input.fixtureId : 'unnamed-fixture';
  const state = input.state && typeof input.state === 'object'
    ? clonePlainObject(input.state)
    : clonePlainObject(input);

  if (!state || typeof state !== 'object') {
    throw new Error('Invalid fixture document: missing state payload');
  }

  return {
    fixtureId,
    fixtureVersion,
    schemaVersion,
    source: input.source && typeof input.source === 'object' ? clonePlainObject(input.source) : {},
    state,
  };
}

export function applyFixtureMigrations(inputFixture, options = {}) {
  const fixture = ensureFixtureDocumentShape(inputFixture);
  const targetVersion = Number.isInteger(options.targetVersion)
    ? options.targetVersion
    : LATEST_FIXTURE_VERSION;

  if (fixture.fixtureVersion > targetVersion) {
    throw new Error(
      `Unsupported fixture version ${fixture.fixtureVersion}; target is ${targetVersion}`,
    );
  }

  // Placeholder for future versioned migrations. We keep this explicit so
  // fixture compatibility updates can evolve without regenerating worlds.
  fixture.fixtureVersion = targetVersion;
  return fixture;
}

export function getLatestFixtureVersion() {
  return LATEST_FIXTURE_VERSION;
}

