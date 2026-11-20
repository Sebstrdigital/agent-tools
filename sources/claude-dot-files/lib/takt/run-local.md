# takt — Local Overrides (not managed by install.sh)

User-specific extensions to run.md. Loaded in Phase 0.3b.

---

## Additional Tool Probe: munin (Phase 0.2 extension)

Add to the probe list after jCodeMunch and context-mode:

3. **munin probe** — attempt `mcp__munin__stats`. On success, set `munin.available = true`. On failure:
   a. Check if munin config exists: `test -f ~/.config/munin/config.toml`. If no config, munin is not installed — set `munin.available = false`, no output.
   b. If config exists, probe the HomeLab service with `munin stats` or `munin projects`.
   c. If still unreachable, set `munin.available = false` and print:
      ```
      [takt warn] munin unreachable — cross-session memory disabled for this run. Check munin.local and ~/.config/munin/config.toml.
      ```

Do not auto-start local Munin Docker/Podman containers. The MacBook Munin stack is intentionally stopped; the active service runs on `munin.local`.

Add `"munin": { "available": true/false }` to `.takt/session.json`.

---

## Additional Tool Probe: HomeLab validation VM (Phase 0.2 extension)

Add to the probe list after munin:

4. **validation VM probe** — attempt:
   ```bash
   ssh validation 'hostname && podman --version && podman-compose --version && docker compose version >/dev/null 2>&1'
   ```
   On success, set:
   ```json
   "validation_vm": {
     "available": true,
     "host": "validation.local",
     "ssh": "ssh validation",
     "project_root": "/srv/validation/projects"
   }
   ```
   On failure, set `validation_vm.available = false` and print once:
   ```
   [takt warn] validation.local unreachable — runtime validation must run locally or be skipped by user decision.
   ```

Do not auto-start the old MacBook Podman machine. It was intentionally removed.

---

## Phase 4b override: run local validation on validation.local

When Phase 4b Local Validation runs and `validation_vm.available = true`, execute project runtime checks on the HomeLab validation VM rather than on the MacBook.

Before spawning the validation agent:

1. Derive a project slug from the current repo directory name.
2. Create or reuse `/srv/validation/projects/<project-slug>` on the VM.
3. Sync the working tree there with `rsync`, excluding `.git`, `.takt`, `node_modules`, `.venv`, build output, dependency caches, and secrets unless the project's `.takt/local-validation.md` explicitly requires them.
4. In the validation agent prompt, replace the Project Working Directory with the remote directory and include:
   ```
   Run these checks on validation.local via ssh validation.
   Remote project directory: /srv/validation/projects/<project-slug>
   Use Podman / docker compose on the VM for containers.
   Do not start MacBook-local Docker or Podman.
   ```
5. Write `.takt/validation-report.md` back in the local repo after validation finishes.
6. Tear the stack down on the VM (`podman compose down`, volumes kept) unless the run ends by asking the user for manual validation; then leave it up and say so. See "Teardown when idle" in `~/.claude/CLAUDE.md`.

If `validation_vm.available = false`, use the normal Phase 4b behavior and clearly report that the HomeLab validation VM was unavailable.

---

## Phase 0.5: Recall project context from munin

Runs only when `munin.available = true` in `.takt/session.json`. Silent — no output.

1. Call `mcp__munin__recall` with query = the Feature title or sprint goal (from `sprint.json.meta.title` or branch name). Limit 5.
2. If results are returned, include a brief context summary in the Worker Prompt Template (see Phase 2) so workers start with prior decisions and known patterns.
3. On any error, silently skip — munin is best-effort.

---

## Phase 6 addition: Store outcomes in munin

After the retro agent completes and before Phase 7, if `munin.available = true` in `.takt/session.json`:

1. Call `mcp__munin__remember` with a summary of the run outcomes: stories completed, key decisions, blockers encountered, and any confirmed alerts. Tag with `["takt", "retro"]`.
2. This persists cross-session context for future runs on the same project.
3. On any error, silently skip — munin is best-effort.
