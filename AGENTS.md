# Repository rules

## Purpose

Consolidate shared agent capabilities while preserving useful harness-specific behavior. Shared skills belong in `skills/`, shared references in `docs/`, portable utilities in `tools/`, and harness integrations in `platforms/<harness>/`.

## Migration boundary

The initial platform trees are preservation copies, not validated replacements. Keep the original repositories and current live installations untouched until explicit approved cutover. Do not run copied installers, change live skill roots, activate hooks/extensions, or publish this repository without approval.

Preserve concurrent and uncommitted source work. Compare duplicates before promoting shared content; never silently overwrite variants. Preserve supporting resources and license notices. Skills do not grant tools or permissions.

Platform instructions apply to work in the corresponding platform tree, not as blanket instructions for all harnesses. Inspect relevant local guidance before changes. Original paths and installation assumptions need validation during migration.

## Validation and records

Distinguish byte-for-byte copy verification from installer, resource-path, test, and live harness validation. Use isolated destinations for installation tests and report unavailable evidence. Keep migration decisions and progress in `docs/migration.md`; the initial manifest records source revisions, working-copy status, hashes, and exclusions.

Ask before destructive operations, commits, remote setup, push/publish, or cutover unless the specific action is already approved. The initial approval covered creation, copying, and copy verification. The subsequent approval covers promotion of the first 11 shared skills with portability-only wording changes, README/migration updates, and commit/push of reviewed source. Live installation, cutover, deletion, and workflow-policy changes remain unapproved.
