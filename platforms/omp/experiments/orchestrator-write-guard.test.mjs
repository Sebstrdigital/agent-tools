import test from "node:test";
import assert from "node:assert/strict";
import guard from "./orchestrator-write-guard.mjs";

function handler() {
  let fn;
  guard({ on(name, callback) { assert.equal(name, "tool_call"); fn = callback; } });
  return fn;
}

const main = { agent: { kind: "main" } };
const sub = { agent: { kind: "sub" } };

test("lead direct file mutations are blocked while worker mutations are allowed", () => {
  const call = handler();
  for (const toolName of ["write", "edit"]) {
    assert.equal(call({ toolName, input: { path: "src/app.ts" } }, main)?.block, true);
    assert.equal(call({ toolName, input: { path: "src/app.ts" } }, sub), undefined);
  }
});

test("lead can message an agent but cannot write to other URI devices", () => {
  const call = handler();
  assert.equal(call({ toolName: "write", input: { path: "agent://Worker" } }, main), undefined);
  for (const path of ["agent://Worker/child", "agent://Worker?other", "xd://tool", "out://message", "file.txt", ""]) {
    assert.equal(call({ toolName: "write", input: { path } }, main)?.block, true);
  }
});

test("unknown identity fails closed for guarded tools", () => {
  assert.equal(handler()({ toolName: "edit", input: {} }, {})?.block, true);
});

test("other tools remain available and can mutate indirectly", () => {
  const call = handler();
  for (const toolName of ["read", "task", "bash", "eval"]) {
    assert.equal(call({ toolName, input: {} }, main), undefined);
  }
});
