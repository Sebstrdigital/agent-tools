# Consolidation migration

## Approved initial step

User selected Direct and approved creation of `/Users/sebastianstrandberg/work/git/agent-tools`, copying both current working trees into platform subfolders, keeping originals and live installations unchanged, and verifying the copies. Local Git initialization was approved; commit, remote, push, installer execution, installation and cutover were not.

## Preserved inputs

- `claude-tools`: revision `137884490da84a7c106c0aec636835d4e0a96cd8`; clean source working tree when copied.
- `pi-toolkit`: revision and dirty working-tree status are recorded in the manifest. All non-excluded working files, including unfinished and untracked work, were copied.

The new repository does not carry either original Git history. Both originals retain that history. Nested Git metadata was excluded, including metadata in Claude's existing external reference clone; its working files were retained.

## Copy validation

Passed for both platform copies:

- Independent source/destination file inventory comparison.
- SHA-256 content comparison.
- Symlink target and file permission comparison.
- Source Git status unchanged before/after copying.

Claude: 122 verified entries, 545,621 bytes.
Pi: 21,401 verified entries, 236,826,089 bytes.

See `migration-copy-manifest.json` for per-file evidence and source state.

### Exclusions

Excluded directory names at any depth: `.git`, `node_modules`, `node-compile-cache`, `__pycache__`.
Excluded filename: `.DS_Store`.
Actual excluded paths are recorded per source in the manifest.

Personal Claude settings and advisory state were copied for preservation, but ignored by the new root Git configuration. They have not been inspected for secrets or approved for publication. Other copied fixtures, logs, external files and artifacts have not received a publication/privacy audit.

## Current limitations

This was a preservation step, not functional migration acceptance. No installers, test suites, agents, hooks, extensions, or external repository scripts were executed. Source-relative paths, absolute old-repository paths, platform assumptions and skill discovery remain to be validated.

The large Pi copy includes existing historical evidence and experimental workspaces. They were retained because the approved scope was preservation, not cleanup. Future archival or removal needs a separate decision.

## Next decisions, not approved implementation

1. Compare overlapping skills and identify genuinely shared content.
2. Agree on placement and ownership of supporting references and portable utilities.
3. Promote shared content without breaking platform paths or discovery.
4. Adapt installer/resource resolution for the new layout.
5. Validate in isolated destinations, then perform approved live trials.
6. Approve cutover only after validation; retain originals until then.

Repository consolidation does not authorize workflow-policy changes.

## Approved shared batch and publication

The user approved promotion of 11 skills, README creation/update, and commit/push to `https://github.com/Sebstrdigital/agent-tools.git`.

Shared skills under `skills/productivity/`: brand-voice, component, page, prd, product-context, refine, ui, ux-audit, ux-copy, grill-me, zoom-out. The first nine preserve the Claude source behavior with neutral invocation/argument wording; the last two match their Pi sources byte-for-byte. Platform variants remain intact. No installers or live configurations were changed.

The publication includes active platform source, tests, vendors with their notices, shared skills and migration documentation. Personal settings/state, historical trial workspaces and logs, external reference clones, the detailed local preservation manifest, and the copied machine-specific Pi CLAUDE.md are excluded from Git. The source handover note is likewise local-only. All preserved copies remain on disk; exclusion is not deletion.

The manifest is intentionally local, so its relative link may not resolve in a fresh remote clone. It is copy evidence, not a required runtime input. Some copied documentation still references historical local evidence; migration must distinguish these from installation/runtime dependencies.

Validation passed for all 11 shared skill names/frontmatter, the exact permitted content transformations, and supporting Markdown links. All preserved platform-file hashes still match the original copy manifest, and the original repositories' Git status is unchanged.

The initial publication set contains 182 files, approximately 1.35 MB. A targeted scan of staged text for private keys, common token formats, credential URLs, and quoted credential assignments found zero matches. This is not an exhaustive privacy/security audit; no dedicated secret scanner was available. Publication exclusions were checked explicitly.

Git's whitespace check reports two intentional Markdown hard-break lines in the preserved `platforms/pi/skills/duadigital-pdf-maker/FORMAT.md` (lines 10–11); those source bytes were deliberately retained. No harness discovery, behavior trials, installer execution, or live cutover is claimed.
