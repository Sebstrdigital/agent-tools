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

## Current-source refresh

The user approved refreshing the Pi preservation copy from its current working tree, including uncommitted source and workflow changes, while excluding personal data, logs and experimental evidence from publication. The original Pi source was at `5bc3bb043b339827f1b275c1150dc423f75a74f5` with uncommitted changes; the Claude source remained clean at `137884490da84a7c106c0aec636835d4e0a96cd8` and its tracked files matched the copy.

The refresh updated 45 and added 148 publishable Pi files, including supporting tests and vendor licenses. Previous tracked variants remain available at agent-tools commit `c7ddcc2`; the original repositories and live installations remain unchanged. The initial local manifest records the earlier snapshot, not the refreshed Pi tree. Historical and experimental evidence, logs, screenshots, drafts, retrospectives, trial documents and personal handover material were not published. Some imported documents may still reference excluded local evidence.

The 193 refreshed files matched their corresponding source bytes. A targeted credential and personal-path pattern scan produced no confirmed findings; it is not a comprehensive privacy audit. The isolated cleanup-inventory unit tests passed (7 tests). No copied installer, live integration or cutover was run or validated.

## Local source consolidation and OMP work profile

On Linux, the user approved preserving reusable capabilities from the local agent repositories, backing up personal settings in `dotfiles`, and trying a proportional OMP work profile. Original repositories, historical variants and live session data remain in place; no installers or hooks were run.

- `agentic-tools` at `137884490da84a7c106c0aec636835d4e0a96cd8`: compared with the existing Claude preservation copy; matching files were not duplicated.
- `ai-engineering` at `53b41df7c80e6c97b88e7fbda71804c1bacdfc86`: six reusable files preserved under `sources/ai-engineering/`.
- `claude-dot-files` at `4af04ca4dd179fe702145af20b77a9ec16ebca04`: 39 distinct capability and supporting files under `sources/claude-dot-files/`; identical files were not duplicated. Personal workflows and machine-specific settings were excluded.
- `pi-toolkit` at `5bc3bb043b339827f1b275c1150dc423f75a74f5`: 43 differing source files and relevant vendor notices under `sources/pi-toolkit/`; the later `platforms/pi/` preservation copy was not overwritten. Historical handoffs, retrospectives and evidence were excluded.

The 88 source-variant files were compared byte-for-byte with their source paths. These partial trees are not independently installable and may reference dependencies in the existing platform copies. No repository license was found for the `ai-engineering` or `claude-dot-files` inputs; inclusion is not permission to redistribute them. Filename and common credential-pattern checks are not a comprehensive privacy audit.

`platforms/omp/` contains the nine locally available OMP agent definitions and a work-profile rule revised for proportional delegation. The live `omp-work` profile links to that rule; the original saved rule remains under `~/.omp/disabled-rules/`. Personal settings, a rule snapshot, launcher and restoration notes were added to the separate `dotfiles` repository. Credentials, databases, history and caches were not copied. Both launch paths were exercised; no installer, cross-platform restoration or specialist execution was validated.

## OMP integration

`platforms/omp/` is a new harness-specific home, not a preservation copy or a cutover. Its installer links an explicitly selected OMP skill or workflow rule without replacing existing paths. It does not install shared skills, change settings, or activate extensions or hooks. The user approved live installation of the workflow rule in the default OMP profile; it is linked into that profile. Other live installations and cutover remain unapproved.

The proposed OMP software-team setup is source-only, not a live cutover. Seven agent profiles are under `platforms/omp/agents/`; the existing scout, reviewer, and security reviewer are not replaced. The installer can link an explicitly selected candidate agent without overwriting existing paths. `platforms/omp/candidates/agent-tools-development-workflow.md` is an orchestrator-first replacement candidate, not an additional rule to apply alongside the installed workflow. `platforms/omp/agent-team-research.md` records tool, skill and delegation proposals.

Isolated installer checks passed for seven agent links, idempotency, original workflow installation, rejection of unsupported names, and preservation of an existing file. In an isolated OMP v18.22.0 temporary project, the session lead loaded the candidate as an appended system prompt, delegated an exact file creation to a worker, and verified its output. A second appended-prompt session dispatched `backend-developer` and created skill-specified text; the lead itself read the skill, so worker-side skill loading was not independently established.

With the candidate installed as a project rule, a separate session could quote its delegation requirement, but two other small file-creation trials wrote directly instead of delegating. One trial preceded addition of `agents: main` and one followed it. No causal explanation was established. The rule-only design therefore fails to establish the requested always-delegate behavior. These limited trials do not establish effective tool isolation, nested delegation, model routing, broad agent quality or live readiness. Existing live configuration and the installed rule were not changed.

An explicitly loaded, source-only prototype in `platforms/omp/experiments/` blocks direct lead `write`/`edit` calls but is not installed. In isolated OMP v18.22.0 trials a direct lead write was blocked, a delegated worker created the requested file, and a lead shell command bypassed the guard. The worker trial did not establish whether the extension was active inside the worker. Mocked guard tests passed; this is not an enforcement guarantee or a sandbox. Live activation and a stronger execution boundary remain unapproved.

A subsequent explicit-extension OMP v18.22.0 trial observed the extension in a worker and `ctx.agent.kind=sub`; other propagation and launch modes remain unverified. An isolated macOS Seatbelt subprocess experiment passed four smoke tests for fixture reads, `/dev/null`, denied file mutations and denied loopback bind. It is not integrated with OMP or a comprehensive security boundary; the source-only prototype and its limitations are documented in `platforms/omp/agent-team-research.md`.

The installer now exposes `--team-workflow` for explicit isolated installation of the replacement candidate. It uses the same destination as `--workflow` and refuses to overwrite a different existing link or file. Isolated checks passed for installation, idempotency and collision refusal in both directions. This does not detect conflicting rules under other filenames or authorize live replacement; Linux validation remains outstanding.

In a macOS temporary-project trial with skills disabled and the candidate appended as a system prompt, all seven specialist profiles were dispatched and completed. The lead requested a frontend repair and independent checks passed for basic backend/frontend validation and SQLite constraints. This explicitly directed trial does not establish normal rule-only delegation, dynamic skill selection, comparative agent quality, or Linux portability. Docker's daemon was unavailable and Podman listed no machines; neither was started or configured.

A separate skill-enabled temporary-project trial dispatched the backend specialist, which reported reading a locally discoverable task-relevant skill and produced the exact convention from its body; the lead did not read the skill before delegation. This verifies one skill-selection scenario, not missing-skill behavior or every profile.

The user subsequently approved a live trial in the default OMP profile. Seven specialist profiles were linked into `~/.omp/agent/agents/`; the existing workflow link was switched to the team candidate, leaving the original source intact. No model settings, existing reviewer profiles, skills, extensions or hooks were changed. `platforms/omp/README.md` describes rollback. Fresh OMP v18.22.0 sessions confirmed the loaded instruction and successfully dispatched the installed backend specialist when explicitly requested; a separate simple implementation request was performed directly by the lead. Automatic delegation remains guidance, not a guarantee.

After a live-trial retrospective, the user approved a small workflow refinement and installation. The installed candidate now makes warranted independent review a prerequisite to consequential deployment, requires affected behavior and failure-path rechecks after repairs, and tracks specialist safety conditions before state-changing checks. A staged OMP trial explicitly requested a consequential simulated deployment; the lead completed independent review and behavior checks before requesting publication, and the two published files passed independent basic checks. The session timed out while waiting for the publishing worker, so a clean final handoff was not established. A separate no-tools scenario declined an unapproved external probe. A single-small-change scenario was blocked by conflicting higher-priority delegation instructions. A fresh session after installation summarized the new rule correctly; these observations do not prove enforcement or automatic behavior for all tasks.

## Local reconciliation with origin/main

On 2026-11-23, the user approved updating this checkout to fetched `origin/main` and selecting its proportional workflow for the default OMP profile, while preserving unique local work and trial evidence. The repository was fast-forwarded from `bec93cd` to `b5a7faf` without a new commit or push. The preceding Linux consolidation record and macOS OMP integration/trial record above are retained as historical evidence; their descriptions of live links and source locations describe those earlier stages, not a fresh installation by this reconciliation.

A pre-reconciliation backup of the modified README, full migration history, and complete local `platforms/omp/` tree is retained outside the repository, along with the original tracked diff, status, revision IDs and fast-forward output. Seven overlapping untracked specialist definitions were byte-identical to the incoming files and are now supplied by the fetched commit. The differing old local rule is preserved unchanged at `platforms/omp/candidates/agent-tools-development-workflow-original.md`; the remote proportional rule occupies `platforms/omp/rules/agent-tools-development-workflow.md`.

The local installer, team candidate, research and experiments remain preserved. Its `--workflow` option now selects the remote proportional rule; `--team-workflow` still selects the unchanged team candidate. The two additional fetched profiles, `complex-task` and `complex-reviewer`, are source only and are not supported by the preserved installer. The README and rollback instructions distinguish these variants. This repository reconciliation did not touch `~/.omp`, run an installer, install agents, activate an experiment, or run tests; any authorized default-profile link change is a separate live operation.
