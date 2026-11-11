# Pi Cyber

Start a dedicated cybersecurity session from the project you want to inspect:

```sh
pi-cyber
pi-cyber "Review this repository for authentication and authorization weaknesses"
pi-cyber --continue
pi-cyber --print "Threat-model this application; do not run active tests"
```

The launcher (`scripts/pi-cyber.mjs`) appends `agent/cybersecurity.md` to Pi's system instructions and defaults explicitly to provider `omlx`, model `Huihui-Qwen3.6-35B-A3B-abliterated-mlx-4bit`. This exact model ID was accepted by the local API even though its model listing exposes aliases. Existing `local`, `fast`, `think` and original-model settings remain untouched.

## Local installation

Requires Node and Pi on PATH, oMLX running at `http://127.0.0.1:8000/v1`, and the model downloaded. The personal installation adds an `omlx` provider in `~/.pi/agent/models.json`, reading authentication at request time using `!cat "$HOME/.omlx/api-key"`. The key is not stored in this repository. Do not run credential-printing commands when collecting logs.

`~/.local/bin/pi-cyber` is a symlink to this checkout's executable launcher; `~/.local/bin` must be on PATH. Moving the checkout breaks that link. No changes to shell startup files are needed on the current machine.

Pi's global default model is not changed. Arguments are forwarded unchanged, so an explicit CLI model override is possible. The launcher defaults to this model; it is not a model lock or an automatic failover router. If oMLX is unavailable, requests fail rather than switching to a cloud provider.

## Behavior and boundaries

- Security reviews, threat modeling, authorized pentesting, lab work, remediation and evidence-backed reports.
- Clarifies missing target authorization/scope before active tests. Does not invent permission or scan results.
- Starts with extensions and MCP disabled for this invocation. This avoids loading the usual cloud-backed worker tools and unrelated integrations; standard Pi tools, skills and applicable project instructions remain.
- `--offline` disables Pi's automatic network activity; it does **not** prohibit network calls by tools or block an explicitly selected remote model.
- No cloud delegation, external inference or uploads without an explicit request.
- Uses normal Pi session storage and project grouping. `--continue` can therefore resume a normal Pi session in the same project.
- This is a prompt profile, **not an OS sandbox or enforced pentesting authorization layer**. Commands run with your user permissions. Use an isolated lab for active work.

## Checks

```sh
node --test tests/pi-cyber.test.mjs
pi-cyber --help
```

For an isolated model smoke test, disable skills/context and session persistence as well, and ask for a harmless reply. Do not use a scan as an installation test. The initial installation tested direct local inference plus Pi's streaming/tool-call round trip, without target scans.

To uninstall the launcher, remove only `~/.local/bin/pi-cyber`. The provider can remain for other Pi uses, or remove only its `omlx` entry if unused. Nothing changes or removes downloaded models.
