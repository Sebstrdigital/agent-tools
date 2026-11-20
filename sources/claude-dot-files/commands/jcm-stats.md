---
name: jcm-stats
description: "Show jCodeMunch token savings stats. Reads cumulative tokens saved, cost avoided, and per-repo index summary. Triggers on: jcm stats, jcodemunch stats, token savings."
source_id: seb-claude-tools
version: 1.0.0
---

# jCodeMunch Stats

Read and display the current jCodeMunch token savings summary.

## Steps

1. **Call `mcp__jcodemunch__list_repos`** to get the current index inventory

2. **Read savings file:** Run `cat ~/.code-index/_savings.json 2>/dev/null || echo "NOT_FOUND"` via Bash
   - If output is `NOT_FOUND`, note that no symbol retrievals have been made yet

3. **Display a clean summary** in this format:

The bracket column is the greedy number × 0.5, formatted with a `~` prefix. Align both columns.

```
## jCodeMunch Stats

### Token Savings (cumulative)
- Tokens saved:            1,002,560  [~501,000]
- Cost avoided (Opus 4.6): $15.04    [~$7.52]
- Cost avoided (GPT-5.2):  $10.03    [~$5.02]

### Indexed Repos
| Repo              | Files | Symbols | Indexed At  |
|-------------------|-------|---------|-------------|
| local/dua-erp     |  46   |   370   | 2026-03-06  |
| ...               |  ...  |   ...   | ...         |
```

## Notes

- Savings are recorded by `get_symbol`, `get_symbols`, and `search_symbols` — not by `index_folder`, `list_repos`, or `get_repo_outline`
- The bracket figure [~X] = greedy × 0.5 (accounts for file-reuse in real workflows)
- Pricing: Claude Opus 4.6 $15.00/1M input tokens, GPT-5.2 $10.00/1M input tokens (as defined in `token_tracker.py`)
- The raw `_savings.json` file lives at `~/.code-index/_savings.json`
- Use `JCODEMUNCH_SHARE_SAVINGS=0` to disable anonymous community telemetry
