# Agent Tools

Shared home for agent skills, reference material, portable utilities, and harness-specific integrations.

## Migration status

This repository currently preserves the working copies of `claude-tools` and `pi-toolkit`. The originals and live installations remain authoritative until the reorganized replacements have been validated and an explicit cutover is approved.

| Path | Purpose |
| --- | --- |
| `skills/` | Shared portable skills, promoted after comparison |
| `docs/` | Shared documentation and migration evidence |
| `tools/` | Harness-independent utilities |
| `platforms/claude-code/` | Preserved Claude working copy |
| `platforms/pi/` | Preserved Pi working copy |

The first 11 shared skills are available under `skills/productivity/`; see [shared skills](skills/README.md). `tools/` remains empty pending classification. Platform copies retain their original layout, documentation, installers, tests, and supporting resources. Original instructions and paths may still reference the old locations: preservation is not proof of portability.

## Scope and design

Maintain portable capabilities once while allowing harness-specific execution. A shared repository does not imply identical orchestration or permission models. Compare duplicates before choosing a canonical version; retain supporting references and attribution. Matt Pocock's standalone skills clone remains an external reference, not an additional imported collection.

## Safety and installation

Do not run the copied installers or point live installations at this repository yet. Pi files may have symlink-aware installation behavior; isolation must be established before testing. Existing local settings and advisory state were preserved, not activated. See [migration status](docs/migration.md). The detailed copy verification manifest is retained locally at `docs/migration-copy-manifest.json` and is not published.

The initial copy did not install or activate anything. The approved first publication contains shared skills and platform source, not personal settings or historical trial workspaces. Publication does not mean the new installers or live harness behavior have been validated.

## Development and migration

Keep shared skill resources with their skill. Do not run platform installers against your real home directory during migration. The originals remain in place until an explicitly approved cutover.

Historical evidence, external reference clones, personal configuration, and the detailed preservation manifest remain local. Their exclusion from Git does not delete the preservation copies. See `docs/migration.md` for the scope and remaining validation.
