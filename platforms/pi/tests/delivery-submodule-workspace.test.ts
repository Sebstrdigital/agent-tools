import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, realpathSync, renameSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { resolveWorkerWorkspace } from "../extensions/delivery-tmux/workspace.ts";

test("wrapper admits linked worktrees of its initialized submodule, not unrelated repositories", t => {
  const dir = mkdtempSync(join(tmpdir(), "delivery-submodule-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const wrapper = join(dir, "wrapper"), source = join(dir, "source"), sub = join(wrapper, "component"), one = join(wrapper, "trees/one"), two = join(wrapper, "trees/two"), stale = join(wrapper, "trees/stale"), other = join(dir, "other");
  const git = (...args: string[]) => execFileSync("git", ["-c", "user.name=Fixture", "-c", "user.email=fixture@example.test", "-c", "core.hooksPath=/dev/null", "-c", "protocol.file.allow=always", ...args], { env: { ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null" }, stdio: "pipe" });
  for (const repo of [wrapper, source, other]) { git("init", "-q", "--template=", repo); git("-C", repo, "commit", "--allow-empty", "-qm", "fixture"); }
  git("-C", wrapper, "submodule", "add", "-q", source, "component");
  git("-C", wrapper, "commit", "-qm", "submodule");
  mkdirSync(join(wrapper, "trees"));
  for (const tree of [one, two, stale]) git("-C", sub, "worktree", "add", "--detach", tree);
  renameSync(stale, stale + "-moved"); // Keep the stale Git registration.
  mkdirSync(join(wrapper, "nested"));
  assert.equal(resolveWorkerWorkspace(join(wrapper, "nested"), one), realpathSync(one));
  assert.equal(resolveWorkerWorkspace(wrapper, one), realpathSync(one));
  assert.equal(resolveWorkerWorkspace(wrapper, two), realpathSync(two));
  assert.equal(resolveWorkerWorkspace(wrapper, sub), realpathSync(sub));
  assert.throws(() => resolveWorkerWorkspace(wrapper, other), /linked worktree/);
  assert.throws(() => resolveWorkerWorkspace(wrapper, join(one, ".git")), /linked worktree|unavailable/);
  const alias = join(wrapper, "alias"); symlinkSync(other, alias);
  assert.throws(() => resolveWorkerWorkspace(wrapper, alias), /linked worktree/);
  // Git reports the enclosing superproject even for an unrelated clone at the gitlink path.
  renameSync(sub, sub + "-initialized");
  git("clone", "-q", source, sub);
  const impostorTree = join(wrapper, "trees/impostor");
  git("-C", sub, "worktree", "add", "--detach", impostorTree);
  assert.equal(realpathSync(git("-C", sub, "rev-parse", "--show-superproject-working-tree").toString().trim()), realpathSync(wrapper));
  assert.throws(() => resolveWorkerWorkspace(wrapper, sub), /linked worktree/);
  assert.throws(() => resolveWorkerWorkspace(wrapper, impostorTree), /linked worktree/);
});
