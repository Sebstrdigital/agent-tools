# Architecture concepts

Use the following concepts to explain candidates; retain the project's own domain vocabulary.

- **Module:** a function, class, package, or slice with an interface and implementation.
- **Interface:** what callers need to know, including types, invariants, configuration, ordering, errors, and relevant performance constraints.
- **Depth:** behavior and capability provided relative to interface complexity. A deep module gives callers leverage; a shallow one exposes much of its internal complexity.
- **Seam:** a place where behavior can change without editing the caller; an adapter supplies behavior at a seam.
- **Locality:** concentrating related knowledge, changes, and verification rather than spreading them through callers.

## Judgment aids

**Deletion test:** imagine removing a module. If complexity disappears, it may be a pass-through. If complexity reappears in multiple callers, the module was doing useful work. This is a thought experiment, not permission to delete it.

The interface is often a valuable test surface: tests there can cover interactions and survive implementation changes. Internal tests may still cover important cases, fault paths, or constraints. Assess coverage before recommending replacement.

Consider dependencies when evaluating a seam: in-process computation, locally substitutable dependencies, owned remote services, and third-party services have different failure modes and verification options. Ports, adapters, test doubles, and local substitutes are tools, not automatic requirements. A single adapter can signal a hypothetical abstraction, but legitimate needs such as isolation or stability may still justify a seam; demonstrate its value.

Prefer a clear, cohesive interface over arbitrary file splitting. Avoid exposing internal seams just to satisfy tests. Include operational and compatibility risks when they affect the design.
