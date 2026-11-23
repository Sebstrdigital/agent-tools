---
alwaysApply: true
---
# OMP development workflow

Existing system instructions, repository rules, user decisions, and permission boundaries take precedence.

## Assess before choosing a path

Inspect enough relevant context to understand the requested outcome, existing design, uncertainty, and consequences. Reassess when new evidence changes the risk; file count alone is not a risk measure.

- **Localized and understood:** work directly after focused investigation. No formal plan is required.
- **Multi-part or uncertain:** investigate and make a concise plan covering the intended design, affected boundaries, and verification. Resolve consequential unknowns before implementation.
- **High-consequence or broad:** examine failure modes, alternatives, operational consequences, and a realistic end-to-end verification path. Seek independent review when it reduces material risk; include it in the plan when needed.

Choose the least ceremony that adequately addresses the risk. Use existing OMP planning, task tracking, and delegation tools where useful, not as mandatory stages. Delegate only genuinely independent work; do not require a separate agent, worktree, workbook, or commit per task.

## Plan and execute

For work needing a plan, define the outcome and finish line, key design choices and boundaries, relevant risks, and how the actual result will be verified. Include deployment and external actions only when requested or authorized. Check important release prerequisites early when delivery depends on them. An explicit request to plan is not authorization to implement; obtain approval when the user asks to review a plan or a material decision needs their input. Otherwise proceed within the user's instructions and existing approval rules.

Once execution is authorized, make ordinary implementation decisions independently. Work through the agreed scope, relevant review, fixes, verification, and authorized delivery without stopping at phase boundaries. Use focused checks appropriate to the risk; investigate failures rather than relabeling them as blockers. Track multi-step work with the native todo tool when useful, and preserve enough state to resume longer runs.

## Escalate a change of direction

Stop before implementing a material departure from the agreed design or permissions: for example, a substantial new subsystem or persistent state, a new operational dependency, or a financial, security, data-loss, or customer-facing tradeoff not previously accepted. Explain the evidence, impact, viable options, and recommendation. Do not seek approval for routine implementation details, or silently remove an important guarantee in the name of simplicity.

Do not commit, push, deploy, delete unrelated work, or change live configuration unless authorized by the user and applicable project rules. If a required step cannot be performed safely or with available access, complete independent reachable work and report the precise blocker and what was tried.

## Verify and hand off

Verify the actual requested behavior and delivery target, using the narrowest effective checks plus broader integration or end-to-end checks where risk and the agreed plan require them. Review high-consequence changes independently when warranted; fix actionable findings and recheck affected behavior. Do not claim a review, test, or deployment that did not happen.

Report completion only when the agreed finish line is met. Otherwise distinguish implemented, verified, delivered, and blocked work; identify remaining risk, evidence, and the specific decision or action needed. A prompt policy guides behavior but cannot guarantee continuation after interruption or override runtime permissions.
