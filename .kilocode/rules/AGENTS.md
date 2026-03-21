# Agent Instructions: CocoIndex Semantic Search

Use CocoIndex for fast semantic code context before broad file reads.

## Preferred commands (Windows)

- Search:
  - `tools\\ccc.cmd search "<query>" --limit 5`
- Status:
  - `tools\\ccc.cmd status`

## When to use semantic search

- Unknown implementation location (feature by behavior, not filename)
- Cross-cutting logic (state updates, event flow, side effects)
- Fuzzy/conceptual lookups before regex or full-file reads

## Process

1. Run CocoIndex search first for concept-level requests.
2. Open only top matching files/line ranges.

## Notes

- Project index storage is in `tools/.cocoindex_code`.
- `.cocoindex_code` at repo root is a junction to `tools/.cocoindex_code` for CLI compatibility.
- `tools/ccc.cmd` sets UTF-8 output to avoid Windows cp1252 Unicode errors.
