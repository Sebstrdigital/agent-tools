# OMP integration

OMP-specific capabilities belong here. No workflow or skills are installed by adding this directory.

Portability target: the team profiles and workflow should work on both macOS and Linux without requiring an OS-specific sandbox. The installer and workflow have not yet been validated on Linux; optional OS-specific experiments are not installation dependencies.

The canonical [development workflow](rules/agent-tools-development-workflow.md) now uses proportional delegation: the lead may handle small, clear work directly and delegate when useful. The earlier local [original workflow](candidates/agent-tools-development-workflow-original.md) and orchestrator-first team candidate below remain preserved for comparison and rollback. Updating this repository alone does not switch a live profile.

## Software team agent candidates

`agents/` contains nine OMP-native profiles. Seven are the original specialist candidates: `analyst`, `software-architect`, `ui-ux-designer`, `backend-developer`, `frontend-developer`, `data-developer`, and `qa-engineer`. Together with OMP's existing `scout`, `reviewer`, and `security-reviewer`, they form the proposed ten-role team. The fetched source also includes `complex-reviewer` and `complex-task`; the preserved local installer does not support installing those two profiles. Existing installed agents and configured models are not replaced by updating source; exact bundled definitions vary by OMP version and local overrides.

Select an agent for its responsibility, then supply the assignment's stack, scope, acceptance criteria, relevant context, and permissions. Analysis and design profiles are intended not to edit; developer profiles implement and verify; QA validates and may write tests when assigned or needed. Reviews remain independent. These are options, not mandatory sequential stages. A profile may request a bounded scout where spawning is permitted; the parent spawn policy and depth limits still apply, and OMP's existing security reviewer does not declare scout spawning.

The seven profiles deliberately omit model selectors, so existing OMP model resolution and operator overrides apply. Their instructions do not grant permissions or establish a sandbox. To install one profile without replacing an existing agent, explicitly select it:

```sh
platforms/omp/install.sh --agent-dir /path/to/isolated-agent --agent backend-developer
```

The installer also accepts the default profile when `--agent-dir` is omitted; do not target a live installation without explicit approval. It does not replace existing agent paths. The seven profiles are candidates; see [agent team research](agent-team-research.md) for the tool and skill matrix and remaining evaluation.

## Orchestrator-first workflow candidate

The preserved [software-team workflow candidate](candidates/agent-tools-development-workflow.md) instructs the session agent to lead and delegate implementation changes, while the lead inspects, coordinates and verifies. It was approved for a default-profile live trial before the proportional workflow cutover. It is an alternative to the canonical proportional rule and the original local workflow, not an additional rule to apply alongside either. It is not installed by `--workflow`; that option now selects the canonical proportional rule.

For consequential deployment where independent review is warranted, the rule makes review a prerequisite, requires affected checks after repairs, and tracks material safety conditions before state-changing tests or deployment. These are instructions, not enforced runtime gates.

For an isolated profile, select the replacement explicitly:

```sh
platforms/omp/install.sh --agent-dir /path/to/isolated-agent --team-workflow
```

Both workflow options use the same destination name and refuse to replace a different existing file or link. `--workflow` selects `rules/agent-tools-development-workflow.md` (the proportional rule); `--team-workflow` selects the preserved orchestrator-first candidate. This prevents a collision at that path, not a conflicting rule installed under another name. Replacing a different existing workflow requires explicit approval.

The candidate targets the main agent only, so workers are not instructed to delegate their own implementation. OMP's higher-priority session instructions, agent availability, tool restrictions and runtime policies can prevent delegation. In isolated trials, the project rule was visible but the lead directly wrote a small requested file in two runs; an appended-system-prompt trial delegated. The desired always-delegate behavior is therefore **not established** for normal rule installation. A rule is guidance, not enforcement or a sandbox.

`experiments/orchestrator-write-guard.mjs` is an opt-in, isolated prototype, not an installed or complete enforcement mechanism. It blocks direct lead `write` and `edit` calls, except agent messaging; it also blocks `out://` writes. Shell, eval, and other tools remain capable of mutation. A temporary OMP trial confirmed both the direct-write block and a shell bypass. It must not be activated in a live profile; see the [research record](agent-team-research.md) for coverage and remaining validation.

The separate macOS-only `experiments/verification-seatbelt.sb` and `verification-seatbelt-test.py` probe filesystem and network restrictions on a verification subprocess. They are not wired into OMP and are not a comprehensive security policy. See the research record for observed behavior and limitations.

## Workflow selection and rollback

The approved default-profile cutover selects the canonical proportional rule. This repository reconciliation does not perform that live change. Before an approved switch or rollback, inspect the actual profile link and preserve its previous target; never replace an unrelated file or link.

The previous local rollback instructions used `--workflow` to restore the original rule. That is no longer correct: `--workflow` now selects the remote proportional rule. The unchanged original local source is preserved at `candidates/agent-tools-development-workflow-original.md`; restoring that exact variant requires an explicitly approved link change to that source. `--team-workflow` selects the preserved team candidate instead. Existing specialist links may remain; remove any only after separately approving removal and checking its target.

## Install a skill

Place an OMP-specific skill at `skills/<name>/SKILL.md`, including its supporting files in the same directory. Then explicitly install that skill:

```sh
platforms/omp/install.sh <name>
```

The installer links that skill directory into `~/.omp/agent/skills/` (or `$PI_CODING_AGENT_DIR/skills/`). The link follows subsequent source edits; rerunning is safe. Existing files, directories, and links to other sources are never replaced or removed. Skill names must use lowercase ASCII letters, digits, and hyphens.

For a named OMP profile, a custom `PI_CONFIG_DIR`, or an isolated test, choose the agent directory explicitly:

```sh
platforms/omp/install.sh --agent-dir /path/to/agent <name>
```

Installing a skill makes its instructions discoverable by OMP; it does not grant permissions or guarantee autonomous execution. The installer does not configure or activate extensions, hooks, shared skills, or settings. Run it against a live installation only after approving the specific capability. Moving this repository breaks its links until they are manually removed and reinstalled.
