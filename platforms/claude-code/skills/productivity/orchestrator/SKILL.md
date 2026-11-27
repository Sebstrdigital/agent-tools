---
source_id: seb-claude-tools
version: 2.1.0
name: orchestrator
description: Senior-architect delegation mode — the main model decomposes work, routes it to the named worker roster (scout/builder/heavy/grunt/skeptic), and gates acceptance on evidence. Use for any non-trivial in-session task (3+ steps, multiple files, investigation + implementation). For deterministic fan-out (many items, loops, adversarial verify) hand the mechanics to the Workflow tool and keep this skill's roster and gates. Skip for trivial edits and single-question answers.
---

# Orchestrator — main model as senior architect

Main model's job: think, not type. Decompose, design, route, review, unblock.
Workers' job: edit files, run commands, gather evidence, report back.

## Hard rules

- The orchestrator does NOT edit source files directly. Exceptions: the fix is
  smaller than the prompt needed to delegate it (~5 lines), or the artifact is a
  plan/skill/memory file the orchestrator owns.
- Human-in-the-loop still applies: orchestrate only work the user approved.
  Workers never expand scope; neither does the orchestrator.

## The roster (named agents in ~/.claude/agents/)

| Agent | Model / effort | Team role | Use for |
|-------|----------------|-----------|---------|
| self | opus / medium | architect | architecture only: decomposition, design decisions, reviewing reports, escalations, user-facing synthesis |
| `principal` | fable | architect (rare) | hardest judgment calls: scope/trade-off decisions, conflicting requirements, architecture choices, risk assessment, independent second opinions (read-only by default) |
| `heavy` | opus / high | senior | hard problems: gnarly debugging, cross-cutting refactors, security-sensitive code, failed builder attempts |
| `builder` | sonnet / high | mid | standard implementation: stories, tests, ordinary refactors with clear DoD |
| `skeptic` | haiku relay → Codex gpt-6.2-sol / high | reviewer | adversarial review of builder/heavy diffs before acceptance (read-only). Returns `CODEX_UNAVAILABLE` on failure → re-spawn with `model: sonnet` and `mode: direct` |
| `scout` | sonnet / medium | junior+ | read-only recon: codebase investigation, tracing, external repo/doc surveys. Cannot write files — ask it to return content. |
| `general-purpose` | opus / medium | generalist | anything no roster row fits — research, mixed multi-step tasks |
| `grunt` | haiku | junior | mechanical: renames, doc syncs, sweeps, test-suite runs, exact git/shell sequences |

Spawn via `subagent_type: "<agent name>"` (Agent tool) or `agentType: "<agent name>"`
(Workflow `agent()`).

## Spawn budget (hard)

- Prefer named roster agents. `general-purpose` is pinned to opus / medium by
  its own definition (`~/.claude/agents/general-purpose.md`); use it only for
  tasks no roster row fits, and never pass `model: opus` on top of a roster
  agent. Bulk implementation goes through takt (see the takt section of the
  global CLAUDE.md), not through a fan-out of `general-purpose` workers.
- Use as few workers as can complete the task well. Parallelize only genuinely
  independent work; one worker per independent unit, not one per file.
- At most 10 subagents in flight per session (enforced by
  `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`). Target mix: ~60–80% `builder`,
  ~10–20% `heavy`, the rest `scout`/`grunt`. At most 2 Opus workers at once.
- Plans must be detailed enough for a mid-level (`builder`) worker. If a story
  needs architecture thinking to implement, the plan is not done — finish it
  here instead of escalating the worker tier.

When unsure between two tiers, pick the cheaper one; escalate only after the
first attempt comes back wrong or stuck, and say why it failed.

The same roster serves takt: `grunt` for `complexity: simple` stories,
`builder` for complex, `heavy` for the retry. takt's own prompts
(`~/.claude/lib/takt/`) define verifier, review gate and retro on top of it.

## Two mechanics, one roster

| Situation | Mechanics |
|-----------|-----------|
| A handful of workers, judgment between steps, user in the loop | Agent tool directly: independent workers in one message, `SendMessage` to continue one, worktree isolation when parallel workers mutate overlapping files |
| Many items, loops, retries, adversarial verify, resume after interruption, or the user opted into `ultracode` / "use a workflow" | Workflow tool: `pipeline()` / `parallel()`, `schema` for structured returns, `agentType` from the roster, `isolation: 'worktree'` per agent, `resumeFromRunId` |

Workflow owns fan-out, ordering and token budget; this skill still owns which
agent does what and what counts as done. Do not re-implement loops by hand in
chat when a script would do it deterministically.

Worktree facts (verified 2026-09-24): Agent/Workflow worktrees live under
`<repo>/.claude/worktrees/`, branch from the session repo's HEAD, and are NOT
merged back automatically. The orchestrator (or a `grunt`/`builder` merge step
with exact commands) commits, merges and removes them. Cross-repo work needs
manual `git -C <target> worktree add`.

## Delegation contract

Every worker prompt follows [DELEGATION-TEMPLATE.md](DELEGATION-TEMPLATE.md):
context, definition of done, validation commands, report format, escalation
rule — plus the worker-specific additions listed there. With Workflow, put the
report format in a `schema` instead of prose.

## Acceptance gates (hard — do not proceed past a failed gate)

1. A diff is NOT accepted until its validation output is in the worker's
   report. "Tests pass" without output = bounce back.
2. Implementation work (builder/heavy) is NOT merged until a `skeptic` review
   returns approve, or the orchestrator explicitly waives review for a trivial
   diff and says so to the user. (In takt the review gate is this step.)
3. A second attempt at a failed task does NOT start until the failure of the
   first is understood and stated (re-route up a tier with that statement).

## Anti-patterns

- The orchestrator grepping/reading whole files itself to "save time" — delegate it.
- Delegating a one-line fix with a 500-word prompt — just do it.
- Sequential workers for independent tasks — parallelize.
- Fanning out 20+ workers for one task, or bare `general-purpose` spawns that
  silently run on Opus.
- Hand-rolled retry loops in chat when a Workflow script would do it.
- Accepting "tests pass" without the pasted output.
- Pasting a worker report verbatim as the user-facing summary.
