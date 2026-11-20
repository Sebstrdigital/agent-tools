---
name: clean-context
description: Audit and trim Claude Code context files — remove anything discoverable from code
user-invocable: true
---

# Clean Context Audit

The only rule: **if I could figure it out by reading the code, it shouldn't be here.**

Keep: gotchas, quirks, corrections, hard-won lessons, user preferences, external facts.
Remove: architecture, file paths, commands, design patterns, step-by-step checklists, generic engineering advice.

## Filtering heuristic

For each line in a context file, ask: **"Would I get this wrong without being told?"**
- Yes → keep
- No → remove
- Duplicated elsewhere → remove from one place

Present findings to the user before making changes.

## Non-obvious things to check

- Parent-level memory files in `~/.claude/projects/` can accumulate project-specific context at the wrong scope and pollute unrelated sessions. Empty them unless something is genuinely global.
- Skills that only contain discoverable steps should be trimmed to just the non-obvious gotchas or deleted.
- If `.claude/rules/` exists with few small files, consolidate into `CLAUDE.md` — glob filtering only earns its keep with 10+ files.
- Check `~/.claude/projects/` for orphaned project dirs where the working directory no longer exists.
- Check for stale git worktrees.
