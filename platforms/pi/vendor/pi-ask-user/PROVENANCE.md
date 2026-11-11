# pi-ask-user — pinned tool-only input

Origin: https://github.com/edlsh/pi-ask-user
Revision: `e8b59a5114bb1cf4fca239b75976483703c9783f`.
Manifest version: `0.16.0`. MIT © 2026 Enzo Lucchesi; LICENSE retained unchanged.

`UPSTREAM.json` records the five byte-identical upstream files: runtime,
layout helper, package metadata, README and license. The original package.json
is needed by the runtime's version lookup. Its Pi resource manifest is historical
upstream metadata, **not** a registration of this directory as a Pi package.
Git pin/file hashes identify fetched source, not signed authorship or equality
to an npm release. No runtime dependencies, peer copies, upstream development
packages, lifecycle scripts, demo media, or tests are installed from this tree.

The upstream mandatory-decision `skills/ask-user/` tree is deliberately omitted.
Never install/register the vendor entry point or directory directly. The optional
supported resource is `extensions/ask-user/`, linked with `--with-ask-user`.
Default toolkit installation and existing transports/resources remain unchanged.

The toolkit adapter resolves the physical source behind installed symlinks,
checks same-name tool collisions at session startup, and registers one model-only,
sequential tool. It retains upstream UI/rendering, replaces broad question-use
prompt guidance with scoped PACE-compatible guidance, validates requests and
returned selections/freeform/batch/cancellation data, and publishes outcome events
only after validation. All outcome broadcasts are redacted regardless of the
upstream full-event environment preference; question text is still broadcast.
Block/unblock events are forwarded immediately and released by upstream finally
blocks. No permissions are inferred, saved grants changed, or action executed
from an answer. This is trusted extension code, not an OS sandbox or approval broker.

Known upstream UX: Space toggles checkbox choices; Enter submits, and Enter with
no checked boxes submits the focused option. RPC multi-select fallback parses
comma-separated text; unlisted/ambiguous selections are rejected by the adapter,
not treated as approval. Real freeform answers remain explicit freeform text.

The pinned source was independently inspected and exercised with Pi 1.1.0 /
Node 25.9.0 native-loader/TUI/codemode fixtures. Repository tests cover this
adapter, fake-HOME installation, exclusion of the upstream skill, pinned hashes
and negative outcomes. These are fixture checks, not live model compliance,
physical-terminal visual qualification, or certification of arbitrary Pi versions.
Upstream's full Bun development suite was not run; it is not a hidden pass.
