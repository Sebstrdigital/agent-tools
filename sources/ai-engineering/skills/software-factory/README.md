# The Software Factory Playbook — Dex Horthy's 4-gate workflow as a skill

A Claude Code Agent Skill built from **Dex Horthy's (HumanLayer) playbook** on David Ondrej's podcast.

> "Once the model has written thousands of lines of code, it is harder to change. The sessions that generate design docs are context-light — you get the most model intelligence when you do the hard thinking early."

By default, agents build horizontally: all the backend, then all the frontend, then a 2,000-line diff lands in your lap and reviewing it is your problem. This skill flips that. Every decision that matters gets made **before** the code exists — where changing your mind costs a sentence, not a rewrite.

## What it does

When you start a real feature, your agent walks through **four approval gates** — and stops at each one until you sign off:

1. **Product** — what user problem, how success is measured, the "blog post before the feature," and plain HTML mockups of every screen. No tech talk allowed.
2. **Architecture** — how it fits your existing system: endpoints, tables, query outlines, the end-to-end flow.
3. **Program Design** — the step everyone skips: file locations, types and method signatures (no bodies), the call stack, what the tests will assert, and a list of the decisions the agent is least confident about.
4. **Vertical Slices** — code, finally — but tracer-bullet style: a thin end-to-end slice that runs first, then real logic one testable slice at a time. You can re-steer after every slice, while it's cheap.

Every gate follows a fixed doc template and writes to `docs/plans/<feature>/`, with a `00-status.md` state file tracking which gates you've approved and which slices are done. That means decisions survive across sessions: the agent compacts everything into the docs at every gate and slice boundary (Dex's **dumb-zone** rule — keep the hard thinking early in the context window), and any fresh session picks up exactly where the last one stopped.

Trivial tweaks are exempt — nobody needs four gates to change a button color.

## Install (30 seconds)

```bash
mkdir -p ~/.claude/skills/software-factory
curl -fsSL "https://gist.githubusercontent.com/Maciejdziuba/88890d7e0eeefa5a8738bbe9fd5e20b8/raw/SKILL.md" \
  -o ~/.claude/skills/software-factory/SKILL.md
```

Restart Claude Code. The skill activates automatically on real features, or invoke it with `/software-factory`.

Works in any agent that supports the SKILL.md format (Claude Code, Amp, and others).

## Bonus inside

- **The dumb-zone rule** — Dex's context-engineering practice: make the hard decisions early in the context window, compact to docs at every gate and slice boundary, restart fresh.
- **The context-in-the-codebase convention** — `docs/adr/` for decisions and `docs/external/` for everything outside the repo (env var names, payment setup, test accounts), so every future session starts smarter.

---

From the episode with **Dex Horthy** on why software factories fail, benchmarks vs. real codebases, and context engineering — [David Ondrej on YouTube](https://www.youtube.com/@DavidOndrej). Follow Dex: [X @dexhorthy](https://x.com/dexhorthy) · [HumanLayer](https://humanlayer.dev)
