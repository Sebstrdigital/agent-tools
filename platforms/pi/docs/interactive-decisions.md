# Interactive decisions: optional ask_user picker

`ask_user` gives the lead an interactive way to collect genuine unresolved user
decisions: arrow keys and Enter for one choice, Space for checkboxes, custom text,
and 2–4 independent question pages with a final review. It uses the pinned MIT
[pi-ask-user source](../vendor/pi-ask-user/PROVENANCE.md), with a narrow toolkit
adapter—not a second workflow, approval broker, or action executor.

## Install and load

With explicit installation permission:

```sh
bash install.sh --with-ask-user
```

This opt-in adds only the optional extension resource to the existing default
installer mapping. It is idempotent and refuses conflicting files/directories or
links. The flag alone does not read, merge or modify settings. Like other installer
flags, a fresh HOME also receives core default links; an already installed toolkit
needs only the additional `extensions/ask-user` link. An exact rollback manifest
records any links created. No upstream decision-gating skill, package registration,
peer/development dependency installation, model routing or saved grant change occurs.

Only `extensions/ask-user/` is linked. Never register `vendor/pi-ask-user/` as a
Pi package or load its entry point directly. Its original package.json is pinned
version metadata; the upstream mandatory-question skill is deliberately absent.

A **fresh Pi session**, or a user-chosen `/reload` when safe, is needed to load a
new executable extension. Installing the link does not inject it into a running
session or resume/control another task. Do not reload an ongoing Dicta task on
its behalf. Ask the agent to use `ask_user` once the resource is loaded; there is
no new slash command or forced prompt on each PACE phase.

## What a decision looks like

For a saved plan whose implementation has not yet been authorized:

```text
Start BUILD for the saved removal plan?

Scope: the saved plan. Preserve shared functionality and unrelated work.
No commit, release, installation, private-data access or app control.

  Yes — implement the saved plan
  Not yet — keep BUILD on hold
  Type something…
```

Moving focus does not answer. Enter explicitly confirms a single choice. Space
selects/deselects multiple choices, then Enter submits. Upstream UX also permits
Enter with no checked boxes to submit the focused option. Escape cancels or first
backs out of custom-text/comment entry. A batch publishes answers only after final
review submission; skips remain explicit skipped entries, not approvals.

The tool supports an overlay (upstream default) or `displayMode: "inline"` for a
component directly in the terminal flow. Questions, optional context, options and
answers are retained in normal tool/session records. The model chooses when to
ask; fixture tests do not certify natural-language selection or model compliance.

## PACE and authority

Prefer this UI for an actual consequential choice or missing permission—not
routine implementation decisions, repeated approval, or mandatory phase gates.
Read context first and ask one focused question, or a batch of independent ones.
Dependent questions wait for earlier answers. An explicit request to implement an
understood task already supplies authority; do not ask the same question again.

The answer applies only to the displayed question and scope. No broad execution,
commit, installation, release, private-data or application-control permission is
inferred. Freeform text must be interpreted, not mapped automatically to Yes.
Cancellation, timeout, invalid input, skipped entries, missing UI and tool errors
never count as approval. Do not schedule an unresolved permission question and
its dependent mutation in the same tool batch. Sequential tool execution is an
ordering aid, not enforcement of future permissions. If the picker is unavailable,
ordinary text is sufficient; PACE has no mandatory picker dependency.

## Adapter boundaries

- Session-start same-name collision preflight before registering one `ask_user`
  tool. Model-only exposure prevents codemode/nested tool calls from opening UI;
  sequential execution preserves upstream question ordering. Shutdown denies new
  calls. This does not certify arbitrary competing extensions or isolate OS access.
- Request/result guards reject blank/duplicate/malformed questions/options,
  mismatched result shapes, empty/contradictory answers and out-of-options structured
  selections—including RPC multi-select's comma-separated text fallback. Labels
  containing commas can be ambiguous in that fallback and fail closed; use native
  TUI or unambiguous labels. Real custom input stays a distinct freeform response.
- Outcome events are buffered until validation and always redacted, even when the
  upstream full-event environment preference is enabled. Question text and batch
  position still reach all loaded extensions; do not put sensitive information in
  questions/context and trust every loaded executable extension. Full answers stay
  in normal tool/session details. Block/unblock events still run immediately.
- No UI means a failed tool call, not a fabricated answer. Abort/timeout and owned
  overlay/listener cleanup remain upstream behavior, with a final abort guard before
  returning/broadcasting any answer.

## Verification and gaps

```sh
node --test tests/ask-user*.test.ts
node --test tests/*.test.ts
```

Checks use fake HOME/agent paths, native Pi loaders and TUI/key parsing, inert
terminal scheduling, synthetic user input and in-memory SDK/codemode fixtures.
They cover installed symlink resolution, core/opt-in installation, conflicts,
settings preservation, pinned bytes/skill omission, result guards, cancellation,
privacy, keyboard flows, batches, rendering widths and effective tool exposure.
The qualified host is Pi 1.1.0 / Node 25.9.0 with installed host dependencies;
this is not a dependency-free or arbitrary-version guarantee.

Physical-terminal visual/IME/accessibility qualification, a real RPC client and
live model behavior remain manual checks. Upstream's complete Bun unit/typecheck
suite was not run or installed; native toolkit fixtures are not a claim that it
passed. No providers, real transport workers or applications are invoked by these
fixtures. Source provenance identifies a Git pin, not signed authorship or npm
artifact equivalence.
