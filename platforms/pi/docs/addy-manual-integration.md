# Manual-quiescence three-builder integration

`scripts/addy-integrate.mjs` is the normal CLI for preparing three independent
builders from one dirty baseline and composing their disjoint outputs into a
**new project-local linked worktree**. It does not merge or commit anything.
The parent/operator inspects and accepts the result separately.

## Contract and authority

Every command requires both:

- `--authorize-local-integration`: caller authorization to read the explicitly
  selected source/builder/target content and local Git controls, read/write the
  named coordination artifacts and journal, create fresh linked worktrees and
  their Git control/index files, and write fresh target content. This flag is a
  local caller declaration, **not authenticated user consent** or a permission
  service. A saved request or approval label supplies no independent authority.
- `--declare-inputs-quiescent`: caller declaration that all source and builder
  writers have stopped and their attempts/resources have been reconciled. Stop
  and reconcile writers again before each output capture, plan, integration or
  observation. The CLI does **not** detect, stop or lock writers. Read-only
  `inspect` and `reconcile` also require these explicit declarations.

This is a **trusted-local-process** design. Multi-pass hashing detects observed
persistent drift; it cannot prove continuous quiescence or prevent transient
mutation. It is not a hostile-process sandbox. Do not run this on unapproved
private data, or while builders, editors, formatters, Git commands, watchers or
other writers can change the inputs. Git hooks and filters are not run by the
materialization path; unsupported local Git configuration is rejected by the
candidate observer.

The supported runtime is Node with `import.meta.main` (tested with Node 25.9.0),
Darwin, and `git version 2.54.0 (Apple Git-157)`. Other materialization runtimes
are rejected; no untested cross-platform safety claim is made.

## Normal CLI path

Use an absolute real owning worktree root. All control IDs and task/builder
names are single ASCII identifiers (`A-Za-z0-9_-`, starting alphanumeric, at
most 64 characters); the combined `TASK-BUILDER` must also fit. All four names
must be distinct ignoring case. Targets are fixed beneath
`.agent-work/linked-worktrees/TASK-NAME` and must not already exist, nor may
`.git/worktrees/TASK-NAME` already exist. Arbitrary existing worktrees are not
adopted.

In these Bash examples, `CLI` is the absolute path to the installed source
script. JSON is supplied as one argument, not a filename:

```bash
CLI=/absolute/path/to/pi-toolkit/scripts/addy-integrate.mjs
PROJECT=/absolute/path/to/authorized/project
TASK=trial
AUTH=(--authorize-local-integration --declare-inputs-quiescent)
```

### 1. Prepare exactly three builders

Explicitly select **every inventoried path** outside the declared excluded
directory prefixes. `exclude` must be empty. HEAD/index paths that are currently
missing on disk must still be selected. Git ignore rules are deliberately not
used to infer authority. `addy-candidate.mjs PROJECT
--authorize-repository-control inventory` can enumerate a fully authorized
simple source; add explicit `--authorize-excluded-prefixes --exclude-prefix
PREFIX` when approved directory-prefix pruning is needed. Inspect that list and
supply the approved selection, rather than treating enumeration as permission.

For example, a source with exactly these four paths:

```bash
CONFIG='{"builders":["one","two","three"],"target":"combined","excludedPrefixes":[],"selection":{"include":[".gitignore","PLAN.md","README.md","docs/roles-library.md"],"exclude":[]}}'
node "$CLI" "$PROJECT" prepare "$TASK" "$CONFIG" "${AUTH[@]}"
```

This retains the owner's selected dirty baseline and fresh manifests/selections
for all three builders, journaling intent **before** any builder creation. It
preserves HEAD, the staged index independently of worktree bytes, staged and
unstaged deletions/additions, ordinary permission bits and executable files.
The prepared workspaces and their digest references are printed. Each builder
starts with the same content projection; their coordination marker identities
are independently bound in retained evidence. The owner's index/content are
not rewritten. Linked-worktree Git bookkeeping is necessarily created in the
shared repository control directory.

Builders may now edit their assigned disjoint paths in their own workspaces.
Do not edit the owning source. Reconcile/stop all builder writers before
continuing. Dependent builders are intentionally unsupported.

### 2. Retain each explicitly selected output

Pass a full, approved current selection for that builder, including new output
paths. Old prepared selections/manifests are never replaced. For a builder
that only edited `README.md`:

```bash
ONE='{"builder":"one","selection":{"include":[".gitignore","PLAN.md","README.md","docs/roles-library.md"],"exclude":[]}}'
node "$CLI" "$PROJECT" output "$TASK" "$ONE" "${AUTH[@]}"
```

Repeat for `two` and `three`. For each, the CLI returns:

```json
{
  "id": "one",
  "preparedDigest": "<64 lowercase hex characters>",
  "outputDigest": "<64 lowercase hex characters>",
  "selectionDigest": "<64 lowercase hex characters>",
  "dependencies": []
}
```

Outputs may use a new retained selection instead of the prepared `selection.json`.
An unchanged selection or candidate reuses matching retained evidence without
rewriting it. Partial evidence from an interrupted capture is retained. No
background output worker or journal editing is required.

### 3. Plan, then integrate

Build a request containing those three descriptors, plus the exact authorized
changed-path array for each. `paths` includes paths changed in either the index
or worktree **relative to that builder's prepared dirty baseline**, not relative
to HEAD. A staged-only change is still a change. `paths: []` is permitted only
for an unchanged output. The descriptors below are schematic: replace the hash
placeholders with the actual returned hashes.

```json
{
  "attempt": "integrate-1",
  "builders": [
    {"id":"one","preparedDigest":"<prepared-one>","outputDigest":"<output-one>","selectionDigest":"<selection-one>","dependencies":[],"paths":["README.md"]},
    {"id":"two","preparedDigest":"<prepared-two>","outputDigest":"<output-two>","selectionDigest":"<selection-two>","dependencies":[],"paths":["PLAN.md"]},
    {"id":"three","preparedDigest":"<prepared-three>","outputDigest":"<output-three>","selectionDigest":"<selection-three>","dependencies":[],"paths":["docs/roles-library.md"]}
  ]
}
```

Put that JSON in a shell variable `REQUEST`, then:

```bash
node "$CLI" "$PROJECT" plan "$TASK" "$REQUEST" "${AUTH[@]}"
node "$CLI" "$PROJECT" integrate "$TASK" "$REQUEST" "${AUTH[@]}"
node "$CLI" "$PROJECT" observe "$TASK" "${AUTH[@]}"
```

`plan` performs no writes. Both plan/integrate freshly verify the retained owner
baseline and each current output against its exact retained selection, and
validate every historical prepared manifest/selection against its recorded
identity and the freshly verified common baseline. Historical prepared
worktrees have since changed: the CLI does not falsely compare their old digest
to current output bytes. Retained prepared HEAD/index/worktree content hashes
must match the common baseline; current owner verification rehashes those
baseline Git blobs and worktree files.

Changed paths must exactly match the declared sets. Cross-builder overlaps,
case aliases, file/descendant collisions, stale source/output/control identity,
undeclared/unselected content, unsupported states, and changed HEAD/tree or
exclusions are rejected. There is no automatic conflict resolution, even for
identical edits to the same path.

`integrate` journals an immutable running attempt first, creates a **fresh**
combined worktree, builds its index from the planned staged objects, and writes
its files from verified owner/builder sources. It observes the target against
the planned projection and reverifies inputs twice before recording prepared
evidence. The result is `verified-awaiting-acceptance`, not accepted, merged or
committed. The integration remains running with prepared evidence so an
interruption or an operator rejection cannot silently make it reusable. The
separate `observe` command freshly rechecks the retained inputs, target identity,
selection and result digest; later drift is not hidden by a success record.

`plan`/`integrate` require an absent combined target. After materialization use
`observe`, not `plan` or a replay of `integrate`. Parent acceptance is external
to this CLI; no integration acceptance/commit command is supplied.

## Interruptions and reconciliation

```bash
node "$CLI" "$PROJECT" inspect "$TASK" "${AUTH[@]}"
# After operator inspection of the printed attempt and retained filesystem:
RECONCILE='{"attempt":"integrate-1","expectedRevision":3,"outcome":"abandoned","note":"Inspected retained partial target and reconciled writers/resources; preserve all content."}'
node "$CLI" "$PROJECT" reconcile "$TASK" "$RECONCILE" "${AUTH[@]}"
```

Use the actual revision from `inspect`. Outcomes are `failed` or `abandoned`.
Reconciliation records an explicit operator note; it does not claim to inspect
resources for the caller. It **never** resumes copying, adopts a target, removes
files/controls, rolls back, or deletes retained evidence. An attempt ID cannot
be replayed. Unresolved attempts block new attempts. Even after reconciliation,
a preexisting partial/full target blocks materialization.

If only intent was written and no target exists, an explicitly reconciled
integration may use a fresh attempt ID. If a target/partial preparation exists,
preserve it for inspection and use a fresh authorized repository/workspace for
a new run; this compact CLI does not implement retention cleanup or adoption
of prior task boundaries. A failure during initial validation before graph
creation may leave an incomplete named coordination directory; it too is
retained and cannot be adopted. A corrupt/truncated journal is rejected, not
repaired or replayed automatically. No live application is stopped by this CLI.

## Deliberate limits

- Exactly three independent builders; one owning worktree; one fresh target.
  No changed HEAD/tree, merge conflicts, intent-to-add, assume-unchanged,
  skip-worktree, submodules, symlinks, special files/modes, or aliased paths.
- Complete selected candidate scope. Individual path exclusions are unsupported;
  explicitly authorized real directory-prefix exclusions may be unobserved but
  must not overlap tracked paths, control boundaries or selected content.
- Manifest exclusions remain explicit: ownership/timestamps, directory modes and
  empty directories, ACLs/xattrs, hard-link topology, index stat cache, external
  resources and Git metadata beyond the selected HEAD/tree/index are not
  materialized-equivalence claims. Coordination and nested builder contents are
  excluded from the owning content digest, with declared control identities
  checked separately. Prefix-excluded content is not copied.
- Candidate limits are 16 MiB per file and 128 MiB per observation; journal
  references are bounded to 4096 UTF-16 code units and serialized entries to
  1 MiB of UTF-8. Preparation budgets its init/start/eventual finish before
  creating coordination artifacts. Plan/integrate budget both intent and the
  complete eventual publication before any journal/target mutation. This uses
  the graph's own reference validator and serializer, actual paths/request/
  selection/exclusions (including JSON escaping), exact-width placeholders for
  unknown SHA-256 fields, and a conservative maximum-width journal envelope.
  A fitting taskRef alone is insufficient; an oversized resultRef is rejected
  while the target is still absent. No implicit spill files or raised limits
  are used. No install, publish, cleanup or release step.

## Validation

All integration tests create fresh project-local synthetic repositories with
`tests/fixtures/synthetic-git.mjs`; they neither clone/copy project objects nor
read prior retained fixtures. The helper manufactures only synthetic test Git
objects and a synthetic initial commit object. Tests make no real commits or
merges. Fixtures/evidence are retained without cleanup.

```bash
node --test --test-reporter=tap tests/addy-integrate.test.mjs tests/addy-integrate-cli-interruption.test.mjs tests/addy-integrate-budget.test.mjs
mkdir -p .agent-work/parallel-addy
node --test --test-reporter=tap tests/addy-integration-plan.test.mjs tests/addy-graph.test.mjs tests/addy-materialize.test.mjs tests/addy-materialize-failures.test.mjs tests/addy-prefix-exclusion.test.mjs tests/addy-prefix-auth-order.test.mjs
```

The first suite exercises the normal CLI dirty-baseline three-builder path,
conflicts, stale/undeclared content, unsupported states, preservation, six
injected interruption boundaries, preparation interruption, drift during/after
publication, and termination of an actual task-owned CLI child with SIGTERM.
The SIGTERM test targets only its own child; unrelated applications are untouched.
Publication-budget tests use quotes, a newline and Unicode in synthetic names:
a complete 4096-code-unit resultRef succeeds, while 4097 is rejected by both
plan/integrate with the taskRef still fitting, unchanged journal/input hashes,
and no target or target Git control created. An oversized preparation reference
is rejected before even creating its coordination boundary. Graph tests cover
reference escaping/UTF-16 semantics and the serialized 1 MiB entry boundary.
