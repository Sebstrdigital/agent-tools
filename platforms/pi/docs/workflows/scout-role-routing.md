# Scout, role routing and fresh escalation source capability — B1/B2/B3 candidate

This isolated source candidate adds a dedicated model-only sequential `scout` tool in the existing opt-in delivery-tmux adapter. Installed readiness, live provider behavior and acceptance are **not claimed**. B2 supplies a fixed new-launch resolver; B3 adds an explicit optional one-shot fresh same-role escalation binding on these same launches. Saved sessions replay pinned values, including older models/efforts, without rereading mutable defaults.

## Bounded discovery without execution-mode selection

Scout does not require Developer or Team selection. The lead first verifies actual applicable discovery/private-data permission, then supplies:

```javascript
scout({
  discoveryAuthorityRef: "actual conversation permission and exact source/rules revisions",
  question: "One focused investigation question",
  sources: ["/absolute/accessibly-supplied/source"],
  rules: "Applicable rules and accessible references; read before investigating",
  exclusions: "No mutation, shell, process control, external web research or nesting",
  budget: "Bounded investigation allowance and stopping rule",
  resultContract: "Cited findings, sources actually read, uncertainty, evidence gaps and next lead action",
  name: "bounded-scout", // optional
  taskKind: "lookup", // optional: omitted or analysis uses low
  profile: "start" // optional: strong starts Terra/medium, no weak-first requirement
})
```

Required strings must be nonempty, and sources a nonempty list of locally readable paths (relative paths resolve against parent cwd). Accessibility preflight is not permission authentication. Metadata is declaration, not authenticated consent. Scope and path restrictions are instructions, not an OS sandbox; Scout must not infer unrestricted private-data access. External web research remains lead-owned.

The bundled profile gets exactly read, grep, find, ls, codemode and ask_question. Native codemode exposes only granted callable tools, not shell/edit/write/nesting. Six child discovery sources remain denied: extensions, MCP, skills, templates, themes and context files. Only bundled child control and explicitly granted native codemode load. Project/global profiles cannot override Scout.

## Flat owned lifecycle and separate admission

Scout uses the same reserved/active slot as Developer and Team in both directions, including waits and pauses. Results/questions arrive automatically. Matching runId/questionId replies release waiting, not pause. Pause retains ownership; stop/timeout/shutdown cancel. Failed cleanup blocks new launch.

Control by exact owned name through `subagent_message`. Uncorrelated new work, rearm and terminal resume must repeat the original `discoveryAuthorityRef` and remain within the original bounded packet. Replies/pause/stop grant no new scope. Saved resume preserves pinned grants/model/identity; cross-parent adoption is refused. Missing workflow metadata remains legacy Team only and cannot grant Scout authority.

Explicit bundled inspection lists Scout alongside Team profiles, but Team launch still admits only builder/validator/reviewer, and Developer still launches only builder. Scout cannot accept work or replace fresh Team validator/reviewer gates. Parent inspection, exact validation and resource reconciliation remain required before acceptance.

## Fixed new-launch routing (B2 source candidate)

Prefer deterministic scripts for extraction and result counting before delegating semantic analysis. Scout lookup and analysis are distinct task kinds, not guessed from question text.

| Role | Default start | Strong initial candidate |
| --- | --- | --- |
| Scout | openai/gpt-5.6-terra, low for lookup/analysis/omission | openai/gpt-5.6-terra, medium (explicit low allowed) |
| Builder | openai/gpt-5.6-sol, medium | openai/gpt-5.6-sol, high (explicit medium allowed) |
| Validator | openai/gpt-5.6-terra, low | openai/gpt-5.6-sol, medium |
| Reviewer | openai/gpt-5.6-sol, medium | same Sol, high (explicit xhigh allowed) |

Team `subagent` and Scout accept optional `profile: "start" | "strong"`; strong is an initial lead-assessed risk/complexity choice, not escalation metadata or an automatic retry ladder. Team keeps explicit exact `model`/`thinking` selection. Developer accepts optional independent `model`/`thinking` only for Terra/medium or Sol/medium/high; omitted fields use builder defaults. Scout permits only Terra/low/medium; it also accepts optional `taskKind: "lookup" | "analysis"`. Tool/role/cwd/CLI grants cannot change.

The adapter's synchronous preflight calls the installed `ctx.modelRegistry.find(provider, exactId)`, `getAvailable()` authentication-availability snapshot and `getError()`, then the installed pi-ai `getSupportedThinkingLevels(model)`. It rejects missing/unavailable/auth-unavailable exact models and unsupported requested efforts **before** reserving a slot or calling the runtime that allocates panes/sidecars. Provider/model identity is case-sensitive, no fuzzy search or parent substitution. Reasoning `none` maps to Pi `off` only when that effort is supported; no silent clamp. Models declared available are metadata, not proof that a future authenticated provider request will work. No credentials are resolved and no inference request is made by routing.

No Astra is admitted and no 6.1 model appears in the fixed defaults or strong candidates. Explicit supported Team choices are retained; older saved sessions keep their pinned old models/efforts. New defaults do not rewrite saved records, and unavailable new-launch candidates do not authorize an automatic fallback. There is no registry/plugin/controller/global-setting change or installer change. These candidate profiles are unbenchmarked; quality and cost savings remain unproven. Short completed Pi requests have confirmed current-account compatibility for Terra/low/medium and Sol/medium/high; this is not permanent entitlement or task-quality evidence. GPT-5.4 Mini was rejected by the Codex/ChatGPT account despite local registry availability, so it is not a Scout/default candidate. Registry authentication metadata is not account-specific backend support. Installed workflow readiness still requires its actual smoke check. B3 does not qualify these model profiles.

## Explicit fresh same-role escalation (B3 source candidate)

Declare `assignment` on a named initial `developer`, `scout` or Team `subagent` launch, before any need to escalate:

```javascript
assignment: {
  id: "unique-assignment-id", scopeRef: "exact original approved scope reference",
  approvalRef: "actual original approval", packetRef: "original packet revision/hash",
  effortMinutes: 30, repairAttempts: 2
}
```

Developer refs must equal its workflow approvalRef/packetRef. Scout uses its original discoveryAuthorityRef for both refs (no execution approval substitution). Team declares its actual original Agreement/packet references; the lead still verifies explicit Team selection and actual approval. Metadata is not authenticated consent, measured effort or a path sandbox. Strong initial selection remains independent and needs no escalation.

For one fresh same-role replacement use a new name, the **identical assignment**, unchanged workflow refs and scope-bearing packet fields, plus:

```javascript
escalation: {
  from: "original-owned-name", runId: "exact original owned run id",
  reason: "failed-bounded-repair", // or reasoning-complexity
  partialSources: [{ path: "/supplied/partial-source", sha256: "64 lowercase hex characters" }],
  findingsRef: "cited findings", failureEvidenceRef: "cited failure/complexity evidence",
  remainingCriteria: "remaining original acceptance criteria",
  remainingEffortMinutes: 12, remainingRepairAttempts: 1,
  terminalState: "cancelled", // or completed/error, must match actual owned state
  resourcesReleased: true, resourceEvidenceRef: "cited reconciled terminal/resource handoff"
}
```

Partial-source hashes are checked locally before allocation. Findings, failure and resource citations are explicit lead declarations: the adapter does not authenticate their contents or user consent. The lead inspects them before dispatch. Red tests normally trigger current-worker diagnosis/repair; only evidenced reasoning/complexity or failed bounded repair supports escalation, not a red check alone, unavailable environment or missing permission.

The parent-session append-only lineage ledger retains original root, fixed role, authority, scope and declared allowance. It reads all entries in this exact session, including abandoned branches, so navigation cannot reset consumption. The original root is durably consumed **before allocation**, even if transport later fails; no concurrent/repeated replacement or rollback grants another attempt. Original consumed roots cannot resume new work. Saved replacement resumes retain pins, refs and consumption; declared Team new work must repeat its original assignment approvalRef/packetRef, just as Developer repeats its workflow refs and Scout its discoveryAuthorityRef; the lead must reconcile actual consumed/remaining budget before every resume. No retrofitted legacy grant: assignments must have been declared initially. New assignment IDs are not permission to replay the same approved work or reset accounting.

Fresh launch rejects changed refs/role/scope, cross-parent or wrong-run targets, malformed/legacy provenance, live/waiting/paused workers, unsupported routing and uncertain owned-pane cleanup. Scout/Developer/Team share one reserved/active slot and keep distinct admission and acceptance gates. Remaining effort cannot exceed the declaration; escalation consumes one repair allowance. The worker timeout is at most the fixed 20-minute ceiling, shortened to a smaller declared remaining effort; this is a per-lease ceiling, **not** cumulative active-effort measurement. The lead owns truthful total accounting, required checks and terminal/resource reconciliation. No timeout inflation, automatic ladder, controller, nesting or parallel writers. Fresh Team validation/review remain required after builder repair; worker completion never accepts source.

## Evidence boundary

Fake-host tests are protocol/tool-boundary evidence, not installed readiness or empirical model-quality evidence. See the assigned B1 evidence report for actual check results and incomplete gates. No installer, global settings, scheduler or arbitrary-profile mechanism is added.
