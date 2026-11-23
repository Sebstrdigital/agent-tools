# Shared skills

The first shared batch lives under `productivity/<name>/`:

- `brand-voice`, `component`, `page`, `prd`, `product-context`, `refine`, `ui`, `ux-audit`, `ux-copy`: promoted from the preserved Claude source. Only invocation and argument wording were adapted.
- `grill-me`, `zoom-out`: promoted unchanged from the preserved Pi source.

The `mobile-ui` skill routes mobile interface work to stack-specific references. Its first reference covers React Native and Expo; native iOS and Android references can be added as needed. This is separate from `ui`, the existing HTML/CSS Swiss-design generator.

Original platform copies remain intact. Installers still use those copies; promotion does not activate or install the shared versions.

Claude command examples use `/<name>`; Pi uses `/skill:<name>`. Actual discovery and invocation depend on each harness configuration.

### OMP work profile: mobile UI

OMP discovers skills one directory below its skill root; it does not recursively scan `skills/productivity/`. To install this skill from a local checkout without copying it, link the entire skill directory into the work profile (replace the checkout path):

```sh
mkdir -p "$HOME/.omp/profiles/work/agent/skills"
ln -s "/absolute/path/to/agent-tools/skills/productivity/mobile-ui" "$HOME/.omp/profiles/work/agent/skills/mobile-ui"
```

Do not overwrite an existing skill. Keep the checkout in place: the link includes the reference and follows updates to the checkout. Start a fresh `omp --profile=work` session in the target project, then run `omp --profile=work skill list --json` from that project to check discovery. Subagents inherit the parent session's discovered skills; loading and applying a skill remain task-dependent. The frontend agent definition must also be installed in the work profile. This manual link is not a cross-platform installer or a registry package.

The nine Claude-derived files retain `source_id` and `version` metadata. Their existing MIT notice is preserved in `productivity/LICENSE`. This copy does not establish a new license for Pi-derived files or other repository content. Retain upstream attribution and resolve any additional licensing requirements before wider distribution.

Supporting resources belong beside their owning skill. There are no bundled scripts or assets in this first batch.
