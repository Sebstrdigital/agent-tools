---
name: improve-codebase-architecture
description: Find evidence-backed opportunities to improve codebase architecture, testability, and AI navigability. Use when asked to review architecture, find refactoring opportunities, reduce coupling, or improve change locality; do not use for a routine bug fix or feature request alone.
license: See LICENSE
---

# Improve Codebase Architecture

Identify architectural friction and propose bounded improvements, especially deepening modules: hiding substantial behavior behind a comprehensible interface to improve locality and leverage. This is a review and design workflow, not permission to refactor.

## Explore

Start with the user's area or concern. If none is given, inspect the project and, where useful, recent Git history to identify likely change hotspots; widen only as needed. Read relevant project instructions, domain language and architecture decisions if they exist. Do not require or create a particular glossary or ADR structure.

Trace representative behavior or a plausible change through the code and tests. Look for:

- One concept requiring navigation across many modules, or changes scattered across callers.
- Shallow modules whose interfaces expose nearly as much complexity as their implementations; apply the deletion test.
- Leaky seams, tightly coupled responsibilities, or tests that miss how extracted pieces interact.
- Behavior that is difficult to verify through a useful interface.

Consult [architecture concepts](references/architecture-concepts.md) for the vocabulary, deletion test, dependency and testing considerations. Use the project's own domain terms where available. Inspect code evidence; file size, file count and Git co-change alone do not prove poor architecture. A modular monolith may be appropriate. Consider whether naming, documentation, tests, or navigation would solve the problem more cheaply than restructuring. If no worthwhile candidate is supported, say so.

Use available read-only discovery or delegation when proportionate and authorized; do not assume a particular subagent, tool, or extension exists. Stay within the user's access and scope boundaries.

## Present candidates

Provide a numbered, prioritized list. For each candidate give:

- **Evidence:** relevant files and concrete coupling or navigation friction, distinguishing observations from hypotheses.
- **Problem and proposed direction:** what makes changes or verification difficult and the smallest plausible improvement. Do not design interfaces yet.
- **Expected benefit and trade-offs:** locality, leverage, testability and agent navigation, including risk, compatibility and migration implications where relevant.
- **Verification and confidence:** how to check behavior and whether the candidate is strong, exploratory, or speculative.

Respect existing architecture decisions; flag a conflict only when the observed friction warrants reconsidering it. Ask which candidate the user wants to explore. Reviewing or discussing a candidate does not authorize code, documentation, ADR, or test changes.

## Explore the chosen design

Discuss constraints, dependency categories, what belongs behind the seam, interface invariants, error modes, and tests. Compare plausible alternatives when useful, without requiring multiple agents or arbitrary ceremonies. Recommend a design and explain trade-offs. Use [interface design](references/interface-design.md) when comparing interfaces in detail.

Offer to record a durable domain decision or ADR only when useful; don't create or edit project documents without an authorized request. Implementation is separate: agree a bounded change, preserve behavior and compatibility as appropriate, and verify the actual result. Do not delete tests merely because an interface-level test exists; assess coverage and remove or replace tests only under implementation authority.

## Provenance

Adapted for Pi from Matt Pocock's `improve-codebase-architecture` skill; see [provenance](PROVENANCE.md) and the bundled MIT license.
