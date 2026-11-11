import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { cleanReviewCandidate } from "../extensions/delivery-tmux/workspace.ts";
import { initSyntheticGit } from "./fixtures/synthetic-git.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));

test("clean review token fails closed on dirty state, special index flags, bad revision and wrong root", () => {
  const fixture = mkdtempSync(join(root, ".agent-work/parallel-addy/candidate-"));
  const bin = join(fixture, "bin"); mkdirSync(bin);
  writeFileSync(join(bin, "git"), `#!/bin/sh
case "$*" in
 *--show-toplevel*) printf '%s\\n' "$REVIEW_ROOT" ;;
 *--verify*) printf '%s\\n' "$REVIEW_HEAD" ;;
 *ls-files*) printf '%s fixture\\0' "$REVIEW_FLAG" ;;
 *status*) if [ "$REVIEW_DIRTY" = 1 ]; then printf '?? new\\0'; fi ;;
 *) exit 1 ;;
esac
`, { mode: 0o755 });
  const keys = ["PATH", "REVIEW_ROOT", "REVIEW_HEAD", "REVIEW_FLAG", "REVIEW_DIRTY"] as const;
  const old = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    Object.assign(process.env, { PATH: bin + ":/usr/bin:/bin", REVIEW_ROOT: fixture,
      REVIEW_HEAD: "a".repeat(40), REVIEW_FLAG: "H", REVIEW_DIRTY: "0" });
    assert.equal(cleanReviewCandidate(fixture), "a".repeat(40));
    process.env.REVIEW_DIRTY = "1";
    assert.throws(() => cleanReviewCandidate(fixture), /clean worktree/);
    process.env.REVIEW_DIRTY = "0";
    for (const flag of ["S", "h"]) {
      process.env.REVIEW_FLAG = flag;
      assert.throws(() => cleanReviewCandidate(fixture), /index flags/);
    }
    process.env.REVIEW_FLAG = "H"; process.env.REVIEW_HEAD = "not-a-commit";
    assert.throws(() => cleanReviewCandidate(fixture), /Invalid review revision/);
    process.env.REVIEW_HEAD = "a".repeat(40); process.env.REVIEW_ROOT = root;
    assert.throws(() => cleanReviewCandidate(fixture), /worktree root/);
  } finally {
    for (const key of keys) old[key] === undefined ? delete process.env[key] : process.env[key] = old[key];
  }
});

test("real Git recognizes a clean candidate and rejects tracked and untracked drift", () => {
  const fixture = mkdtempSync(join(root, ".agent-work/parallel-addy/real-git-"));
  const env = { PATH: "/usr/bin:/bin", HOME: fixture, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null" };
  const initial = initSyntheticGit(fixture, env);
  assert.equal(cleanReviewCandidate(fixture), initial);
  writeFileSync(join(fixture, "untracked-review-fixture"), "fixture");
  assert.throws(() => cleanReviewCandidate(fixture), /clean worktree/);
  // Preserve the untracked file, but ignore it to exercise tracked drift separately.
  mkdirSync(join(fixture, ".git/info"), { recursive: true });
  writeFileSync(join(fixture, ".git/info/exclude"), "untracked-review-fixture\n");
  assert.equal(cleanReviewCandidate(fixture), initial);
  writeFileSync(join(fixture, "README.md"), "fixture mutation\n");
  assert.throws(() => cleanReviewCandidate(fixture), /clean worktree/);
});
