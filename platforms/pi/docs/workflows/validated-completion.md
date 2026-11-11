# Validate before milestone completion

This applies to every milestone, checklist item, phase exit and completion/readiness claim, in Direct, Developer and Team work. It is not only a final VERIFY/SHIP gate. A milestone such as **prepare validation environment** has its own outcome to prove before it can be completed.

## Completion rule

Before marking work `completed` or saying it is done/ready:

1. Establish the milestone's acceptance condition from the requested outcome. Keep it proportionate: a document needs content/link checks, not a fabricated runtime test; an access flow needs a working flow, not just written configuration. For nontrivial milestones identify the check when planning, not after claiming success.
2. Perform the relevant self-validation on the actual candidate and environment. In delegated work the authorized worker executes checks and the lead inspects the returned evidence; this rule does not change role grants. Inspect results, not merely a command invocation, process launch, screenshot filename, worker summary or exit code.
3. Confirm inspected evidence covers that acceptance condition and the intended user path, including meaningful failure behavior where relevant. Record a concise result and an evidence pointer in the existing task record or conversation; no new mandatory file or per-row evidence schema.
4. Only then mark the milestone complete. Reuse existing evidence only when the relevant candidate/environment conditions are unchanged. Renew affected checks after a change. If newer evidence invalidates a completed milestone, reopen it and correct the status/claim.

A green build does not prove a deployed flow. A green test subset does not prove untested acceptance. Worker completion is not lead acceptance, and agent self-validation is not user acceptance or release permission.

## Incomplete validation is an open milestone

If a check fails, repair and revalidate within existing authority. If it is blocked, missing, partial or cannot safely run, retain an unfinished state with the reason and next required check. With `todo_write`, use `pending` plus `[blocked] validation: <reason>` when no work is active, or `in_progress` while actively repairing/validating. Do not hide the gap by deleting the row, weakening the acceptance condition, renaming the milestone after the fact or marking an implemented parent complete while required validation remains open.

Say **implemented/configured, validation blocked** rather than **done**, **ready for review** or **complete with validation left to the user**. A user review is for judgment and acceptance, not a substitute for the agent checking that the delivered behavior works. Subjective, hardware-only or user-only checks may genuinely remain; describe their exact limits without claiming their outcome.

Validation grants no additional permission. Ask for missing private-data, live-side-effect or service-control authority when required; do not bypass authentication, attach to personal browser profiles or interrupt a session just to turn a status green. An authority blocker keeps the relevant milestone open. A genuine user-authorized scope change can redefine the deliverable prospectively; do not silently waive a failed check.

## Manual acceptance handoff

During planning, establish the review method, acceptance criteria, actual candidate, access and environment lifecycle for work needing user judgment. Read the project's `AGENTS.md` for its normal handoff and reuse the conversation and settled decisions; ask only about a consequential unresolved gap. Keep trivial or non-reviewable work proportionate; no mandatory gate or new artifact suite.

After agent checks and applicable review, provide the actual candidate, access instructions, a concise requirements-based checklist and limitations. Keep an approved review environment available until the user finishes, within the agreed lifecycle; tell them when it will be stopped. If access, operation or permission is blocked, report the blocker and a recommended next step instead of claiming readiness. Do not substitute another environment without agreement.

Distinguish accept, requested changes and hold. Requested changes return to implementation and affected checks; hold, cancellation or ambiguity is not acceptance. User acceptance is no automatic release authority: commit, push and deploy require applicable explicit authorization. Project instructions describe the process but do not themselves grant access to private data or authority for destructive or outward actions.

## Environments prepared for user review

The acceptance condition is **the environment is usable through the normal user access path**, not merely that provisioning/deployment finished. Validate the supplied link or entry command, ordinary DNS, certificate verification and required login, then the actual function the user is expected to review. Test data and accounts must be authorized. A successful login page alone does not prove the desktop/application beyond it works.

A diagnostic bypass—hostname override, TLS bypass, test-only route, mocked service or alternate authentication—can isolate a failure but cannot prove the normal user path. Keep the gap open until the normal path passes. If only an authorized isolated approximation is available, state precisely what it proves and what remains unvalidated; do not call the real review environment ready.

For the Kali case, the relevant browser journey was normal Mac DNS → dashboard link → launcher login → VM startup/readiness → usable desktop. A hostname-mapped screenshot established only part of that journey. Any power/shutdown steps still require applicable authority and must preserve an active user session.

## Examples of truthful state

| Evidence | Status / claim |
| --- | --- |
| Provisioning command succeeded; ordinary hostname fails | Environment milestone pending/blocked: DNS; not ready for review |
| Browser works with a host override only | Diagnostic success; ordinary access still unvalidated |
| Worker says done but supplies no meaningful check results | Await/inspect validation evidence; no lead completion yet |
| Required check failed or permission is missing | Repair in progress, or pending/blocked with reason |
| Relevant checks passed for the actual candidate and normal access path | Milestone may complete; user acceptance/release remain separate |
| Environment changes after the successful check | Renew affected evidence before claiming readiness; reopen if invalidated |

## Enforcement boundary

The always-loaded policy, PACE/delivery entry points and progress tool description carry this rule. Regression tests check wording/link continuity and the description registered by the actual Pi extension loader. This is workflow guidance, **not a mechanical guarantee** that a model's claims or submitted evidence are truthful. The checklist remains a projection of lead-accepted work, not an evidence-verification engine. No new scheduler, automatic browser access, approval ceremony or tool-schema change is introduced.

The personal installation's policy, skills and progress extension are symlinked to this checkout. Fresh sessions load the updated policy/resources. An already-running session may retain its previous system instructions and registered tool description; do not claim it was retroactively refreshed. No installation or active-session reload is required or performed by this source change. Use a fresh session for the complete updated loadout.
