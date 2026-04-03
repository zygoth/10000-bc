# Steam Game Template

Starter scaffold for:
- React (CRA)
- Electron desktop build/package
- Steam API integration via `steamworks.js`
- Capacitor mobile wrappers

## Quick start

```bash
npm install
npm run start
```

## Run in Electron

```bash
npm run electron:start
```

To initialize Steam in Electron main process, set:

- PowerShell: `$env:ELECTRON_USE_STEAM='true'`
- CMD: `set ELECTRON_USE_STEAM=true`

Then run `npm run electron:start`.

## Package Electron apps

```bash
npm run electron:package:win
npm run electron:package:mac
npm run electron:package:linux
```

## Capacitor

```bash
npm run build
npm run cap:sync
npm run cap:open:android
```

## Notes

- Update app metadata in `package.json` (`name`, `build.appId`, `build.productName`).
- Update Capacitor identity in `capacitor.config.ts`.
- Replace `scripts/steam_appid.txt` with your Steam app id.
- For React/sim state mutation safety, see `docs/state_update_safety.md`.
