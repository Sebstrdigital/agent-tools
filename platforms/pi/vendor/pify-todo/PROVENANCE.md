# @pify/todo 0.3.0 — reviewed lossless vendor

Origin: https://registry.npmjs.org/@pify/todo/-/todo-0.3.0.tgz
Repository: https://github.com/pifydev/todo (reference only, not the source pin).
Registry integrity: `sha512-jJebm31P/iP1ieZ+AxFNd82uiD7R3yJE5LMBd89nXYLB4OR43WjZ428NtdADSZa6OY0WabcavCYHE1YQ4O0pZw==`.
MIT © 2026 pifydev; full license retained in LICENSE.

All eight shipped files were source-reviewed and copied byte-for-byte from the
integrity-verified registry artifact. INTEGRITY.json records their SHA-256s.
No runtime dependencies, install/postinstall scripts, filesystem/network access,
child launches or timers; optional peers are supplied by the installed Pi host.
Do not install peer copies, run package scripts, or replace this with GitHub main.
Vendoring makes source reproduction offline and independent of execution artifacts.
The extra storage is the deliberate trade-off for an exact reproducible pin.

Toolkit integration lives outside this unchanged source, in
extensions/lean-progress/index.ts. It captures native registrations, checks known
collisions at session_start (not unbound factory action APIs), activates once and
replays startup once. It replaces model-facing description and rejects
multiple active writes. The toolkit presentation adapter in
extensions/lean-progress/widget.ts hides fully completed lists and substitutes
a responsive, display-column-aligned widget with up to three wrapped lines per
item. Native state, commands and restoration logic are unchanged; the eight
integrity-checked upstream files, including their original renderer, remain
byte-for-byte pinned. Only this shim is installed; upstream package resource
registration is NOT installed. Its bundled scratchpad skill is filtered out
(equivalent to `skills: []`); no suite or second controller is loaded.

Snapshots are branch-local view cache, NOT Team authority. Native limitations:
30 rows, invalid entries dropped/defaulted with warnings, full-list replacement,
10-row active-centered window. Upstream's fixed box and 44 UTF-16-unit truncation
remain in the pinned source but are replaced at the toolkit UI boundary by the
responsive projection described above. Use /todos for full retained labels/reasons. Startup/tree
replays the current full branch; compaction and summarized tree navigation trigger
one hidden restore message on the next turn. Reload after compaction restores
widget snapshots but does not recreate the transient reinjection flag; reconcile
from the Plan manually before updating. An unsummarized branch can retain a prior
transient compaction flag until the next turn; it restores the CURRENT branch
list, never an abandoned one. These are supported limits, not automatic Plan
parsing or acceptance enforcement. Runtime collision checks cover named tools and
/todos; arbitrary extensions can still claim the same invisible widget/state key.
Review enabled resources, including project resources, before live use.
