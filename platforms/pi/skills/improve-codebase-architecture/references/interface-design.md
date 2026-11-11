# Compare interface designs

Use after the user selects a candidate and wants to explore interface alternatives.

1. Frame the problem: callers, relevant code, domain concepts, constraints, dependencies and behavior that must remain observable. A small illustrative sketch may clarify the constraints without prejudging a solution.
2. Develop meaningfully different options when warranted, such as a minimal interface, a flexible interface, or one optimized for the common caller. Use independent read-only assistance only if available, authorized and proportionate; otherwise compare directly.
3. For each option explain its interface and invariants, usage, hidden behavior, dependency strategy, errors and test approach. Compare depth, locality, seam placement, migration risk and compatibility.
4. Recommend an option or a deliberate hybrid. Discuss the trade-offs with the user; exploration alone does not authorize implementation or documentation changes.
