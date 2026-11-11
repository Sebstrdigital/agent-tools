import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { inspectCleanup } from "../scripts/cleanup-inventory.mjs";

const script = fileURLToPath(new URL("../scripts/cleanup-inventory.mjs", import.meta.url));
async function fixture(t: any) {
  const dir = await mkdtemp(join(tmpdir(), "cleanup-inventory-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

test("successful empty scan and absent known path are complete", async t => {
  const dir = await fixture(t);
  const result = await inspectCleanup({ scans: [dir], removed: [join(dir, "gone")] });
  assert.equal(result.status, "complete");
  assert.deepEqual(result.checks.map(c => c.status), ["empty", "absent"]);
});
test("a missing or invalid scan is an error, never an empty result", async t => {
  const dir = await fixture(t), file = join(dir, "file");
  await writeFile(file, "keep");
  for (const path of [join(dir, "missing"), file]) {
    const result = await inspectCleanup({ scans: [path] });
    assert.equal(result.status, "error");
    assert.equal(result.checks[0].status, "error");
  }
});
test("enumeration failure fails closed even if other checks succeed", async () => {
  const io = {
    lstat: async () => ({ isDirectory: () => true, isSymbolicLink: () => false }),
    readdir: async () => { throw Object.assign(new Error("denied"), { code: "EACCES" }); },
  };
  const result = await inspectCleanup({ scans: ["scan"] }, io);
  assert.equal(result.status, "error");
  assert.match(result.checks[0].error, /EACCES/);
});
test("remaining known artifacts and populated scans are incomplete", async t => {
  const dir = await fixture(t), path = join(dir, "leftover.cjs");
  await writeFile(path, "working script");
  const result = await inspectCleanup({ scans: [dir], removed: [path] });
  assert.equal(result.status, "incomplete");
  assert.deepEqual(result.checks.map(c => c.status), ["remaining", "remaining"]);
  assert.deepEqual(result.checks[0].entries, [path]);
});
test("retention requires a reason and an existing non-symlink path", async t => {
  const dir = await fixture(t), path = join(dir, "final.log");
  await writeFile(path, "final evidence");
  const result = await inspectCleanup({ scans: [dir], retained: [{ path, reason: "Final failure evidence" }] });
  assert.equal(result.status, "complete");
  assert.equal(result.checks.find(c => c.kind === "retained")?.reason, "Final failure evidence");
  assert.equal(result.checks.find(c => c.kind === "scan")?.status, "reconciled");
  for (const retained of [[{ path, reason: " " }], [{ path: join(dir, "missing"), reason: "Evidence" }]]) {
    assert.equal((await inspectCleanup({ retained })).status, "error");
  }
  assert.equal((await inspectCleanup({ removed: [path], retained: [{ path, reason: "Conflicting disposition" }] })).status, "error");
});
test("symlinks are not followed or mistaken for removed paths", async t => {
  const dir = await fixture(t), target = join(dir, "target"), link = join(dir, "link");
  await mkdir(target); await symlink(target, link);
  assert.equal((await inspectCleanup({ scans: [link] })).status, "error");
  assert.equal((await inspectCleanup({ retained: [{ path: link, reason: "Unverified alias" }] })).status, "error");
  const dangling = join(dir, "dangling"); await symlink(join(dir, "missing"), dangling);
  assert.equal((await inspectCleanup({ removed: [dangling] })).status, "incomplete");
});
test("CLI emits structured results, nonzero failures and rejects empty or malformed scope", async t => {
  const dir = await fixture(t);
  const run = (...args: string[]) => spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
  const empty = run("--scan", dir);
  assert.equal(empty.status, 0); assert.equal(JSON.parse(empty.stdout).status, "complete");
  await writeFile(join(dir, "leftover"), "keep");
  const remaining = run("--scan", dir);
  assert.equal(remaining.status, 1); assert.equal(JSON.parse(remaining.stdout).status, "incomplete");
  const error = run("--scan", join(dir, "missing"));
  assert.equal(error.status, 2); assert.equal(JSON.parse(error.stdout).status, "error");
  for (const args of [[], ["--unknown"], ["--scan"], ["--retained", dir]]) assert.equal(run(...args).status, 2);
});
