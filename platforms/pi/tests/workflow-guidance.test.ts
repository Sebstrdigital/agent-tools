import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
const root = fileURLToPath(new URL("../", import.meta.url));
const text = (path: string) => readFile(root + path, "utf8");
const policyPaths = ["agent/AGENTS.md", "skills/delivery/SKILL.md", "skills/discovery/SKILL.md", "docs/lean-workflows.md", "docs/delivery-workflow.md", "skills/delivery/references/delegation.md", "skills/delivery/references/authority-and-state.md"];

// Wording guards, not an LLM compliance or live task-completion demonstration.
test("planning and delivery distinguish scope expansion from safe follow-up", async () => {
  for (const path of ["skills/addy-engineering/SKILL.md", "skills/delivery/SKILL.md", "docs/lean-workflows.md"]) {
    const source = await text(path);
    for (const rule of [/foreseeable important/i, /follow.up/i, /Scope expansion/i,
      /acceptance criteria/i, /safety|unsafe/i, /(?:do not|rather than) claim completion/i]) assert.match(source, rule, path);
  }
  for (const path of ["skills/addy-engineering/SKILL.md", "skills/delivery/SKILL.md", "docs/lean-workflows.md"]) {
    const source = await text(path);
    assert.match(source, /bounded (?:route|and broader choices)/i, path);
    assert.match(source, /Recommend the bounded route when it can safely meet the agreed outcome/i, path);
    assert.match(source, /if recommending expansion.*bounded route is inadequate.*additional work/i, path);
    assert.match(source, /in.scope repairs/i, path);
  }
});
test("the agreed task remains the boundary through delegated build, validation and review", async () => {
  const lead = await text("agent/AGENTS.md");
  for (const rule of [/agreed task.*delivery boundary/i, /separable discoveries.*follow.up/i,
    /safety or acceptance blockers/i, /next task without authority/i,
    /consequential scope questions.*impact.*Scope expansion/i,
    /recommend the bounded route when it safely meets the agreed outcome/i]) assert.match(lead, rule);
  const builder = await text("vendor/pi-interactive-subagents/agents/builder.md");
  for (const rule of [/agreed task.*wider product or sprint plan.*delivery boundary/i,
    /separable discoveries.*follow.up/i, /safety or acceptance blocker/i,
    /release risk/i]) assert.match(builder, rule);
  const validator = await text("vendor/pi-interactive-subagents/agents/validator.md");
  for (const rule of [/task.s acceptance.*not future features/i, /follow.up/i, /release risks/i,
    /without hiding serious risks or weakening checks/i]) assert.match(validator, rule);
  const reviewer = await text("vendor/pi-interactive-subagents/agents/reviewer.md");
  for (const rule of [/agreed task.*wider product or sprint plan.*review boundary/i,
    /do not demand future features/i, /task blockers, release risks and follow.up suggestions/i,
    /Surface serious risks honestly/i]) assert.match(reviewer, rule);
  for (const path of ["skills/delivery/SKILL.md", "skills/delivery/references/delegation.md", "skills/addy-engineering/SKILL.md"]) {
    const source = await text(path);
    for (const rule of [/task blockers?/i, /release risks?/i, /follow.up/i, /suggestions/i]) assert.match(source, rule, path);
  }
});
test("milestone completion requires validated outcomes across policy and workflow entry points", async () => {
  const policy = await text("agent/AGENTS.md");
  assert.match(policy, /Before.*milestone.*complete.*validate.*outcome/i);
  assert.match(policy, /failed.*blocked.*pending/i);
  for (const path of ["skills/addy-engineering/SKILL.md", "skills/delivery/SKILL.md", "skills/delivery/references/authority-and-state.md"]) {
    const source = await text(path);
    assert.match(source, /before.*milestone.*complete/i, path);
    const link = source.match(/\]\(([^)]+validated-completion\.md)\)/)?.[1];
    assert.ok(link, `${path}: completion policy link`);
    assert.equal(await readFile(resolve(root, dirname(path), link), "utf8"), await text("docs/workflows/validated-completion.md"));
  }
  const guide = await text("docs/workflows/validated-completion.md");
  for (const rule of [/every milestone/i, /before.*completed/is, /acceptance condition/i,
    /candidate.*environment/is, /inspected evidence/i, /normal user.*path/i,
    /diagnostic bypass/i, /pending/i, /permission/i, /not.*user.*acceptance/i,
    /reopen/i, /not.*mechanical.*guarantee/i]) assert.match(guide, rule);
});
test("execution authority is the understood task, not another mode/Agreement ceremony", async () => {
  for (const path of policyPaths) {
    const source = await text(path);
    assert.match(source, /clear.*(?:request|task execution request)/i, path);
    assert.match(source, /proposal|advice/i, path);
    assert.match(source, /no separate|do not require|without requiring/i, path);
    assert.doesNotMatch(source, /user explicitly selects|Selection.*authorizes preparation|approve.*actual Agreement before launching|at most (two|three|four).*fix cycles/i, path);
  }
});
test("brainstorming guidance suggests a proportionate six-phase transition without granting authority", async () => {
  const alwaysLoaded = await text("agent/AGENTS.md");
  const skill = await text("skills/addy-engineering/SKILL.md");
  for (const source of [alwaysLoaded, skill]) {
    assert.match(source, /brainstorming/i);
    assert.match(source, /DEFINE.*PLAN.*BUILD.*VERIFY.*REVIEW.*SHIP/s);
    assert.match(source, /not implementation authority|not.*implementation.*authority/i);
    assert.match(source, /usually (?:move to )?PLAN/i);
  }
  assert.match(skill, /Direct BUILD/);
});

test("ordinary corrections and supporting files are not permission tokens", async () => {
  for (const path of policyPaths.filter(path => !path.includes("discovery"))) {
    const source = await text(path);
    assert.match(source, /supporting/i, path);
    assert.match(source, /compiler/i, path);
    assert.match(source, /explicit|user.agreed|user.requested/i, path);
    assert.match(source, /no progress|progress stalls|change strategy/i, path);
    assert.match(source, /not.*repair tokens|not.*compiler.error quotas|not repair tokens|Do not invent.*repair/i, path);
  }
});
test("roles are proportional, workspace ownership and requested gates remain", async () => {
  for (const path of ["skills/delivery/SKILL.md", "docs/lean-workflows.md", "skills/delivery/references/delegation.md"]) {
    const source = await text(path);
    assert.match(source, /no mandatory|not.*compulsory/i);
    assert.match(source, /linked worktrees/i);
    assert.match(source, /same.workspace.*exclusive/i);
    assert.match(source, /requested.*gates/i);
    assert.match(source, /lead.*accepts|lead alone/i);
  }
});
test("delegated roles keep execution with workers while Direct preserves small-task lead work", async () => {
  const delegatedPaths = [
    "agent/AGENTS.md",
    "skills/delivery/SKILL.md",
    "skills/delivery/references/delegation.md",
    "skills/delivery/references/authority-and-state.md",
    "docs/lean-workflows.md",
    "docs/delivery-workflow.md",
    "skills/addy-engineering/SKILL.md",
    "skills/addy-engineering/references/execution.md",
  ];
  for (const path of delegatedPaths) {
    const source = await text(path);
    assert.match(source, /Direct(?:(?: remains)? (?:appropriate|valid).*small task|: lead (?:may )?implements?)/i, path);
    assert.match(source, /workers?.*(?:execute|perform).*?(?:edits|diagnosis|validation)/is, path);
    assert.match(source, /read-only evidence inspection/i, path);
    assert.match(source, /quick-fix|one-line exception/i, path);
    assert.match(source, /reconcil/i, path);
    assert.match(source, /red.check workaround|red-check workaround/i, path);
    // Prevent the former unqualified lead-execution policy from returning.
    assert.doesNotMatch(source, /The lead owns implement -> diagnose -> in-scope repair -> revalidate\/review -> next approved task/, path);
  }
  const delivery = await text("skills/delivery/SKILL.md");
  assert.match(delivery, /commit, push, merge-request creation, merge, deploy and publication/i);
  assert.match(delivery, /applicable authority/i);
});
test("sensitive test isolation is preserved independently of workflow ceremony", async () => {
  const guide = await text("docs/lean-workflows.md");
  for (const rule of [/before sensitive tests run/, /effective execution boundary/, /Invoking shell alone is not proof/, /If isolation is unverified or fails/, /required valid baseline before edits/, /not retroactive compliance/, /breach separately/, /Missing or excluded checks are not passes/]) assert.match(guide, rule);
  for (const path of policyPaths) {
    const source = await text(path);
    assert.match(source, /private.data|privacy/i, path);
    assert.match(source, /destructive|delete/i, path);
  }
});
test("evidence reuse does not waive acceptance or invent live qualification", async () => {
  const guide = await text("docs/lean-workflows.md");
  for (const rule of [/unchanged candidate\/conditions/, /affected checks/, /integrated/, /not assurance-only full reruns/, /untested runtime\/manual scenario/, /manual checklist/, /honest gaps/, /not customer acceptance or release permission/, /complete task-owned diff including added files/, /Truncation is not complete evidence/]) assert.match(guide, rule);
});
test("optional templates do not prescribe a quota or approval suite", async () => {
  for (const name of ["task", "agreement", "plan", "brief"]) {
    const source = await text(`skills/delivery/references/templates/${name}.md`);
    assert.match(source, /optional|not.*mandatory/i);
    assert.doesNotMatch(source, /at most \d.*repair|fresh builder per slice|metadata, not permission: execute sequentially|approved cumulative effort ceiling; no-progress/);
  }
});
test("saved pins, explicit limits and executable-code trust are preserved", async () => {
  const guide = await text("docs/lean-workflows.md");
  for (const rule of [/Saved sessions replay pinned grants\/model\/identity\/resource policy unchanged/, /Existing approvals and declared limits remain binding/, /No retroactive rewriting/, /no arbitrary 20-minute/, /Legacy unbound saved sessions retain/, /missing execution measurements fail closed/, /not an OS sandbox/, /Executable extension and MCP discovery remain denied/, /Legacy snapshots retain six original denials/, /no blind replay|Never blindly replay/]) assert.match(guide, rule);
});
test("approved routing is unchanged and availability is not entitlement", async () => {
  const source = await text("docs/lean-workflows.md");
  for (const rule of [/gpt-6-luna, low/, /gpt-6\.1-terra, medium/, /gpt-6\.1-sol, high/, /gpt-6\.1-terra, high/, /omission is analysis/, /No Astra/, /no.*automatic fallback/i, /Registry metadata does not prove backend entitlement/, /Saved sessions replay pinned old model\/effort unchanged/]) assert.match(source, rule);
});
test("fixed worker grants and bounded context remain", async () => {
  for (const [role, tools] of [["builder", "read,grep,find,ls,bash,edit,write,codemode"], ["validator", "read,grep,find,ls,bash,codemode"], ["reviewer", "read,grep,find,ls,codemode"], ["scout", "read,grep,find,ls,codemode"]]) {
    const source = await text(`vendor/pi-interactive-subagents/agents/${role}.md`);
    assert.ok(source.includes(`delivery-role: ${role}\ntools: ${tools}\n`));
    assert.match(source, /codemode/); assert.match(source, /truncation/);
  }
  const policy = await text("agent/AGENTS.md");
  assert.ok(Buffer.byteLength(policy) < 3600);
  assert.match(policy, /munin show <id>/); assert.match(policy, /Omit secrets/);
});
test("artifact guidance keeps project work local and housekeeping authority scoped", async () => {
  const policy = await text("agent/AGENTS.md");
  assert.match(policy, /project-local/i);
  assert.match(policy, /housekeeping/i);
  const guide = await text("docs/workflows/project-artifacts.md");
  for (const rule of [
    /owning project root/i, /\.agent-work\/<task>\//,
    /sibling directories/i, /symlinks/i, /TMPDIR/,
    /harness-managed/i, /not.*scratch destination/i,
    /cleanup authority/i, /dirty or unique work/i,
    /git worktree remove/i, /never.*force/i,
    /retained.*purpose/is, /evidence links/i,
    /not an OS sandbox/i, /scan failed/i,
    /failed or unperformed scan is unresolved/i,
    /actual.*exit code|returned exit code/i,
    /cleanup-inventory\.mjs/, /passing subset is not global cleanup completion/i,
  ]) assert.match(guide, rule);
  assert.ok(await text("scripts/cleanup-inventory.mjs"));
});
test("workflow entry points carry artifact boundaries through delegation and completion", async () => {
  for (const path of ["skills/delivery/SKILL.md", "skills/delivery/references/delegation.md", "skills/addy-engineering/SKILL.md", "skills/addy-engineering/references/execution.md"]) {
    const source = await text(path);
    const link = source.match(/\]\(([^)]+project-artifacts\.md)\)/)?.[1];
    assert.ok(link, `${path}: artifact policy link`);
    assert.equal(await readFile(resolve(root, dirname(path), link), "utf8"), await text("docs/workflows/project-artifacts.md"), `${path}: resolves to canonical policy`);
    assert.match(source, /project root/i, path);
    assert.match(source, /cleanup|housekeeping/i, path);
  }
  const adaptations = await text("skills/addy-engineering/references/pi-adaptations.md");
  assert.doesNotMatch(adaptations, /no artifact retention\/deletion policy is introduced/);
});
test("project presentations do not default to external temporary output", async () => {
  const skill = await text("skills/one-pager/SKILL.md");
  assert.match(skill, /project-local/i);
  assert.match(skill, /outside.*explicit/is);
  assert.match(skill, /non-project/i);
  assert.doesNotMatch(skill, /use a temporary directory if no repository artifact was requested/);
  const link = skill.match(/\]\(([^)]+project-artifacts\.md)\)/)?.[1];
  assert.ok(link);
  assert.equal(await readFile(resolve(root, "skills/one-pager", link), "utf8"), await text("docs/workflows/project-artifacts.md"));
  assert.match(await text(".gitignore"), /^\/\.agent-work\/$/m);
});

test("manual acceptance handoff uses project guidance without inventing approval", async () => {
  const guide = await text("docs/workflows/validated-completion.md");
  for (const rule of [/project.*AGENTS\.md/i, /conversation.*settled/i, /consequential.*gap/i,
    /actual candidate/i, /normal user access path/i, /checklist/i, /accept.*changes.*hold/i,
    /blocked.*next step/i, /until.*user.*finish/i, /no.*release.*authority/i,
    /trivial/i]) assert.match(guide, rule);
  for (const path of ["skills/addy-engineering/SKILL.md", "skills/delivery/SKILL.md", "docs/lean-workflows.md"]) {
    const source = await text(path);
    assert.match(source, /manual acceptance handoff/i, path);
    assert.match(source, /validated-completion\.md/, path);
  }
  const homelab = await text("skills/homelab-validation/SKILL.md");
  assert.match(homelab, /until the user finishes/i);
  assert.match(homelab, /normal access path/i);
});

test("early delivery preflight and failed acceptance preserve authority and safety boundaries", async () => {
  const delivery = await text("skills/delivery/SKILL.md");
  const section = delivery.split("### Early delivery preflight")[1].split("Direct remains appropriate")[0];
  for (const rule of [/agreed outcome and acceptance/i, /scope and non-goals/i,
    /authority already granted.*unresolved permissions.*exclusions/i,
    /independent consequential decisions together when useful/i,
    /ask dependent decisions later/i, /blanket permission/i, /re-ask settled grants/i,
    /worker roles and grants/i, /validation.*release route/i, /side effects.*isolation boundary/i,
    /simplest sufficient safe route/i, /required checks.*normal user-path acceptance/i,
    /continue independent authorized work/i, /without substituting.*weakening acceptance/i]) assert.match(section, rule);
  for (const path of ["skills/delivery/SKILL.md", "skills/addy-engineering/SKILL.md"]) {
    const source = await text(path);
    for (const rule of [/reconcile (?:any )?partial side effects and resource ownership/i,
      /do not blindly replay actions/i, /(?:in.scope repair|repair in scope)/i, /acceptance (?:checks|verification)/i,
      /rather than.*prematur/i]) assert.match(source, rule, path);
  }
  const addy = await text("skills/addy-engineering/SKILL.md");
  assert.match(addy, /group known independent consequential decisions when useful, and ask dependent decisions later/i);
  assert.match(addy, /Do not invent blanket approval or repeat settled grants/i);
  const link = addy.match(/\]\(([^)]+delivery\/SKILL\.md)#early-delivery-preflight\)/)?.[1];
  assert.ok(link);
  assert.equal(await readFile(resolve(root, "skills/addy-engineering", link), "utf8"), delivery);
});

test("comparison names the user's TAKT and does not copy publication authority", async () => {
  const guide = await text("docs/lean-workflows.md");
  assert.match(guide, /03a7c1e/); assert.match(guide, /unrelated nrslib\/takt/);
  assert.match(guide, /three verification cycles and two review cycles/);
  assert.match(guide, /No default commit\/install\/delete\/force\/push\/PR\/publication authority/);
  assert.match(await text("README.md"), /docs\/lean-workflows.md/);
});
