---
source_id: seb-claude-tools
version: 1.0.0
---

# Review Lenses

The single source for what a code review checks. Reviewers (the `skeptic`
relay → Codex, the takt final gate, a direct Claude review) compile their brief
from this file. Run all three lenses on every review. The review covers the
whole change, the way a PR reviewer sees it: the author has already run their
own checks and tests.

Stance for every lens: assume the change is wrong until the evidence forces
you to concede. Read changed files in full, not only the diff. Trace the
execution path; never write "probably". Every finding cites `file:line` and the
causal chain. Never invent findings; if a lens finds nothing after a genuine
attempt, say what was checked.

Severity: **must-fix** = spec not met, bug, data loss, security hole, outage
risk, undeclared dependency, committed secret/junk, or an explicit project rule
broken. **suggestion** = real but not blocking. If unsure a must-fix is real,
make it a suggestion; if it is real, never downgrade it.

---

## Lens 1 — Functional (does it solve the spec?)

Input the reviewer needs: the original spec and every acceptance criterion,
verbatim. Judge against those, never against the implementer's report.

- **Criterion by criterion:** for each acceptance criterion, state met / not
  met and the evidence (`file:line`, test, or command output).
- **Missing cases:** inputs or states the spec implies but the code does not
  handle (empty, zero, max, duplicate, concurrent, unicode, missing config).
- **Gamed validation:** tests weakened, skipped, or asserting the wrong thing;
  hardcoded results; a test that passes for the wrong reason.
- **Absence:** what should be in the change and is not (error handling, a test
  for the new path, call sites not updated, docs/config the spec names).
- **Scope creep:** behaviour added that the spec did not ask for.
- **Name vs behaviour:** does each new function do what its name and comments
  say?
- Re-run the stated validation commands when feasible and compare with the
  claimed output.

## Lens 2 — Technical (does it meet our standards?)

Input the reviewer needs: the project rules, pasted in. Sources, in order:
project `CLAUDE.md` / `AGENTS.md`, `.takt/final-gate-checklist.md` if present,
and project rules recalled from Munin. A rule from any of these has the same
authority: breaking it is a must-fix.

Code quality and conventions:
- Naming and structure follow the project's patterns.
- Every import is declared in the dependency manifest.
- No placeholder code: TODOs, stubs, hardcoded values shipped as final.
- No copy-paste where an existing utility exists; no copy-paste ghosts (stale
  names, imports from the source of the copy).
- No accidentally committed files (`.DS_Store`, `node_modules`, logs, `.env`,
  build output).
- Comments still true; no dead or unreachable branches; no silently swallowed
  errors.
- Hidden assumptions about caller, data or environment are documented or
  tested.

Runtime and operations (assume it broke production at 3 AM; work backwards):
- Every create/open/connect has a matching close/release on success AND error
  paths.
- Clients, pools and SDK instances created once and reused, not per call.
- Production and dev branches have the same safeguards.
- Called 1000 times in a row: do resources, connections or files accumulate?
- Every transaction commits or rolls back, including on error.
- No unbounded waits; retries have backoff and a max.

## Lens 3 — Security (defensive review of our own code)

This is a defensive review of code we own, done before it ships, to find and
fix weaknesses. Report each weakness as: what it is, `file:line`, the impact,
and the fix. Do not write exploit code, attack payloads or proof-of-concept
attacks; describing the weakness and the fix is enough.

- **Injection:** user input reaching SQL, shell, templates, file paths, regex
  or `eval` without parameterisation or validation.
- **Input validation:** untrusted input (request bodies, query params, headers,
  files, webhooks, LLM output) validated for type, size and range at the
  boundary.
- **Auth boundary:** every endpoint/action checks authentication before doing
  work; authorisation checked per resource (no access to another tenant's or
  user's data by changing an id).
- **Privilege escalation:** a lower-privilege caller cannot reach a
  higher-privilege operation directly.
- **Secrets:** no keys, tokens or connection strings in code, logs, responses
  or commits.
- **Error leakage:** error responses do not expose stack traces, queries or
  internals.
- **Path traversal and SSRF:** user-controlled paths and URLs are constrained.
- **Unsafe deserialisation** of untrusted data.
- **Dependencies:** new dependencies are maintained and pinned; no known-bad
  versions.
- **LLM-specific (if the code calls a model):** untrusted text reaching
  prompts or tool calls; model output trusted as code, SQL or commands.

If the model declines the security lens, do not skip it silently: report
`security: declined` with the reason, so the caller can run a separate
security review.

---

## Output

Report per lens: `functional`, `technical`, `security`. Each finding:
severity, `file:line`, finding, evidence, impact (and fix for security). Then
a verdict: `approve` / `request_changes` (or the caller's format, e.g. takt's
`review-comments.json`). End with what was verified per lens.
