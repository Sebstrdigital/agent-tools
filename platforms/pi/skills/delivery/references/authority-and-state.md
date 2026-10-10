# Approval and state

Use one compact Markdown or existing JSON record. Agreement states scope, acceptance, checks, permissions and limits. Team selection permits preparation only; execution needs approval identifying the actual Agreement, not a claimed hash.

Record approval once; progress is not scope. Consequential changes need renewed approval and a short dated note, not another file. In-scope edits, diagnosis, checks and bounded repairs need no repeated permission. Commit/install/delete/push/publish require authority.

Use git status/diffs to separate task changes from unrelated work. Match checks/review to the final candidate; stronger identities serve specific integrity risks/runtime features.

Pass purpose, constraints, acceptance, rules and relevant accepted prerequisite evidence, not worker transcripts. Read question-driven bounded source/evidence. Codemode must filter/aggregate before admission, not batch raw reads. No mandatory reading manifests or read receipts. Reuse unchanged context. Inspect complete changes in bounded sections; summaries do not replace review.

Do not require unrelated apps to close. Isolate live-side-effect tests or propose exact exclusions with honest gaps; required-check changes need approval. Ask before stopping the app being developed. An excluded or missing check is not a pass.

The lead owns implement -> diagnose -> in-scope repair -> revalidate/review -> next approved task. Red task-owned checks trigger bounded repair. At most three focused repair cycles unless approval is stricter; renew affected checks/review. If the same defect survives two cycles, the third uses a fresh stronger same-role builder context with diagnosis before edits and no allowance reset. Existing approvals and declared runtime limits remain binding. Stop for authority/security/scope/ownership/material-decision boundaries, no progress or an exhausted agreed budget. No retroactive scope expansion.

Limits cannot reset on resume or fresh slice runs. Repairs remain attached to their slice within approved task/runtime allowances; slicing grants no extra cycles. Errors, silence or timeout are not acceptance. Reconcile source, evidence, state and resources before retry; never blindly replay mutations.

## State

The canonical record's Plan section is authoritative: slice IDs/outcomes, depends-on IDs, ownership, parallel eligibility, state/candidate, decisions, blockers and evidence pointers. The lead alone updates acceptance after required validation/review on the same revision. Start each slice in a fresh builder run only after prerequisite acceptance; never reuse a previous slice's builder for the next slice. Parallel eligibility is metadata, not authority; execution remains sequential. Retain final integrated validation/review.

- **pending:** not started/dependency waiting.
- **active:** implementation, validation or review underway.
- **blocked:** concrete blocker and needed action.
- **paused:** deliberately stopped; next step recorded.
- **cancelled:** cancelled, not accepted.
- **abandoned:** no longer pursued, not accepted.
- **accepted:** lead accepted changes and final checks/review.

Keep unresolved rows visible; no invented percentages. Engineering completion is not user acceptance or release permission.

## Widget and handoff

The opt-in widget maps accepted to completed **only**, active to in_progress and unresolved work to pending with [blocked], [paused], [cancelled] or [abandoned] labels. Filter its bundled scratchpad skill; see `../../../docs/progress.md`. After compaction/reload recover the task record and current state, not all history.

Store a concise Munin next step/ID. Recall ranks relevance, not recency; use `munin show <id>` for a known handoff. No prompt or static test guarantees universal behavior.

Runtime grants/routing/ownership are unchanged; consult `../../../docs/lean-workflows.md` or `../../../docs/workflows/scout-role-routing.md` only for relevant runtime questions.
