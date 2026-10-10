# Team workflow (delivery compatibility APIs)

## Purpose

Make Pi useful for real development with proportionate planning. The lead recommends Direct, Developer or Team; the user selects. Direct has no mandatory files. Developer uses its dedicated `developer` tool and one compact approved packet. Team adds fresh independent validation and review, not compulsory bureaucracy. Use `/skill:delivery`; no duplicate Team controller.

## Task and approval

Default to one compact task record with a 3–5 sentence issue, relevant context/check pointers and a short Agreement section. An existing JSON sprint/task record is fine. Brief/Plan/Agreement are responsibilities, not mandatory separate files. See `skills/delivery/references/templates/task.md`; the old separate templates are optional.

The user approves the actual Agreement before launch. Approval includes ordinary in-scope edits, investigation, tests and bounded repairs. State unusual permissions once; commit/push/install/deploy/delete are separate unless already approved. A consequential change gets a short dated approval note, not another document suite. More detail requires a concrete risk, especially irreversible production actions; project size or Team selection alone does not justify it.

Pass purpose, acceptance, relevant rules, current workspace and source pointers explicitly. Children cannot discover project context automatically. Read relevant source/evidence as needed; no mandatory manifests, read receipts, exhaustive hashes or historical rereading. Keep logs on disk and retrieve bounded passages.

## Execution

1. Inspect current source/rules and establish relevant baseline evidence.
2. Obtain approval for the compact task/Agreement.
3. Run a fresh builder; inspect the actual changes.
4. Run a fresh no-edit validator on that candidate.
5. Run a fresh inspection-only reviewer with the complete task-owned diff including added files and relevant evidence.
6. Handle blockers with bounded builder repair; renew affected checks/review.
7. Explicitly accept, then continue approved dependencies and finish integrated checks.

A routine baseline does not need a separate three-role cycle. Review outcome fit, repeat use, omitted options, data preservation and visible behavior where relevant; do not merely check artifacts/spec compliance. Suggestions are nonblocking; no findings quota. At most two focused fix cycles unless approval is stricter. Worker completion is not acceptance.

Do not require unrelated applications to close or control them. Isolate live-side-effect tests; get approval for changed required checks and report exact exclusions/gaps. Ask before stopping the application under development when needed.

Use simple agreed ceilings where useful, not speculative per-role active-minute ledgers. Do not invent effort from elapsed time or nominal allowances. Existing optional runtime assignment/escalation limits still apply.

## Runtime

The installed visible tmux controls run one owned worker at a time: builder -> no-edit validator -> inspection-only reviewer. Use configured model defaults; task packets need not list models. No nesting, parallel workers or tool widening. Native codemode is available through fixed grants. Children deny extensions/MCP/skills/templates/themes/context discovery; these controls are not an OS sandbox.

Results/questions arrive automatically. Use exact names and correlated IDs. Pause retains ownership; rearm needs explicit in-scope work. Stop, shutdown or the fixed 20-minute timeout cancel, never accept. Reconcile current changes and owned resources before resume; do not blindly replay. Clean up only approved owned workloads, not the user's applications.

The legacy `delivery_worker` and `scripts/delivery-agent.ts` transport has builder/reviewer but no validator role. Supply an approved fresh no-edit validator separately or keep the Team gate incomplete. Standalone Developer is not a legacy-control shortcut.

The lead owns task state and acceptance; the todo widget only projects the compact record's Plan section. Keep blocked/paused/cancelled/abandoned work visible. Record concise outcomes/next actions in Munin and use exact IDs for known handoffs; relevance search is not recency ordering.

## Further detail

- [Lean usage and runtime limits](lean-workflows.md)
- [Delegation](../skills/delivery/references/delegation.md)
- [Approval and state](../skills/delivery/references/authority-and-state.md)
- [Scout/routing and optional escalation](workflows/scout-role-routing.md)
- [Progress widget](progress.md)

Runtime admission, ownership, role grants and model routing are unchanged by this guidance revision. Structural/fixture tests are not guarantees of model behavior; the next real-work trial supplies usability feedback.
