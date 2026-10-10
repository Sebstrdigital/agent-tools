# Team delegation

Explicit Team selection and approval of the compact record's actual Agreement section are required. Developer uses its dedicated tool, not Team controls; see `../../../docs/lean-workflows.md` relative to this reference directory. Consult `authority-and-state.md` for state/recovery questions, not a reading-proof ceremony.

Supply a 3–5 sentence task, workspace/branch, relevant rules/context pointers, checks and unusual permissions. Include existing changes that matter. Children cannot discover project context; provide accessible paths or useful excerpts without omitting governing constraints. No mandatory reading manifests, read receipts or exhaustive hashes. Configured role defaults apply; no need to list models in each packet.

## Builder packet

Give one slice ID, purpose, intended outcome, scope/owned paths, acceptance, prerequisites and relevant design decisions. Supply the starting candidate and accepted prerequisite findings, not prior worker transcripts. Explicitly exclude other slices: do not start the next slice even if it is in the approved overall task. Approval includes ordinary in-scope investigation, edits, checks and bounded repair. No commit unless permitted.

Return a concise handoff: changed paths/candidate, actual checks/results, gaps, decisions/blockers, repair allowance consumed/remaining and evidence pointers useful to the next slice. Keep raw logs on disk; do not return transcripts or whole log batches.

## Validator packet

Give the slice acceptance, complete slice-owned diff including added files, current cumulative candidate and relevant builder/prerequisite evidence. Run agreed slice checks independently without source edits; final integrated validation covers the complete task candidate. Report commands/exits/counts/skips/exclusions and gaps. Do not control unrelated live applications; propose isolation/exclusion if needed. Missing checks are not passes.

## Reviewer packet

Give the same slice/cumulative candidate, complete slice diff and relevant validation evidence. Review outcome fit, affected prerequisite interfaces and realistic behavior: repeated use, omitted options, data preservation, failure paths and visible effects. Review the complete slice, not just its latest fix. Final integrated review covers the whole task/MR including added files, not only the last slice. Evidence-backed blockers are separate from nonblocking suggestions; no findings quota.

## Run

Prefer meaningful vertical slices across needed layers, not technical-layer chores. In the canonical task record give each slice an ID, observable outcome, depends-on IDs, change ownership and parallel eligibility. Dependency-ready means all prerequisites are lead-accepted; parallel-safe additionally means no unresolved file, interface or resource conflicts. Independent qualification can be a slice with a decision/evidence outcome and no product edits.

Each planned slice gets a fresh builder run; never bundle slices into one assignment or resume a previous slice's builder for the next slice. Use fresh sequential builder -> no-edit validator -> inspection-only reviewer per slice. The lead accepts after required gates, then launches the next dependency-ready slice. Material qualification findings must be resolved before dependent migration edits. Parallel eligibility is planning metadata, not launch authority: execution remains sequential, one owned worker, no nesting or grant widening. Validator shell is for checks, not source repair; reviewer is inspection-only. Native codemode is not an OS sandbox. Child extensions/MCP/skills/templates/themes/context discovery remains denied.

Results/questions arrive automatically; do not poll. Use exact owned name/runId/questionId. Pause retains ownership; rearm needs in-scope work; stop cancels. Inspect current changes/resources before resume. Fixed timeout and optional assignment/escalation limits apply. The legacy `delivery_worker`/`scripts/delivery-agent.ts` transport has no validator role; supply an approved fresh validator separately and load `../../../agents/` prompts explicitly.

The lead owns implement -> diagnose -> in-scope repair -> revalidate/review -> next approved task. Red task-owned checks trigger bounded builder repair; validator/reviewer report findings without editing. At most three focused repair cycles unless approval is stricter, renewing affected checks/review. If the same defect survives two cycles, the third uses a fresh stronger same-role builder context with diagnosis before edits; follow the lean guide's existing escalation controls and remaining allowance, never reset limits. Stop for authority/security/scope/ownership/material-decision boundaries, no progress or an exhausted agreed budget; do not expand scope retroactively.

A routine baseline does not need its own three-role cycle. Use relevant baseline evidence, then fresh validation/review of the change. Retain final integrated validation/review of the complete candidate, not just isolated slice passes; the last slice's gates may satisfy this if they cover the integrated result. The lead inspects and explicitly accepts; worker completion is not acceptance. Continue approved dependencies without routine customer prompts.

Repairs stay attached to the originating slice and its approved allowance; same-slice resume is for remaining work/repair, not the next slice. A fresh run, timeout or slice boundary does not reset task-level or declared runtime limits. Declare repair allocation in the Agreement if needed; slicing alone grants no extra cycles.

Keep one canonical progress entry and evidence pointers. Lead retrieval should answer a concrete question with bounded, source-linked output: filter/aggregate before admission, including inside codemode; do not merely batch raw reads. Inspect complete task-owned changes including added files in bounded sections; handoff summaries do not replace actual change inspection. Load only governing constraints and relevant accepted findings for the next packet. No invented active-minute ledger, full-session audit or duplicate continuation documents. Record a concise Munin handoff with its ID. Runtime details/default routing remain in the lean guide; Scout may investigate without Developer or Team selection but does not accept work.
