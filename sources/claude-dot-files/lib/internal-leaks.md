# Internal Leaks — Reference Rules

Items that must NEVER appear in client-facing documents. Used by `/client-proposal` during leak review.

## Always Flag

| Category | Examples | Action |
|----------|----------|--------|
| **Internal hours** | Exact hours spent, time tracking data, "took 4 hours" | Remove or convert to ranges |
| **Cost/margin data** | Internal hourly rates, cost calculations, profit margins | Remove entirely |
| **Team member names** | Individual names, "Johan will...", "Seb handled..." | Replace with "our team" or role titles |
| **Internal tool references** | Linear, Slack channel names, internal dashboards, Grafana URLs | Remove or genericize ("our project tracker") |
| **Internal repo/project names** | Repo slugs, branch names, internal codenames | Remove or use client-facing project name |
| **Internal discussions** | "We discussed internally...", meeting notes, decision logs | Rephrase as confident recommendations |
| **Subcontractor details** | Third-party costs, vendor names, outsourcing arrangements | Remove entirely |
| **AI tooling details** | "Generated with Claude", AI-assisted workflows, prompt details | Remove unless client is aware and approves |

## Contextually Safe (but verify)

- Tech stack names (React, Python, etc.) — usually fine, but check if client expects stack-agnostic language
- Timeline estimates — fine as ranges, never as internal commitments
- Feature names — use client's terminology, not internal naming

## When Unsure

Flag it. Present to user with `[REVIEW NEEDED]` tag. False positives cost nothing; a leaked internal rate or margin calculation can damage the client relationship.
