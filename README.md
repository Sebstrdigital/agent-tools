# Agent Tools

Shared home for agent skills, reference material, portable utilities, and harness-specific integrations.

## Migration status

This repository preserves working-tree snapshots of `claude-tools` and `pi-toolkit`, alongside later source variants and OMP integrations. Preservation is not functional migration acceptance; live activation and cutover require explicit approval. See the migration record for historical source state and approved trials.

| Path | Purpose |
| --- | --- |
| `skills/` | Shared portable skills, promoted after comparison |
| `docs/` | Shared documentation and migration evidence |
| `tools/` | Harness-independent utilities |
| `platforms/claude-code/` | Preserved Claude working copy |
| `platforms/pi/` | Preserved Pi working copy |
| `platforms/omp/` | OMP profiles, proportional workflow, and preserved local installer and trial candidates |
| `sources/` | Partial, path-preserving source variants awaiting comparison and classification |

The first 11 shared skills are available under `skills/productivity/`; see [shared skills](skills/README.md). `tools/` remains empty pending classification. The Pi preservation copy was refreshed from the source working tree, including uncommitted source changes; private and experimental evidence was excluded from publication. Original instructions and paths may still reference old locations: preservation is not proof of portability. See [migration status](docs/migration.md) for the source revisions and validation limits.

The canonical OMP rule now uses proportional delegation. The earlier local workflow, orchestrator-first candidate, installer, experiments, and trial history are preserved; see [OMP integration](platforms/omp/README.md). The user approved switching the default profile to the proportional rule, but repository updates alone do not install or switch a profile. Machine-specific configuration is managed separately; the Linux `omp-work` and local default-profile trial histories are recorded in [migration status](docs/migration.md).

The source variants are not standalone installations: unchanged dependencies may remain in the platform trees. Their inclusion does not establish distribution rights or approve activation.

## Scope and design

Maintain portable capabilities once while allowing harness-specific execution. A shared repository does not imply identical orchestration or permission models. Compare duplicates before choosing a canonical version; retain supporting references and attribution. Matt Pocock's standalone skills clone remains an external reference, not an additional imported collection.

## Safety and installation

Do not run the preserved Claude or Pi installers or repoint live installations without explicit approval. Pi files may have symlink-aware installation behavior; isolation must be established before testing. The initial copy preserved settings and advisory state without activating them. The separate local OMP installer links an explicitly selected OMP skill, supported specialist, or workflow without replacing existing paths; live use requires approval for that capability. See [migration status](docs/migration.md). The detailed copy verification manifest is retained locally at `docs/migration-copy-manifest.json` and is not published.

The initial copy did not install or activate anything. Publication of shared skills and platform source did not validate live behavior. Subsequent isolated OMP checks and approved live trials have limited, explicitly recorded coverage; they do not validate every installer path, cross-platform restoration, or automatic delegation.

## Development and migration

Keep shared skill resources with their skill. Use isolated destinations when validating installers. Preserve unique local variants and trial evidence, and record approved cutovers separately from source consolidation.

Historical evidence, external reference clones, personal configuration, and the detailed preservation manifest remain local. Their exclusion from Git does not delete the preservation copies. See `docs/migration.md` for the scope and remaining validation.
