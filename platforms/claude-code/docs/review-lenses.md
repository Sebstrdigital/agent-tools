---
source_id: seb-claude-tools
version: 1.1.0
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

## Scope: review what was asked, nothing more (hard rule)

You review whether THIS change does what its spec asked, correctly and
safely, in THIS project's real environment. You do not get to widen the
spec. Improvements, hardening, extra edge cases and "while we're here" ideas
are not defects, however good they are.

**must-fix** requires a `basis`, and only these four count:
1. `criterion:<id>`: an acceptance criterion of the spec is not met.
2. `rule:<source>`: an explicit project rule (CLAUDE.md, AGENTS.md, project
   checklist, Munin convention) is broken; quote the rule.
3. `failure:<scenario>`: the code fails under normal use in this project's
   real environment (the stack, hosts and accounts the project actually
   uses), on a path the change introduced or touched. Describe the realistic
   scenario.
4. `security:<scenario>`: a weakness exploitable in this project's actual
   deployment, introduced or touched by the change.

A finding with no basis from this list is not a must-fix. Test before tagging
must-fix: "would the stakeholder actually hit this, using what they asked
for, where it really runs?" If no, it is not a must-fix.

**suggestion**: a real defect that fails the test above (rare inputs, unusual
setups) but sits in changed code. Never blocks.

**follow_up**: anything outside the spec: hardening, environments the
project does not use (e.g. GitHub Enterprise, exotic remote formats),
features the spec did not ask for, refactors, nicer error messages, code
the change did not touch, files outside the repo. Propose it in one line as
a possible follow-up implementation. Never blocks and never goes to a fix
worker.

If unsure between two levels, pick the lower one. A must-fix that meets the
test is never downgraded.

## Re-review cycles

Cycle 1 reviews the whole change. Every later cycle is a re-review of fixes,
like a PR re-review:
- For each open must-fix, check whether the fix resolves it: mark it
  `fixed`, or leave it `open` with a note.
- Review only the lines the fixes changed, and only for defects the fixes
  introduced. Do not re-review the rest of the change and do not raise new
  findings on code the fixes did not touch: if you notice one, record it as
  a follow_up.

---

## Lens 1 — Functional (does it solve the spec?)

Input the reviewer needs: the original spec and every acceptance criterion,
verbatim. Judge against those, never against the implementer's report.

- **Criterion by criterion:** for each acceptance criterion, state met / not
  met and the evidence (`file:line`, test, or command output).
- **Missing cases:** inputs or states the spec implies, and that occur in
  real use, but the code does not handle (empty, zero, max, duplicate,
  missing config). Cases the spec does not imply are follow_ups.
- **Gamed validation:** tests weakened, skipped, or asserting the wrong thing;
  hardcoded results; a test that passes for the wrong reason.
- **Absence:** what should be in the change and is not (error handling, a test
  for the new path, call sites not updated, docs/config the spec names).
- **Scope creep in the change:** behaviour the implementer added that the
  spec did not ask for (flag it; do not ask for more of it).
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
severity (`must-fix` | `suggestion`), `basis` (required for must-fix, see
Scope), `file:line`, finding, evidence, impact (and fix for security). List
`follow_ups` separately, one line each. Then a verdict: `approve` /
`request_changes` (or the caller's format, e.g. takt's
`review-comments.json`). Only must-fix findings make the verdict
`request_changes`. End with what was verified per lens.
