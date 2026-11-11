import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("PACE links proportionate parallel guidance without promising unsupported scheduling", async () => {
  const skill = await read("skills/addy-engineering/SKILL.md");
  const guide = await read("skills/addy-engineering/references/parallel-work.md");
  assert.match(skill, /references\/parallel-work\.md/);
  assert.match(skill, /simple task, keep the ordinary lightweight path/);
  assert.match(guide, /multiple pinned, inspection-only reviewers/);
  assert.match(guide, /including while paused or waiting/);
  assert.match(guide, /not an immutable snapshot or filesystem lock/);
  assert.match(guide, /Never widen a reviewer's fixed inspection-only grant/);
});

test("parallel guidance preserves baseline, dependency, recovery and integrated evidence boundaries", async () => {
  const guide = await read("skills/addy-engineering/references/parallel-work.md");
  for (const boundary of [
    /missing dependencies and cycles/, /dirty tracked and untracked content/, /Do not silently copy untracked\/ignored files/,
    /shared external resources/, /external mutations/, /invalidates affected downstream checks and reviews/,
    /complete integrated candidate/, /run identity, partial changes, explicit limits and held resources/,
    /never infer resource release/i, /not authenticated grants/,
  ]) assert.match(guide, boundary);
});
