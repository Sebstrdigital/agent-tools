---
name: jcm-savings
description: "Show jCodeMunch token savings only (fast). No repo listing. Triggers on: jcm savings, token savings, how much have I saved."
source_id: seb-claude-tools
version: 1.0.0
---

# jCodeMunch Savings

Read and display token savings only — no repo inventory.

## Steps

1. **Read savings file:** Run `cat ~/.code-index/_savings.json 2>/dev/null || echo "NOT_FOUND"` via Bash
   - If output is `NOT_FOUND`, note that no symbol retrievals have been made yet

2. **Display:**

The bracket column is the greedy number × 0.5, formatted with a `~` prefix. Align both columns.

```
### Token Savings (cumulative)
- Tokens saved:            1,002,879  [~501,440]
- Cost avoided (Opus 4.6): $15.04    [~$7.52]
- Cost avoided (GPT-5.2):  $10.03    [~$5.01]
```

## Notes

- The bracket figure [~X] = greedy × 0.5 (accounts for file-reuse in real workflows)
- Pricing: Claude Opus 4.6 $15.00/1M input tokens, GPT-5.2 $10.00/1M input tokens
