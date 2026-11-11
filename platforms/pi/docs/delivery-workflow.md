# Outcome-driven development (delivery compatibility APIs)

Pi should complete useful development, not make the customer schedule agents. A clear execution request for an understood task is authority for ordinary reversible implementation, supporting files, diagnosis, checks and useful repairs. Advice or a draft proposal alone is not authority. Do not require mode selection followed by a separate Agreement approval.

Recommend Direct, Developer or Team when helpful; choose mechanics proportionately. Conversation, an issue or existing JSON is sufficient context. Optional templates under skills/delivery/references/templates support recovery, not mandatory paperwork.

Scope is the outcome plus exclusions. Include necessary supporting files unless explicitly restricted. Material behavior, permission, privacy, security/trust, ownership or required-check changes need a decision. Preserve explicit old grants and user-requested limits; they do not expand retroactively.

Direct remains appropriate for a small task: the lead implements, diagnoses, repairs and validates. Once delegation is selected, the lead coordinates/scopes, reads evidence, inspects source diffs/logs/screenshots/release metadata, maintains coordination notes and accepts; workers execute edits, diagnosis/repair, validation, environment lifecycle and authorized Git/release actions. Lead shell/API use is read-only evidence inspection, not test or validation execution. No quick-fix or one-line exception applies. Red task-owned checks trigger worker diagnosis/repair, not routine customer stops or silent lead takeover: reconcile worker ownership/resources, then continue, redirect or replace. Switch to Direct only explicitly after reconciliation, never as a red-check workaround. Compiler/test/harness corrections remain implementation, not repair tokens. Do not invent repair caps, minute pools or blanket accounting. Diagnose repeated failures, change strategy and stop for demonstrated no progress or exhausted explicit limits.

Delegate when useful, use independent validation/review according to risk and requested gates, and inspect the integrated candidate. No mandatory fresh builder -> validator -> reviewer per slice. Reuse unchanged evidence and renew affected checks/review. Worker completion is not acceptance; missing checks are not passes.

The installed tmux adapter supports builder, validator, reviewer, Developer and read-only Scout. Dispatch is serialized to bind launch hooks correctly, but workers can run concurrently in distinct linked worktrees. Same-workspace ownership is exclusive, including waiting/paused workers, except for pinned reviewers on the same verified clean Git candidate; this is not an immutable snapshot. See [parallel guidance](../skills/addy-engineering/references/parallel-work.md). No parallel writers in a shared checkout. Fixed grants and saved pins remain binding; workers do not nest.

New workers can load project context/skills/templates/themes. Executable extension and MCP discovery still need an explicit trust mechanism and remain denied; this is not an OS sandbox. Legacy saved sessions preserve their original resource policy.

Use exact owned names and correlated replies. Reconcile state/resources before continuation or bounded replacement. Undeclared new workers have no arbitrary 20-minute execution stop; explicit assignment limits are cumulative across resumes/replacement. Legacy unbound saved sessions retain their old timeout. A timeout cancels, never accepts. Unknown ownership or failed cleanup still blocks dispatch.

Preserve unrelated work and applications. Isolate live-side-effect tests. New private data, application control, destructive cleanup, commit/install/push/publication need applicable authority. Finish with exact candidate, actual/reused checks, one consolidated manual checklist and honest gaps.

Runtime details and routing: [lean-workflows.md](lean-workflows.md). The legacy delivery_worker/scripts/delivery-agent.ts remains a sequential compatibility transport; use the tmux adapter for the new concurrency behavior.
