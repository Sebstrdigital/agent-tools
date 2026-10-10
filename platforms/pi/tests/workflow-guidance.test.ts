import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { test } from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const text = (path: string) => readFile(resolve(root, path), "utf8");
const roles = ["builder", "validator", "reviewer"];
const contextPaths = ["skills/delivery/SKILL.md", "skills/discovery/SKILL.md",
  "skills/delivery/references/delegation.md", "skills/delivery/references/authority-and-state.md",
  "agents/builder.md", "agents/reviewer.md", ...roles.map(role => `vendor/pi-interactive-subagents/agents/${role}.md`)];

// Structural regressions only: neither wording nor size proves useful model behavior.
test("B3 guidance preserves original authority and source-only escalation limits", async () => {
  const source = await text("docs/workflows/scout-role-routing.md");
  for (const rule of [/assignment:/, /escalation:/, /partialSources:/, /remainingEffortMinutes:/,
    /remainingRepairAttempts:/, /resourceEvidenceRef:/, /before allocation/, /including abandoned branches/,
    /No retrofitted legacy grant/, /not.*cumulative/, /No timeout inflation/,
    /Red tests normally trigger/, /Fresh Team validation\/review remain required/]) assert.match(source, rule);
});

test("canonical runtime guidance preserves separate Scout admission and role limits", async () => {
  const source = await text("docs/lean-workflows.md");
  for (const rule of [/without Developer or Team selection/, /discoveryAuthorityRef/, /focused.*question/,
    /locally accessible.*sources/, /cited.*resultContract/, /not authentication of consent/,
    /read\/grep\/find\/ls\/codemode\/ask_question/,
    /no shell, mutation, process control, external web research, nesting or acceptance/,
    /same reserved\/active slot/, /including waits and pauses/, /Team only, never Scout authority/,
    /Developer remains builder only/, /not installed readiness/]) assert.match(source, rule);
  const profile = await text("vendor/pi-interactive-subagents/agents/scout.md");
  assert.match(profile, /delivery-role: scout\ntools: read,grep,find,ls,codemode\n/);
  assert.match(profile, /not authentication of consent/);
  assert.match(profile, /No shell, edit, write, process control, external web research, nesting/);
  assert.match(profile, /no mandatory reading manifests/i);
  assert.match(profile, /lead alone integrates and accepts/i);
});

test("configured role defaults and saved pins stay in runtime reference, not every packet", async () => {
  const source = await text("docs/lean-workflows.md");
  for (const rule of [/Scripts first for deterministic extraction\/counting/, /taskKind: "lookup"/,
    /unbenchmarked candidate profiles/, /before any slot, sidecar or pane allocation/,
    /without silent clamp or parent substitution/, /restricted to Terra\/medium or Sol\/medium\/high/,
    /Saved sessions replay pinned old model\/effort unchanged/,
    /Scout uses openai\/gpt-5\.6-terra\/low/, /builder uses openai\/gpt-5\.6-sol\/medium/,
    /validator uses openai\/gpt-5\.6-terra\/low/]) assert.match(source, rule);
  const packet = await text("skills/delivery/references/templates/task.md");
  assert.match(packet, /Configured Team defaults apply/);
  assert.doesNotMatch(packet, /openai\/|gpt-/);
});

test("Developer retains actual dedicated invocation and approval provenance", async () => {
  const guide = await text("docs/lean-workflows.md");
  for (const rule of [/developer\(\{/, /selection: "Developer"/, /approvalRef:/, /packetRef:/,
    /purpose:/, /scope:/, /allowedPaths:/, /projectRules:/, /baseline:/, /validation:/, /acceptance:/, /task:/,
    /No full Brief\/Plan\/Agreement set is mandatory/, /not authentication of actual user consent/,
    /parent must verify the actual selection\/approval/, /cannot launch validator\/reviewer/,
    /Builder role defaults apply when omitted/, /original.*approvalRef.*packetRef/,
    /legacy Team only/, /unknown\/malformed provenance/, /failed owned cleanup is retryable/,
    /fixed 20-minute timeout/, /parent alone inspects/, /fake transport tests are protocol evidence only/]) assert.match(guide, rule);
  assert.match(guide, /install\.sh --with-delivery-tmux/);
  assert.match(guide, /tmux and a persistent parent session/);
});

test("global policy is thin, outcome-led and defaults to minimal records", async () => {
  const policy = await text("agent/AGENTS.md");
  for (const preserved of ["Propose changes; wait for explicit approval before applying them.",
    "Trace claims to inspected evidence; do not guess.",
    "Ask before delete, force, push, publish, or other destructive/outward actions",
    "Project rules belong in the repo's own AGENTS.md.",
    'munin recall "<query>" -p <project>', 'munin remember "<summary>" -p <project>',
    "Omit secrets.", "use full prose for code, commits, and documents for others."]) assert.ok(policy.includes(preserved), preserved);
  assert.ok(Buffer.byteLength(policy) < 2400, "global policy must remain thin");
  for (const rule of [/useful for real development/, /consequential gaps/, /cheaper alternatives/,
    /user explicitly selects/, /Direct needs no mandatory files/, /compact approved packet/,
    /one compact task record/, /not three mandatory files/, /consequence and reversibility/,
    /Prefer native codemode/, /serialize dependent edits/, /not every tool call/,
    /worker completion is not acceptance/]) assert.match(policy, rule);
});

test("discovery is proportionate and does not manufacture another planning suite", async () => {
  assert.deepEqual(await readdir(resolve(root, "skills/discovery")), ["SKILL.md"]);
  const skill = await text("skills/discovery/SKILL.md");
  assert.match(skill, /^---\nname: discovery\ndescription: .+\n---/);
  for (const rule of [/not a new questionnaire/, /consequential question/, /comparator/,
    /sufficient-evidence criteria/, /budget/, /cheaper safe alternative/, /failed or inconclusive/,
    /Park unrelated improvements/, /Do not automatically select Team/, /actual Agreement section/,
    /one compact task record/, /not three mandatory files/, /not create a planning suite/]) assert.match(skill, rule);
  await assert.rejects(stat(resolve(root, "skills/team")), { code: "ENOENT" });
});

test("Team uses one approved record while retaining independent execution gates", async () => {
  const skill = await text("skills/delivery/SKILL.md");
  assert.match(skill, /^---\nname: delivery\n/);
  for (const rule of [/Selection of Team authorizes preparation/, /3–5 sentence task/,
    /one compact task record/, /actual Agreement before launching/, /not three mandatory files/,
    /without per-edit approval/, /short dated note/, /fresh sequential builder -> no-edit validator -> inspection-only reviewer/,
    /lead.*explicitly accepts/i, /three focused repair cycles/, /No nesting, parallel workers or grant widening/,
    /does not need a separate three-role cycle/, /no-progress|no progress/]) assert.match(skill, rule);
  for (const path of ["references/delegation.md", "references/authority-and-state.md",
    "references/templates/task.md", "references/templates/brief.md", "references/templates/plan.md",
    "references/templates/agreement.md"]) await stat(resolve(root, "skills/delivery", path));
  assert.ok(Buffer.byteLength(skill) < 4500, "Team entry point must stay compact");
});

test("minimal templates permit existing JSON and do not restate workflow policy", async () => {
  const task = await text("skills/delivery/references/templates/task.md");
  assert.match(task, /3–5 sentences/);
  assert.match(task, /## Agreement/);
  assert.match(task, /explicit approval/);
  assert.match(task, /## Plan \/ progress/);
  assert.ok(Buffer.byteLength(task) < 1000, "default record is an issue, not a mini-project");
  const plan = await text("skills/delivery/references/templates/plan.md");
  const agreement = await text("skills/delivery/references/templates/agreement.md");
  assert.match(plan, /existing JSON/);
  assert.match(plan, /separate file is not mandatory/);
  assert.match(agreement, /no separate file or snapshot directory required/);
  assert.match(agreement, /No default commit\/install\/destructive cleanup\/push\/PR\/publish authority/);
  assert.match(agreement, /short dated note/);
  assert.doesNotMatch(task, /reading manifest|read receipt|sha256|snapshot|minute pool/i);
});

test("worker context is relevant and on demand, not a mandatory reading-proof gate", async () => {
  for (const path of contextPaths) {
    const source = await text(path);
    assert.match(source, /purpose|outcome/, path);
    assert.match(source, /constraints|scope/, path);
    assert.match(source, /acceptance/, path);
    assert.match(source, /[Nn]o mandatory reading manifests/, path);
    assert.doesNotMatch(source, /Use a task-specific reading manifest listing|manifest entry alone is not proof|readers and read evidence|demonstrably read in the same owned session/, path);
  }
  const skill = await text("skills/delivery/SKILL.md");
  assert.match(skill, /Excerpts must not omit governing constraints/);
  assert.match(skill, /Keep logs on disk/);
  assert.match(skill, /Reuse unchanged context/);
});

test("fixed role frontmatter and tools remain pinned", async () => {
  for (const [role, tools, description] of [
    ["builder", "read,grep,find,ls,bash,edit,write,codemode", "Implement the coordinator-approved delivery packet."],
    ["validator", "read,grep,find,ls,bash,codemode", "Validate the coordinator-approved delivery changes without editing."],
    ["reviewer", "read,grep,find,ls,codemode", "Independently inspect delivery changes and evidence without mutation or shell."]]) {
    const profile = await text(`vendor/pi-interactive-subagents/agents/${role}.md`);
    const header = `---\nname: ${role}\ndescription: ${description}\ndelivery-role: ${role}\ntools: ${tools}\nsystem-prompt: append\nauto-exit: true\ninteractive: false\nsession-mode: standalone\n---\n`;
    assert.ok(profile.startsWith(header), `${role} fixed metadata changed`);
    assert.match(profile, /Prefer native codemode/);
    assert.match(profile, /truncation notices/);
    assert.match(profile, /coordinator acceptance/);
  }
});

test("ordinary checks trigger repair rather than unnecessary customer stops", async () => {
  for (const path of ["agent/AGENTS.md", "docs/lean-workflows.md", "README.md",
    "skills/delivery/references/delegation.md", "skills/delivery/references/authority-and-state.md"]) {
    const source = await text(path);
    assert.match(source, /implement -> diagnose -> in-scope repair -> revalidate\/review -> next approved task/, path);
    assert.match(source, /[Rr]ed task-owned checks?.*(?:trigger|bounded repair)/, path);
  }
  for (const path of ["agents/builder.md", "vendor/pi-interactive-subagents/agents/builder.md"]) {
    const source = await text(path);
    assert.match(source, /ordinary technical uncertainty/);
    assert.match(source, /bounded in-scope repair/);
    assert.match(source, /not automatic customer escalation/);
    assert.match(source, /do not weaken tests/i);
  }
  for (const role of ["validator", "reviewer"]) {
    const profile = await text(`vendor/pi-interactive-subagents/agents/${role}.md`);
    assert.match(profile, /Report repairable failures\/findings to the lead/);
    assert.match(profile, /do not attempt source fixes or widen role grants/);
    assert.match(profile, /renewed on the final candidate/);
  }
});

test("validation leaves unrelated live applications usable and reports gaps", async () => {
  for (const path of ["agent/AGENTS.md", "skills/delivery/SKILL.md", "docs/lean-workflows.md"]) {
    const source = await text(path);
    assert.match(source, /Do not require unrelated applications to close/, path);
    assert.match(source, /[Ii]solate live-side-effect tests/, path);
    assert.match(source, /[Aa]sk before stopping the application under development/, path);
    assert.match(source, /approval.*required checks|required-check changes need approval|required checks change/, path);
  }
  const guide = await text("docs/lean-workflows.md");
  assert.match(guide, /Missing or excluded checks are not passes/);
});

test("repair policy bounds fresh diagnosis-led escalation without resetting authority", async () => {
  for (const path of ["skills/delivery/SKILL.md", "docs/lean-workflows.md",
    "skills/delivery/references/delegation.md", "skills/delivery/references/authority-and-state.md"]) {
    const source = await text(path);
    assert.match(source, /three focused repair cycles/, path);
    assert.match(source, /same defect survives two cycles/, path);
    assert.match(source, /fresh stronger same-role builder context/, path);
    assert.match(source, /diagnos/i, path);
    assert.doesNotMatch(source, /two focused fix cycles/, path);
  }
  const guide = await text("docs/lean-workflows.md");
  for (const rule of [/not each edit\/compiler correction/, /before editing/,
    /reserve the third cycle for this replacement, not an additional attempt/,
    /Environment failures or missing permission are not model-escalation reasons/,
    /initial binding is missing/, /Existing approvals|existing approvals/,
    /Fresh Team validation\/review remain required/]) assert.match(guide, rule);
  for (const path of ["skills/delivery/references/templates/agreement.md",
    "skills/delivery/references/templates/plan.md"]) {
    assert.match(await text(path), /three.*repair cycles unless stricter/);
  }
});

test("sensitive validation verifies effective isolation before tests and baseline before edits", async () => {
  for (const path of ["skills/delivery/SKILL.md", "docs/lean-workflows.md"]) {
    const source = await text(path);
    for (const rule of [/before sensitive tests run/i, /effective execution boundary/,
      /If isolation is unverified or fails, fix the validation setup before proceeding/,
      /required valid baseline before edits/, /corrective evidence, not retroactive compliance/,
      /targeted preflight, not a reading manifest/, /global application inventory/]) {
      assert.match(source, rule, path);
    }
  }
  const guide = await text("docs/lean-workflows.md");
  assert.match(guide, /For Direct, Developer and Team/);
  assert.match(guide, /invoking shell alone is not proof/);
  assert.match(guide, /do not launch the sensitive suite to discover whether isolation worked/);
  assert.match(guide, /report any breach separately from the final product-check result/);
});

test("task state stays recoverable without a second scheduler or giant ledger", async () => {
  const state = await text("skills/delivery/references/authority-and-state.md");
  const plan = await text("skills/delivery/references/templates/plan.md");
  for (const value of ["pending", "active", "blocked", "paused", "cancelled", "abandoned", "accepted"]) {
    assert.ok(state.includes(`**${value}:**`), value);
    assert.ok(plan.includes(value), value);
  }
  for (const rule of [/lead alone updates acceptance/, /same revision/, /short dated note/,
    /maps accepted to completed \*\*only\*\*/, /\[blocked\]/, /\[paused\]/,
    /\[cancelled\]/, /\[abandoned\]/, /Filter its bundled scratchpad skill/,
    /no invented percentages/, /No prompt or static test guarantees universal/]) assert.match(state, rule);
  assert.ok(Buffer.byteLength(state) < 4000);
});

test("planned slices have fresh builders, accepted dependencies and no implicit parallel authority", async () => {
  for (const path of ["skills/delivery/SKILL.md", "docs/lean-workflows.md",
    "skills/delivery/references/delegation.md", "skills/delivery/references/authority-and-state.md"]) {
    const source = await text(path);
    for (const rule of [/vertical slices|slice IDs\/outcomes/, /dependencies|depends-on/,
      /ownership/, /parallel eligibility/i, /fresh builder run/,
      /prerequisite acceptance|prerequisites are lead-accepted/,
      /metadata, not (?:launch permission|launch authority|permission|authority)/,
      /sequential/, /final integrated validation\/review/]) assert.match(source, rule, path);
  }
  const delegation = await text("skills/delivery/references/delegation.md");
  for (const rule of [/never bundle slices/, /never.*resume a previous slice's builder/,
    /Material qualification findings must be resolved before dependent migration edits/,
    /Repairs stay attached to the originating slice/, /does not reset task-level or declared runtime limits/,
    /slicing alone grants no extra cycles/]) assert.match(delegation, rule);
  for (const path of ["skills/delivery/references/templates/task.md", "skills/delivery/references/templates/plan.md"]) {
    const source = await text(path);
    for (const rule of [/ID \/.*outcome/, /Depends on/, /Ownership/, /Parallel eligibility/,
      /prerequisite acceptance|Prerequisites must be lead-accepted/, /fresh builder per slice/,
      /sequential/, /integrated/, /slicing grants no extra cycles/, /existing JSON/]) assert.match(source, rule, path);
  }
});

test("lead context admission is bounded without substituting summaries for complete review", async () => {
  for (const path of ["skills/delivery/SKILL.md", "docs/lean-workflows.md",
    "skills/delivery/references/delegation.md", "skills/delivery/references/authority-and-state.md"]) {
    const source = await text(path);
    for (const rule of [/canonical/i, /decisions/, /blockers/, /evidence pointers/,
      /[Cc]odemode must filter|codemode; do not merely batch raw reads/,
      /question-driven|concrete question/, /bounded sections/,
      /summaries do not replace (?:actual change inspection|review)/,
      /not (?:worker )?transcripts|not prior worker transcripts/]) assert.match(source, rule, path);
  }
  const delegation = await text("skills/delivery/references/delegation.md");
  assert.match(delegation, /changed paths\/candidate, actual checks\/results, gaps, decisions\/blockers/);
  assert.match(delegation, /allowance consumed\/remaining/);
  const guide = await text("docs/lean-workflows.md");
  assert.match(guide, /Truncation is not complete evidence/);
  assert.match(guide, /complete task-owned diff including added files/);
  assert.match(guide, /not all session history/);
  assert.match(guide, /not new runtime enforcement, automatic summarization or a second scheduler/);
});

test("budget guidance avoids fictional accounting without weakening runtime limits", async () => {
  const skill = await text("skills/delivery/SKILL.md");
  assert.match(skill, /not invented active-minute accounting or per-role pools/);
  assert.match(skill, /Fixed timeouts and optional declared assignment\/escalation limits remain binding/);
  assert.match(skill, /no automatic resets\/replacements/);
  const guide = await text("docs/lean-workflows.md");
  assert.match(guide, /Report observed elapsed time/);
  assert.match(guide, /not imagined active effort/);
  assert.match(guide, /Tool-enforced optional assignment\/escalation limits remain binding/);
});

test("Munin handoffs distinguish relevant search from exact-ID recovery", async () => {
  for (const path of ["agent/AGENTS.md", "skills/delivery/references/authority-and-state.md"]) {
    const source = await text(path);
    assert.match(source, /Recall ranks relevance, not recency/);
    assert.match(source, /munin show <id>/);
  }
});

test("docs retain compatibility links and explicitly park unneeded expansion", async () => {
  const guide = await text("docs/lean-workflows.md");
  for (const rule of [/Direct/, /Developer/, /Team/, /not an OS sandbox/, /not universal/,
    /capability\/product specifications/, /JSON task state/, /dependency scheduling/,
    /transcript renderers/, /worker telemetry/, /revision pinning/, /budget checkpoints/,
    /discovery\/experiment agents/, /model routing/, /parallel execution/,
    /project-rule migrations/, /stack-specific validation/, /rollback and upgrade diagnostics/,
    /Jev/, /Hermes/]) assert.match(guide, rule);
  const readme = await text("README.md");
  assert.match(readme, /\(docs\/lean-workflows.md\)/);
  assert.match(readme, /\/skill:discovery/);
  assert.match(readme, /\/skill:delivery/);
  assert.match(readme, /no duplicate Team controller/);
  assert.match(readme, /not three mandatory files/);
  const workflow = await text("docs/delivery-workflow.md");
  assert.match(workflow, /no validator role/);
  assert.match(workflow, /no mandatory manifests/i);
});
