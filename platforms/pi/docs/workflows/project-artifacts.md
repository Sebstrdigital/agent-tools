# Project-local artifacts and housekeeping

Keep implementation workspace isolation without scattering task files. This is guidance, not an OS sandbox or a new cleanup service. Project rules and actual user authority govern actions; loading this document grants no deletion, installation or release permission.

## Choose locations before writing

- Identify the **owning project root**, including the wrapper when work spans its submodules. Keep agent-created scripts, logs, screenshots, reports, caches and linked worktrees inside that boundary by default. Do not use sibling directories, home-level artifact folders or `/tmp` merely for convenience. An explicit approved location is an exception; a dirty checkout is not.
- Reuse project conventions. Otherwise use one ignored `.agent-work/<task>/` directory for disposable working files and worktrees. Add only the workspace ignore rule, not broad ignores that hide deliverables. Keep source/tests in their normal locations and durable documentation/evidence in the project's existing docs structure. Do not create a new report or manifest for every step; conversation or the existing task record is enough.
- Resolve paths and existing symlinks before writing. A lexical path inside the project is insufficient if its destination escapes it. Do not use symlinks to bypass the boundary, store scratch in another repository, or copy credentials into a workspace.
- Configure writable output paths where supported: for example `TMPDIR`, test reports, browser screenshots and compiler caches. Existing shared tool caches and harness-managed sessions, packets and automatic output spill files are infrastructure, not a scratch destination for intentional project artifacts. Do not relocate, delete or reconfigure shared infrastructure as incidental housekeeping. Disclose unavoidable external tool output; stop or ask for an explicit exception if a required operation cannot honor the boundary.
- For approved remote validation, name the project-specific remote workspace and permitted resource lifecycle. Do not assume a local task grants remote provisioning or teardown authority. Prefer an existing approved namespace; do not scatter remote directories either.

## Carry ownership through execution

Include the project root, task workspace, retained-output locations, approved exceptions and cleanup responsibility in delegation packets and continuations. Independent writers still need distinct linked worktrees. Put newly authorized worktrees under the project-local workspace; if tooling cannot support that layout, serialize work or resolve an explicit exception, not an automatic external fallback. Existing external worktrees are not retroactively disposable.

Establish applicable **cleanup authority** before deletion. An adopted project rule may provide a standing grant for precisely defined task-owned disposables; otherwise request the missing permission. Implementation authority or green tests alone do not authorize deletion. In delegated delivery, workers perform cleanup under their grants; the lead inspects and accepts it. Do not overlap another worker's ownership.

## Completion includes housekeeping

Before claiming the task finished:

1. Select useful final evidence and reusable scripts. Promote them to normal project locations, update evidence links and verify the retained files exist. Do not delete an HTML/JSON deliverable, a pending review screenshot or the only useful failure evidence as if it were scratch. Each retained working artifact needs a purpose and, when still temporary, a next action.
2. Reconcile workers, processes and task-owned runtime resources. Remove only confirmed disposable assets within applicable cleanup authority. Preserve dirty or unique work, user files, unrelated caches, shared services, databases and deployment resources. Never infer ownership from a filename or directory age.
3. For completed worktrees, verify no active owner, no uncommitted/untracked work and no unique commits that would be lost. Use `git worktree remove`; never use force, blanket `rm`, branch deletion or global pruning to get past a safety refusal. Preserve and report uncertain ownership or blocked removal.
4. Check the task-owned diff and reconcile the original cleanup scope, not just the last successful subtask. Verify known working paths, retained evidence and every scoped scan. Report what was removed, what was intentionally retained and why, and any housekeeping blocked by permission or ownership. Keep this concise in the existing handoff; no mandatory cleanup-report suite.

## Verify inventory fail-closed

Distinguish **successfully empty**, **items remaining**, and **scan failed**. A failed or unperformed scan is unresolved, never evidence of absence. Use portable enumeration on the actual host; macOS `find` does not support GNU `-printf`. Do not hide inventory errors with `2>/dev/null`, mask failure behind a successful pipeline, or treat successful tool transport as successful execution. Check the returned exit code/error fields and the complete scoped result before accepting it.

The optional read-only [cleanup inventory helper](../../scripts/cleanup-inventory.mjs) uses Node filesystem APIs rather than shell `find`. Invoke it by absolute physical toolkit path; repeat flags as needed, quoting paths and purposes:

```sh
node /absolute/pi-toolkit/scripts/cleanup-inventory.mjs \
  --scan /absolute/project/.agent-work/task \
  --removed /absolute/project/known-disposable-file \
  --retained /absolute/project/docs/final-evidence.log 'Final validation evidence'
```

`--scan` lists immediate children, not recursive contents; each child remains unresolved unless explicitly retained with a purpose. Retaining a directory does not validate its contents. `--removed` checks exact known paths, including dangling symlinks. `--retained` verifies existence and requires a purpose; it does not prove evidence quality. Missing scan directories, unreadable paths, invalid scope and unverified symlink scan/retention targets are errors. Exit **0** means the supplied scope reconciles, **1** means artifacts remain, and **2** means verification failed. JSON records each result. A missing expected-removed path is a success, but a missing scan directory is not a successful empty scan: use `--removed` when the directory itself should be gone.

The helper neither discovers ownership nor deletes files, inspects Git reachability, checks processes or verifies remote resources. Supply the whole applicable known-path scope, not a convenient passing subset. A passing subset is not global cleanup completion. For remote resources use their authorized native checks and inspect results explicitly; do not copy data locally just to use this helper. No persistent manifest, watcher or automatic cleanup is required.

A feature may be accepted while housekeeping remains blocked, but that is an explicit outstanding item—not a claim that cleanup passed. This guidance does not authorize sweeping historical artifacts or replacing another session's cleanup task.
