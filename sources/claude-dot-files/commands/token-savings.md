---
name: token-savings
description: "Combined token savings dashboard — jCodeMunch (cumulative), context-mode (current session + logged history), caveman (estimated). Triggers on: token savings, savings dashboard, /token-savings."
version: 1.0.0
---

# Token Savings Dashboard

Combined view of all active token-optimization tools. Goal: validate over weeks whether the jcm + ctx + caveman stack is actually paying off.

## Steps

1. **jCodeMunch lifetime** — Bash: `cat ~/.code-index/_savings.json 2>/dev/null || echo "NOT_FOUND"`. Parse `total_tokens_saved`. Compute Opus 4.6 cost: `tokens / 1_000_000 * 15`. Compute GPT-5.2 cost: `tokens / 1_000_000 * 10`.

2. **context-mode current session** — Call `mcp__plugin_context-mode_context-mode__ctx_stats`. Capture the full markdown table returned.

3. **Historical log** — Read `~/.context-mode/token-log.jsonl` via Read tool. If missing, treat as empty.

4. **Persist current ctx snapshot** (so past-session ctx data gets captured over time) — Bash: append a `ctx_snapshot` line with the tokens_saved value extracted from step 2:
   ```
   echo '{"type":"ctx_snapshot","ts":"<iso now>","tokens_saved":<n>}' >> ~/.context-mode/token-log.jsonl
   ```
   Skip if ctx_stats returned zero data.

5. **In-context aggregation** of the log:
   - Filter `type == "turn_snapshot"`
   - Group by `session_id`, take entry with latest `ts` per session
   - Sum: `cum_input`, `cum_output`, `cum_cache_read`, `cum_cache_create`
   - Build session history rows (last ~20, newest first)
   - Filter `type == "ctx_snapshot"`, sum `tokens_saved` → historical ctx savings
   - caveman estimate = `cum_output * 3` (assumes /caveman full = 75% reduction vs prose)

6. **Display dashboard** in this exact format:

    ## Token Savings Dashboard

    ### jCodeMunch — cumulative (input / code navigation)
    - Tokens saved:            {n}  [~{n/2}]
    - Cost avoided (Opus 4.6): ${x}  [~${x/2}]
    - Cost avoided (GPT-5.2):  ${y}  [~${y/2}]
    - Tracking since:          2026-03-06

    ### context-mode — input / tool output
    **Current session (live):**
    [paste full ctx_stats table from step 2, do not summarize]

    **Historical (logged snapshots):** ~{n} tokens saved across {count} snapshots
    _Note: only captured when /token-savings was run. Past sessions where dashboard was never invoked are lost._

    ### caveman — output / assistant text (ESTIMATE ONLY)
    Assumption: /caveman full → 75% output reduction vs prose baseline.
    - Output tokens logged:    {cum_output}
    - Estimated savings:       ~{cum_output * 3}
    _No direct measurement possible. Inflated when /prose override was used._

    ### Session history ({N} sessions)
    | Date       | Project  | Input    | Output   | Cache read | Caveman est. |
    |------------|----------|---------:|---------:|-----------:|-------------:|
    | 2026-04-11 | uven     |  15,420  |   3,840  |    98,200  |      ~11,520 |
    | ...        | ...      |     ... |      ... |       ... |          ... |

    **Totals:** {cum_input} in / {cum_output} out / {cum_cache_read} cache read

    ### Takeaway
    One-line: which tool dominates, rough percent savings vs tokens used.

## Notes

- Bracket figure `[~X]` = `X/2` (conservative reuse-aware estimate, matches jcm-stats convention).
- Do NOT paraphrase the ctx_stats table — paste it whole.
- Caveman line is advisory, never measured — say so explicitly.
- If the log has only `ctx_snapshot` entries and no `turn_snapshot`, the Stop hook isn't firing yet. Tell the user to restart Claude Code.
- Dashboard runs are idempotent — running twice in a row just adds one more ctx_snapshot line, no other side effects.
