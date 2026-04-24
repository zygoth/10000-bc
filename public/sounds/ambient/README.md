# Ambient audio files

Place generated **`.ogg`** (or **`.wav`**) files here so paths match the ambient catalog.

## Variations (`_v1`, `_v2`, …)

For a catalog path like `meleagris_gallopavo_gobble.ogg` you can add **extra** files on disk:

- `meleagris_gallopavo_gobble.ogg` (base, optional if you only use variants)
- `meleagris_gallopavo_gobble_v1.ogg`, `meleagris_gallopavo_gobble_v2.ogg`, …

Run **`npm run sounds:missing`** from the repo root. That refreshes `missing-sounds-report.json` and writes **`variant-manifest.json`** in this folder listing which files exist. At runtime, **one-shots** pick a file **uniformly at random** from the group; **loops** (campfire, beehive, etc.) pick **one** variant when the loop **starts** and keep it until the loop stops or the catalog URL for that loop changes.

URLs in [`src/ambientAudio/catalog/*.json`](../../src/ambientAudio/catalog/) are rooted at site root, for example:

- `public/sounds/ambient/meleagris_gallopavo_gobble.ogg`
- `public/sounds/ambient/meleagris_gallopavo_flyover.ogg`
- `public/sounds/ambient/magicicada_septendecim_buzz.ogg`
- `public/sounds/ambient/pseudacris_crucifer_peep.ogg`

…plus campfire, beehive, and camp maintenance paths from the same catalog folder.

After adding or renaming files, run `npm run sounds:missing` from the repo root to refresh `missing-sounds-report.json` and `variant-manifest.json`.

See [`docs/ambient_audio.md`](../../docs/ambient_audio.md).
