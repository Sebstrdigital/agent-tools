# Lean workflows: Direct, Developer and Team

## Purpose and release boundary

Pi should be a proportionate thinking partner, not an automatic Team coordinator. Customer progress is a useful decision or observable outcome, not a count of agents, documents or passing tests. Use existing discussion and inspected evidence, clarify consequential gaps only, and separate purpose from engineering tasks. The thin `agent/AGENTS.md` policy routes richer guidance to one on-demand `skills/discovery/SKILL.md` and the existing `skills/delivery/SKILL.md` Team compatibility entry point.

This guide records the behavioral/document foundation and the dedicated model-only sequential `developer` tool in the opt-in tmux adapter. Developer and Team reuse ONE owned fixed runtime/controller and reserved/active slot; this is not a second scheduler or generic upstream extension. The explicit `--with-progress` option installs one reviewed vendored @pify/todo 0.3.0 controller; `--hide-thinking` merges only hideThinkingBlock:true. See [progress installation and rollback](progress.md). Personal installation, final independent release review, committed-source reproduction, fresh-session readiness and rollback records remain later gates. Do not infer those passes from these documents or static tests.

## Discover only as much as the decision needs

For consequential uncertainty, invoke `/skill:discovery [question]`. State customer outcome, motivation, constraints, exclusions and the decision. Inspect context before asking one consequential question at a time; synthesize rather than repeat a questionnaire. A long or interrupted investigation can save an unapproved draft Brief early.

An experiment needs a decision question, sufficient-evidence criteria, a relevant comparator, exact checks, permitted resources, budget and stopping rule. Obtain applicable approval. At a substantial blocker reconsider necessity, cheaper safe alternatives and whether stopping with uncertainty is more useful than polishing infrastructure. A failed/inconclusive experiment can be a valid result. Park side quests instead of silently expanding scope. For a native-TTS decision, obtain matched Python/native evidence early rather than repairing an elaborate native-only benchmark; this is a sequencing example, not permission to touch an application or play audio.

## Recommend a path; the user selects

- **Direct:** current-agent implementation of a small understood localized change. No mandatory files. A concise concrete proposal, explicit approval and proportionate checks suffice. Existing safety/project rules still apply.
- **Developer:** one bounded builder when separate context helps, normally one compact approved packet. Preserve customer purpose/design, outcome acceptance, scope/exclusions, applicable rules, baseline/workspace, exact checks, permissions, budget and stop conditions. The main agent inspects actual changes/evidence before accepting. Requires the explicit narrow `developer` invocation below, not bypassed or relabeled Team launch controls. If unavailable, explain and recommend Direct or explicitly selected Team instead.
- **Team:** consequential work with dependencies or substantial validation/review. Explicit user selection permits preparation only. Invoke `/skill:delivery [request]`; keep this supported installed name and stable internal APIs, without a second active Team controller. Use one compact task record (Markdown or existing JSON) and wait for approval of its actual Agreement section before launch. No mandatory three-file planning suite.

Recommend one with a brief reason rather than an unexplained menu. Important unresolved uncertainty warrants discovery or a bounded approved experiment, not a premature builder. Team does not imply parallelism.

## Approved whole-cycle delivery

After actual approval, the lead owns implement -> diagnose -> in-scope repair -> revalidate/review -> next approved task continuation without routine customer reapproval. A red task-owned check is a bounded repair trigger, not an automatic customer stop. Preserve authority/security/scope/ownership/material-decision and exhausted-budget stops, explicit customer checkpoints and no-progress stops. Required unavailable evidence remains blocked after relevant safe diagnosis; safe alternatives do not silently waive required checks. Existing narrow packets remain binding; no retroactive expansion.

The customer owns requirements, consequential decisions and project-specific acceptance. Direct completes proportionate checks; Developer uses parent inspection, not automatic Team ceremony; Team retains fresh sequential builder -> no-edit validator -> inspection-only reviewer. Late source repairs invalidate affected validation and review; renew those gates on the final candidate before lead acceptance. Engineering-complete, ready for customer acceptance, customer accepted and released are distinct states; installation/deployment/outward actions require explicit applicable authority.

### Slice boundaries are execution boundaries

Prefer meaningful thin vertical slices across needed layers, each with an observable outcome, not technical-layer chores. Qualification may instead deliver decision evidence without product edits. Record slice IDs, depends-on IDs, change ownership and parallel eligibility in the existing task record (Markdown or existing JSON). Dependency-ready means prerequisites are lead-accepted; parallel-safe also requires no unresolved shared-file, interface or resource conflicts. Parallel eligibility is metadata, not permission: execution remains sequential under the one-worker limit.

Each planned slice gets a fresh builder run; never bundle slices into one assignment or resume a previous slice's builder for the next slice. Supply only that slice's scope and relevant accepted prerequisite findings. Use fresh sequential builder -> no-edit validator -> inspection-only reviewer per slice, followed by lead acceptance before dependent work starts. Resolve material qualification findings before migration edits. Retain final integrated validation/review on the complete candidate; the last slice's gates may cover this without a duplicate cycle. A routine baseline alone needs no three-role cycle.

Repairs stay attached to their slice within approved task/runtime allowances. Fresh runs, timeouts and slice boundaries do not reset limits; slicing grants no extra cycles. State any necessary repair allocation once in the Agreement. Early actual-boundary feedback and sanitized failure-stage evidence remain important: fakes prove only their tested boundary. Refine planning from observed results, not a majority-token upfront planning rule.

### Bound evidence admission, not just worker context

Supply a concise approved slice and relevant project context. Workers need purpose, constraints and acceptance, then inspect source/evidence as needed. Reuse unchanged context; inspect changed inputs and uncertainties. No mandatory reading manifests, read receipts, exhaustive hashes or historical rereading. Lead-supplied excerpts must not omit governing constraints.

The canonical task record holds slice status, accepted candidate, decisions, blockers, repair allowance and evidence pointers. Workers return concise changed paths/candidate, actual checks/results, limitations and relevant next-slice handoffs, not transcripts or raw log batches. Keep logs on disk. Lead retrieval answers a concrete question with bounded source-linked evidence: codemode must filter/aggregate before admission, not merely batch whole files or logs. Truncation is not complete evidence; narrow the query or paginate where coverage is required.

Inspect the complete task-owned diff including added files in bounded sections before acceptance; summaries do not replace actual change inspection. Final integrated review covers the whole task, not only the last slice or fix. After compaction/reload recover the canonical state and needed evidence, not all session history. Before the next launch pass only governing constraints and relevant accepted prerequisite findings. These are guidance boundaries, not new runtime enforcement, automatic summarization or a second scheduler.

## Standalone Developer invocation

Prerequisites: explicitly approved installation of `bash install.sh --with-delivery-tmux`, an installed Pi (loader tested with Pi 1.0.4), tmux and a persistent parent session. Keep the checkout in place; load/reload only in an authorized session, never interrupt another live session. Installation is opt-in and settings/conflicting targets are preserved. The default one-shot `delivery_worker`/CLI remains Team-only; it does not expose Developer. If the dedicated tool is unavailable, offer Direct or explicitly selected Team, not a legacy-control bypass.

Recommend Developer with a reason, obtain the user's explicit selection **and approval of the actual bounded task**, then invoke the dedicated model-only tool. No full Brief/Plan/Agreement set is mandatory. A compact approved packet can carry task context inline, with an identifiable approval/task reference; exhaustive hashes and snapshot directories are not required:

```javascript
developer({
  selection: "Developer",
  approvalRef: "conversation approval: user selected Developer and approved packet r1",
  packetRef: "task-packet r1: <approved record or exact supplied task>",
  name: "bounded-fix", // optional, unique within this parent's ownership
  packet: {
    purpose: "Customer outcome, motivation, design reasons and approved references/revisions.",
    scope: "One bounded fix; exclusions, permissions, budget and stopping rules. Commit none unless explicitly approved.",
    allowedPaths: "/absolute/approved/file; explicitly allowed evidence directory, if any.",
    projectRules: "Full applicable rules or accessible absolute paths and exact revisions; child must read them.",
    baseline: "Workspace/git root/branch/revision and unrelated changes to preserve; completed dependencies.",
    validation: "Exact commands, cwd/environment requirements and required evidence/exits.",
    acceptance: "Observable outcome, report contract and parent inspection before acceptance.",
    task: "The explicitly approved implementation task and required source investigation."
  }
})
```

Every listed field is a nonempty string. Unknown fields and role/agent/cwd/tool/grant/CLI overrides are rejected. Optional independent `model` and `thinking` fields accept only candidate builder combinations (openai/gpt-5.6-terra/medium or openai/gpt-5.6-sol/medium/high). `name` is optional and bounded to 80 characters. Only the bundled **builder** can launch; Developer cannot launch validator/reviewer. Builder role defaults apply when omitted; exact availability and effort are checked before resource allocation. Saved resume replays the unchanged pinned loadout, not new defaults. Allowed paths and scope are **instructions, not an OS sandbox**; the shell/read/write tools are not path-confined.

`selection`, `approvalRef` and `packetRef` are required admission metadata, **not authentication of actual user consent**. The runtime cannot verify a conversation approval, file/hash, reference freshness, semantic packet adequacy or compliance with its paths. The parent must verify the actual selection/approval and exact packet revisions before launch, supply all required rules/context, and stop for missing/stale authority. Tool availability or a declaration alone is not authorization. Team `subagent` remains Team-only under its actual Agreement contract; Developer declarations do not confer Team authority or waive independent Team review.

Results/questions arrive automatically; do not poll or invent results. The parent alone inspects complete actual changes, relevant validation evidence and outcome fit before explicitly accepting; inspect sessions/sidecars only when needed to resolve a concrete issue. Worker completion, successful checks and a released slot are not acceptance. Reconcile all owned resources, preserve partial changes/failure evidence, and obtain renewed approval for material scope changes. Real provider demonstrations, independent release gates and personal readiness remain P4/later work; fake transport tests are protocol evidence only.

Use the shared `subagent_message` control with the exact owned name. Matching `runId`/`questionId` answers release waiting only; `pause` retains the pane/session and single slot. Inspect changes/evidence before `rearm` with explicit new work. For any Developer uncorrelated new-work message, rearm or terminal saved resume, repeat the **original** `approvalRef` and `packetRef` (work must remain within that approved packet). Replies/pause/stop need no new-work references and never grant new scope. A material task change requires fresh compact approval and a new `developer` invocation after ownership reconciliation, not changing stored references.

```javascript
subagent_message({ name: "bounded-fix", action: "rearm", message: "Approved remaining work within packet r1",
  approvalRef: "<same original approvalRef>", packetRef: "<same original packetRef>" })
```

Developer and Team deny sibling/overlapping launches in both directions, even before launch awaits. Running/waiting/paused workers hold the slot. Stop, parent teardown and the fixed 20-minute timeout classify cancelled, never successful; failed owned cleanup is retryable and blocks launch. No parent retile or external registry adoption. Branch-owned saved resumes require unchanged pinned grants/resources; unknown/malformed provenance fails closed. Accepted v1 records without workflow provenance remain legacy Team only, never automatic Developer grants. Saved active records with no matching watcher remain unresolved, not silently resumed/released. Fresh independent Team gates are unchanged.

## Fixed Scout discovery (source capability)

The opt-in tmux adapter's dedicated model-only sequential `scout` invocation supports bounded discovery/analysis and execution investigation without Developer or Team selection. The lead verifies actual applicable permission first; `discoveryAuthorityRef` is a declaration, not authentication of consent or unrestricted private-data access. Supply a focused `question`, nonempty locally accessible `sources`, relevant `rules`, `exclusions`, bounded `budget` and cited `resultContract`. Read relevant supplied purpose/rules at their specified revisions; missing material constraints block investigation, not irrelevant historical reading.

Scout gets exactly read/grep/find/ls/codemode/ask_question, no shell, mutation, process control, external web research, nesting or acceptance. Native codemode cannot widen the granted tools; model-only controls are excluded. Sources and scope are instructions, not an OS sandbox. Six child discovery denials remain; external research stays with the lead. Only the fixed bundled profile loads, never project/global overrides.

Scout shares the same reserved/active slot with Developer and Team in both directions, including waits and pauses. Results/questions arrive automatically. Use `subagent_message` with exact owned name and correlated runId/questionId replies; replies release waiting, not pause. Uncorrelated new work, rearm or terminal resume requires the original discoveryAuthorityRef and must remain in the original packet. Stop/timeout/shutdown cancel; failed cleanup and unresolved ownership block new launches. Saved resumes preserve pinned grants/model/identity; missing legacy workflow is Team only, never Scout authority. Team launch remains builder/validator/reviewer; Developer remains builder only. Scout findings never replace fresh Team validation/review or lead acceptance.

See [the Scout packet and source limits](workflows/scout-role-routing.md). This is source/fixture capability, not installed readiness or provider/model-quality qualification; B2 fixed routing is present in this source candidate. B3 source capability supports optional declared `assignment` and explicit `escalation` on existing fresh role launches. One fresh same-role replacement retains original authority/scope and cited partial-source identities, findings/failure evidence, remaining criteria and remaining effort/repair allowance; consumption persists before allocation, including launch failure. Legacy undeclared records fail closed; no automatic retry or budget reset. See the linked source guide for fields and evidence limits.

Scripts first for deterministic extraction/counting. New launches never inherit the parent model: Scout uses openai/gpt-5.6-terra/low for optional `taskKind: "lookup"`, `analysis` or omission; builder uses openai/gpt-5.6-sol/medium; validator uses openai/gpt-5.6-terra/low; reviewer uses openai/gpt-5.6-sol/medium. Team and Scout may start stronger with `profile: "strong"`: Scout Terra/medium (explicit low also allowed), builder Sol/high (explicit medium also allowed), validator Sol/medium, reviewer Sol/high (explicit xhigh also allowed). Starting stronger is lead-assessed risk/complexity, not an automatic retry or weak-first rule. These are unbenchmarked candidate profiles, not proven cost/quality improvements.

Team retains explicit exact `model`/`thinking` choices. Developer optional independent `model`/`thinking` is restricted to Terra/medium or Sol/medium/high, with builder defaults when omitted; no role/cwd/tool/CLI override. Scout model/thinking choices are restricted to its candidate combinations. Every new choice must match the runtime's available provider/model registry and actual supported effort before any slot, sidecar or pane allocation; unavailable/auth-unavailable/unsupported choices fail clearly, without silent clamp or parent substitution. `none` maps to Pi `off` only if supported. No Astra is admitted and no 6.1 model is configured as a default/fallback. Saved sessions replay pinned old model/effort unchanged, never rereading new routing defaults. No global settings, registry/plugin or controller changes.

## Minimal Team records and execution

The goal is useful development comparable to the user's established Claude Code workflows, not production of agents or documents. Default to a 3–5 sentence task plus relevant context/check pointers and a short Agreement section. Use `skills/delivery/references/templates/task.md` when helpful; an existing JSON sprint/task record also works. Brief/Plan/Agreement are responsibilities, not three mandatory files. Separate documents are optional when they answer a concrete question.

Approve the actual bounded work, not each edit. Record the user's approval once. The Agreement section states scope, acceptance, unusual permissions and any agreed limit. Stable workflow policy and model defaults are referenced, not recopied. A material scope/permission/check change gets a short dated approval note in the same record, not another amendment suite. A clear approved compact record satisfies Team's actual Agreement before launch requirement; a vague selection or a claimed hash does not authenticate consent.

Normal reversible development needs ordinary git status/diffs, relevant tests and an inspected final candidate. No obligatory approval snapshots, exhaustive input hashes, reading receipts or per-role minute pools. Detail follows consequence and reversibility: sensitive data warrants specific access/confidentiality rules; irreversible production changes may need recovery planning. Selecting Team does not itself increase paperwork.

Team retains sequential fresh builder -> no-edit validator -> inspection-only reviewer, then explicit lead acceptance. A routine baseline does not need its own three-role cycle before implementation. Obtain relevant baseline evidence, then independently validate and review the actual change. All six child discovery denials (extensions, MCP, skills, templates, themes and context files) and fixed grants remain unchanged. Supply relevant rules/context explicitly; children cannot discover them automatically.

Review the whole task/MR, including added files, on the tested candidate. Check purpose and realistic behavior: repeat use, omitted options, data preservation, failure paths and visible effects where relevant. Late source repairs invalidate affected validation and review. Use at most three focused repair cycles after implementation unless the approved limit is stricter. A cycle is a coherent repair followed by checks, not each edit/compiler correction. New independent findings use the same task allowance; they do not reset it. Suggestions do not block approval or authorize extra work.

If the same defect survives two cycles, use a fresh stronger same-role builder context for the third: first diagnose the cause, inspect failed approaches and identify a changed repair strategy before editing. To make this escalation available, declare the original assignment/allowance on the initial builder launch; it cannot be retrofitted after failure. Use the existing explicit escalation binding with original authority, partial source, findings, remaining allowance and reconciled terminal resources; reserve the third cycle for this replacement, not an additional attempt. Prefer the supported stronger builder profile (currently Sol/high) when available; it is not a proven quality guarantee. Environment failures or missing permission are not model-escalation reasons. If escalation is unavailable, initial binding is missing, or the worker already uses the strongest supported profile, report the limitation and obtain a bounded decision rather than silently replaying or resetting limits. Fresh Team validation/review remain required. This default applies to newly approved work; existing approvals and declared runtime limits remain binding.

Do not require unrelated applications to close or control them. Isolate live-side-effect tests; propose exact exclusions and report gaps if a required check must change. Ask before stopping the application under development when needed. Missing or excluded checks are not passes.

For Direct, Developer and Team, before sensitive tests run, verify isolation at the effective execution boundary: inspect the configuration actually consumed by the launched test host/process, with a safe focused runtime check when needed. An environment variable in the invoking shell alone is not proof that a child test host received it. If isolation is unverified or fails, fix the validation setup before proceeding; do not launch the sensitive suite to discover whether isolation worked. Obtain the required valid baseline before edits. A later reconstructed baseline is corrective evidence, not retroactive compliance; report any breach separately from the final product-check result. Keep this a targeted preflight, not a reading manifest, snapshot suite or global application inventory.

Use simple agreed time/action limits when useful. Report observed elapsed time, not imagined active effort or conservative charges based on a nominal allowance. Tool-enforced optional assignment/escalation limits remain binding; do not reset or bypass them. No automatic worker replacement, model substitution or budget increase.

Provider errors or silence are not proof of a hang or terminal failure. Before retry/replay, reconcile actual source, evidence, task state and owned resources; never blindly replay mutating calls. Keep only useful next-step/evidence records. No obligatory full-session audit or historical read proof.

## Truthful progress and reconciliation

Use the compact record's authoritative Plan section or existing JSON task rows with task/outcome/dependencies, state, approved references/source revision, evidence/blocker/next action and lead acceptance. States are **pending**, **active**, **blocked**, **paused**, **cancelled**, **abandoned** and **accepted**. Retain unresolved work and reasons across retries, cancellation and resumption. Inspect source, evidence and owned resources before resume; never blindly replay.

Worker transport completion, exit zero, testing success or a released worker slot is not acceptance. Only the lead explicitly marks accepted after inspecting acceptance evidence, fresh validation and independent review on the same revision and reconciling owned resources. No invented percentages or elapsed-time completion estimates.

The opt-in @pify/todo 0.3.0 widget is a projection/cache, not a second scope authority or scheduler. The lead maintains its pending/in_progress/completed mapping: accepted alone becomes completed; active becomes in_progress; pending stays pending. Retain unresolved blocked/paused/cancelled/abandoned entries as pending with explicit [blocked]/[paused]/[cancelled]/[abandoned] labels and reasons. The integration excludes the bundled scratchpad skill and installs only the guarded controller. Rebuild/reconcile the view from the applicable Plan on supported reload/branch/compaction recovery. Source review and mock lifecycle/display checks are not live installed readiness. Supported recovery limits are documented in [progress.md](progress.md).

Meaningful default-agent scratch lists need no mandatory Plan for trivial Direct work. Children do not maintain independent task systems. Narrate findings, decisions, blockers and completion, not every tool call. Detailed output stays inspectable via Pi's default Ctrl+O. Thinking visibility (Ctrl+T or hideThinkingBlock) is separate from reasoning/model defaults; The opt-in installer changes only hideThinkingBlock, never reasoning or model settings.

## Safety, lasting records and completion

Trace claims to inspected evidence. Propose changes and await explicit approval; ask before destructive/outward actions unless exact existing approval covers them. Project rules belong in the repository's AGENTS.md. Preserve unrelated changes/settings/resources; no blanket staging, reset, stash, history rewrite or unknown-path cleanup. Installation preserves existing conflicts and installed delivery compatibility targets. Keep unfinished sources isolated from globally symlinked live targets.

Recall relevant decisions with `munin recall "<query>" -p <project>` using the git-root folder name. Lead-owned `munin remember "<summary>" -p <project>` records decisions, outcomes and resumable handoffs without secrets. Keep failed/interrupted records. Authorized successful completion may include descriptive validated commits and exact-owned resource cleanup, but no implied commit/install/push/PR/publish/delete authority. Retain follow-ups, qualifying ADRs and real installation/rollback records before authorized cycle cleanup. ADRs are for consequential architectural decisions, not a file-count threshold; ADR acceptance itself is not implementation approval.

Static/fixture checks demonstrate guidance structure and fake-HOME installer preservation. Model-behavior observations are demonstrations, not universal compliance or customer-satisfaction guarantees. The fresh user usability trial and final lead acceptance remain separate.

## Retained follow-up candidates (not approved implementation)

Each needs demonstrated need, bounded proposal and approval. This list preserves the prior agreed discussion without editing or deleting that summary:

- Selectively maintained durable capability/product specifications for repeatedly changed areas; no whole-product documentation, OpenSpec/Spec Kit adoption or spec-as-source regeneration requirement.
- Structured JSON task state, dependency scheduling and stronger resume automation only if actual machine consumers warrant them; existing Markdown or JSON task records are fine; a machine scheduler remains unapproved.
- Custom transcript renderers, richer blocked/paused visuals and worker telemetry if the evaluated widget and existing Pi controls prove insufficient; no custom dashboard now.
- Stronger runtime enforcement of Agreement boundaries, revision pinning and budget checkpoints after observing instruction-based behavior; preserve existing launch/ownership safety now.
- Beyond the fixed Scout described above, specialized discovery/experiment agents, extra roles, broader model routing and parallel execution only when separate context demonstrates value; agent count is not success.
- Broader project-rule migrations and stack-specific validation policies after targeted audits; no silent rewrite of Dikta rules or unrelated instructions.
- Extended installer rollback and upgrade diagnostics after actual first-release installation/recovery requirements are met.
- README's deferred **Jev** and **Hermes** work remains deferred; this release does not reopen it.

No mandatory Epic/Feature/Sprint stages, story points, planning-review agents, Scrum/TAKT reconstruction, automatic publishing or broad infrastructure expansion are implied. Inspect community alternatives before proposing new infrastructure.
