import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { executeGraph, preflightGraphCommand } from '../scripts/addy-graph.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const script = join(root, 'scripts/addy-graph.mjs');
const digest = value => createHash('sha256').update(value).digest('hex');
const fixture = () => mkdtempSync(join(root, '.agent-work/parallel-addy/graph-test-'));
const base = () => digest(readFileSync(script)); // Actual candidate file, no private/untracked copy.
const plan = slices => ({ op: 'init', baseline: base(), baselineRef: 'task-owned script content', slices });
const start = (expected, slice, attempt) => ({ op: 'start', expected, slice, attempt, worker: 'builder-fixture', workspace: 'owned fixture', taskRef: 'bounded task' });
const finish = (expected, attempt, candidate = digest('candidate'), evidence = digest('check output')) => ({ op: 'finish', expected, attempt, candidate, evidence, resultRef: 'fixture evidence' });
const inspect = workspace => executeGraph(root, workspace, 'graph', 'inspect');
const apply = (workspace, command) => executeGraph(root, workspace, 'graph', 'apply', command);

test('absolute, relative and symlink graph CLI paths initialize and inspect real journals', () => {
  const w = fixture(), link = join(w, 'graph-link.mjs'); symlinkSync(script, link);
  const invocations = [script, 'scripts/addy-graph.mjs', link];
  for (const [index, path] of invocations.entries()) {
    const name = 'mode-' + index, init = spawnSync(process.execPath, [path, root, w, name, 'init', JSON.stringify(plan([{ id: 'worker', depends: [] }]))], { cwd: root, encoding: 'utf8' });
    assert.equal(init.status, 0, init.stderr); assert.equal(JSON.parse(init.stdout).revision, 0);
    assert.deepEqual(readdirSync(join(w, name)), ['00000000.json']);
    const inspected = spawnSync(process.execPath, [path, root, w, name, 'inspect'], { cwd: root, encoding: 'utf8' });
    assert.equal(inspected.status, 0, inspected.stderr); assert.equal(JSON.parse(inspected.stdout).slices[0].id, 'worker');
  }
});

test('rejects duplicate and missing IDs, duplicate edges and cycles before creating a graph', () => {
  for (const slices of [
    [{ id: 'a', depends: [] }, { id: 'a', depends: [] }],
    [{ id: 'a', depends: ['missing'] }],
    [{ id: 'a', depends: ['b', 'b'] }, { id: 'b', depends: [] }],
    [{ id: 'a', depends: ['b'] }, { id: 'b', depends: ['a'] }],
  ]) {
    const workspace = fixture();
    assert.throws(() => executeGraph(root, workspace, 'graph', 'init', plan(slices)), /Duplicate|duplicate|Missing|cycle/);
    assert.throws(() => inspect(workspace), /ENOENT/);
  }
});

test('attempts persist; dependency reruns, baseline updates and stale evidence propagate transitively', () => {
  const w = fixture(), slices = [{ id: 'a', depends: [] }, { id: 'b', depends: ['a'] }, { id: 'c', depends: ['b'] }];
  executeGraph(root, w, 'graph', 'init', plan(slices));
  assert.throws(() => apply(w, start(0, 'b', 'b1')), /Dependency not ready/);
  apply(w, start(0, 'a', 'a1')); apply(w, finish(1, 'a1'));
  apply(w, start(2, 'b', 'b1')); apply(w, finish(3, 'b1', digest('b')));
  apply(w, start(4, 'c', 'c1')); apply(w, finish(5, 'c1', digest('c')));
  assert.deepEqual(inspect(w).slices.map(s => s.valid), [true, true, true]);
  const after = apply(w, start(6, 'a', 'a2'));
  assert.deepEqual(after.slices.map(s => s.valid), [false, false, false]);
  assert.throws(() => apply(w, start(7, 'a', 'a1')), /already used/);
  assert.throws(() => apply(w, start(7, 'b', 'b2')), /Dependency not ready/);
  apply(w, finish(7, 'a2')); // Same content still has a new dependency attempt identity.
  assert.deepEqual(inspect(w).slices.map(s => s.valid), [true, false, false]);
  apply(w, start(8, 'b', 'b2'));
  apply(w, { op: 'baseline', expected: 9, digest: base(), ref: 'same bytes, new observation' });
  assert.throws(() => apply(w, finish(10, 'b2')), /stale/);
  apply(w, { op: 'reconcile', expected: 10, attempt: 'b2', outcome: 'abandoned', note: 'Partial effects and resources require separate review' });
  const s = inspect(w);
  assert.equal(s.attempts.length, 5);
  assert.deepEqual(s.slices.map(x => x.valid), [false, false, false]);
  assert.equal(s.attempts.find(x => x.id === 'b2').status, 'abandoned');
  assert.throws(() => apply(w, start(11, 'a', 'a1')), /already used/);
});

test('interrupted attempts are not replayed, stale revisions fail, and corrupt journals fail closed', () => {
  const w = fixture(); executeGraph(root, w, 'graph', 'init', plan([{ id: 'a', depends: [] }]));
  apply(w, start(0, 'a', 'run-1'));
  assert.throws(() => apply(w, start(1, 'a', 'run-2')), /unresolved running/);
  assert.throws(() => apply(w, finish(0, 'run-1')), /Stale/);
  apply(w, { op: 'reconcile', expected: 1, attempt: 'run-1', outcome: 'failed', note: 'Run checked; effects not automatically retried' });
  apply(w, start(2, 'a', 'run-2'));
  writeFileSync(join(w, 'graph', '00000004.json'), '{partial');
  assert.throws(() => inspect(w), /Incomplete or corrupt/);
  assert.throws(() => apply(w, finish(3, 'run-2')), /Incomplete or corrupt/);
});

test('tail checksum detects valid JSON candidate or evidence corruption', () => {
  for (const field of ['candidate', 'evidence']) {
    const w = fixture(); executeGraph(root, w, 'graph', 'init', plan([{ id: 'a', depends: [] }]));
    apply(w, start(0, 'a', 'run-1')); apply(w, finish(1, 'run-1'));
    const file = join(w, 'graph', '00000002.json');
    const entry = JSON.parse(readFileSync(file, 'utf8'));
    entry.command[field] = digest('corrupt-' + field);
    writeFileSync(file, JSON.stringify(entry) + '\n');
    assert.throws(() => inspect(w), /checksum mismatch/);
    assert.throws(() => apply(w, start(2, 'a', 'run-2')), /checksum mismatch/);
  }
});

test('dense init enforces exact serialized byte limit before directory creation', () => {
  const limit = 1024 * 1024, w = fixture();
  const slices = Array.from({ length: 240 }, (_, i) => ({ id: 's' + String(i).padStart(3, '0') + 'x'.repeat(56), depends: [] }));
  const command = plan(slices);
  command.baselineRef = 'x';
  const size = c => Buffer.byteLength(JSON.stringify({ version: 2, seq: 0, prev: null, command: c, checksum: '0'.repeat(64) }) + '\n');
  let used = size(command);
  outer: for (let i = 1; i < slices.length; i++) for (let j = 0; j < i; j++) {
    const cost = Buffer.byteLength(JSON.stringify(slices[j].id)) + (slices[i].depends.length ? 1 : 0);
    if (used + cost > limit - 1024) break outer;
    slices[i].depends.push(slices[j].id); used += cost;
  }
  assert.equal(size(command), used);
  command.baselineRef += 'x'.repeat(limit - used);
  assert.equal(size(command), limit);
  const futureSize = c => Buffer.byteLength(JSON.stringify({ version: 2, seq: Number.MAX_SAFE_INTEGER, prev: '0'.repeat(64), command: c, checksum: '0'.repeat(64) }) + '\n');
  const overhead = futureSize(command) - limit;
  const futureFit = { ...command, baselineRef: command.baselineRef.slice(0, -overhead) };
  assert.equal(futureSize(futureFit), limit);
  assert.doesNotThrow(() => preflightGraphCommand(futureFit));
  assert.throws(() => preflightGraphCommand({ ...futureFit, baselineRef: futureFit.baselineRef + 'x' }), /exceeds 1 MiB/);
  assert.deepEqual(readdirSync(w), []); // Pure budget checks never create a journal.
  const oversized = { ...command, baselineRef: command.baselineRef + 'x' };
  assert.throws(() => executeGraph(root, w, 'oversized', 'init', oversized), /exceeds 1 MiB/);
  assert.throws(() => statSync(join(w, 'oversized')), /ENOENT/);
  const result = executeGraph(root, w, 'boundary', 'init', command);
  assert.equal(result.journalIntegrity, 'checksummed-v2');
  assert.equal(statSync(join(w, 'boundary', '00000000.json')).size, limit);
  assert.equal(executeGraph(root, w, 'boundary', 'inspect').revision, 0);
});

test('future-command budget uses graph reference semantics including JSON escaping and UTF-16 length', () => {
  for (const field of ['baselineRef', 'ref', 'worker', 'workspace', 'taskRef', 'resultRef', 'note']) {
    const value = '"\n雪😀'.repeat(819) + 'x'; assert.equal(value.length, 4096);
    assert.doesNotThrow(() => preflightGraphCommand({ [field]: value }));
    assert.throws(() => preflightGraphCommand({ [field]: value + 'x' }), /4096 characters/);
    assert.throws(() => preflightGraphCommand({ [field]: 'a\0b' }), /no NUL/);
  }
});

test('legacy v1 records remain inspectable and are never silently migrated', () => {
  const w = fixture(), graph = join(w, 'graph'); mkdirSync(graph);
  const entry = { version: 1, seq: 0, prev: null, command: plan([{ id: 'a', depends: [] }]) };
  const raw = JSON.stringify(entry) + '\n'; writeFileSync(join(graph, '00000000.json'), raw);
  assert.equal(inspect(w).journalIntegrity, 'legacy-v1-unsealed-read-only');
  assert.throws(() => apply(w, start(0, 'a', 'a1')), /read-only.*no implicit migration/);
  assert.equal(readFileSync(join(graph, '00000000.json'), 'utf8'), raw);
  assert.deepEqual(readdirSync(graph), ['00000000.json']);
});

test('concurrent graph writers cannot both claim the same revision', async () => {
  const w = fixture(); executeGraph(root, w, 'graph', 'init', plan([{ id: 'a', depends: [] }, { id: 'b', depends: [] }]));
  const launch = command => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, root, w, 'graph', 'apply', JSON.stringify(command)], { stdio: ['ignore', 'pipe', 'pipe'] });
    let error = ''; child.stderr.on('data', chunk => { error += chunk; });
    child.on('error', reject); child.on('close', code => resolve({ code, error }));
  });
  const results = await Promise.all([launch(start(0, 'a', 'a1')), launch(start(0, 'b', 'b1'))]);
  assert.equal(results.filter(r => r.code === 0).length, 1);
  assert.equal(results.filter(r => r.code !== 0).length, 1);
  assert.match(results.find(r => r.code !== 0).error, /Stale|EEXIST|Incomplete|corrupt/);
  assert.equal(inspect(w).attempts.length, 1);
});

test('running dependent cannot finish after its dependency begins a new attempt', () => {
  const w = fixture(); executeGraph(root, w, 'graph', 'init', plan([{ id: 'a', depends: [] }, { id: 'b', depends: ['a'] }]));
  apply(w, start(0, 'a', 'a1')); apply(w, finish(1, 'a1'));
  apply(w, start(2, 'b', 'b1')); apply(w, start(3, 'a', 'a2'));
  assert.throws(() => apply(w, finish(4, 'b1')), /stale/);
  assert.equal(inspect(w).attempts.find(a => a.id === 'b1').status, 'running');
});

test('checkpoint records a fresh target identity without making an attempt or dependent ready', () => {
  const w = fixture(), slices = [{ id: 'build', depends: [] }, { id: 'dependent', depends: ['build'] }];
  executeGraph(root, w, 'graph', 'init', plan(slices)); apply(w, start(0, 'build', 'attempt-1'));
  apply(w, { op: 'checkpoint', expected: 1, attempt: 'attempt-1', identity: 'a'.repeat(64), ref: 'synthetic target' });
  const state = inspect(w); assert.equal(state.attempts[0].status, 'running');
  assert.deepEqual(state.attempts[0].checkpoint, { identity: 'a'.repeat(64), ref: 'synthetic target' });
  assert.equal(state.slices.find(s => s.id === 'dependent').ready, false);
  assert.throws(() => apply(w, { op: 'checkpoint', expected: 2, attempt: 'attempt-1', identity: 'b'.repeat(64), ref: 'replacement' }), /already checkpointed/);
  apply(w, { op: 'reconcile', expected: 2, attempt: 'attempt-1', outcome: 'abandoned', note: 'synthetic inspection' });
  assert.equal(inspect(w).attempts[0].status, 'abandoned');
});

test('prepared evidence remains unresolved until explicit matching finish or reconciliation', () => {
  const w = fixture(), slices = [{ id: 'build', depends: [] }, { id: 'dependent', depends: ['build'] }];
  executeGraph(root, w, 'graph', 'init', plan(slices)); apply(w, start(0, 'build', 'attempt-1'));
  const prepared = { op: 'prepare', expected: 1, attempt: 'attempt-1', candidate: 'b'.repeat(64), evidence: 'c'.repeat(64), resultRef: 'synthetic evidence' };
  apply(w, prepared); const state = inspect(w);
  assert.equal(state.attempts[0].status, 'running'); assert.equal(state.slices.find(s => s.id === 'dependent').ready, false);
  assert.throws(() => apply(w, { ...prepared, expected: 2 }), /already has prepared evidence/);
  assert.throws(() => apply(w, { ...prepared, op: 'finish', expected: 2, evidence: 'd'.repeat(64) }), /match prepared/);
  apply(w, { ...prepared, op: 'finish', expected: 2 }); assert.equal(inspect(w).slices.find(s => s.id === 'dependent').ready, true);
});

test('normal CLI path is durable, stays inside project and never starts a worker', () => {
  const w = fixture(), call = (...args) => spawnSync(process.execPath, [script, root, w, 'graph', ...args], { encoding: 'utf8' });
  let r = call('init', JSON.stringify(plan([{ id: 'build', depends: [] }]))); assert.equal(r.status, 0, r.stderr);
  r = call('apply', JSON.stringify(start(0, 'build', 'attempt-1'))); assert.equal(r.status, 0, r.stderr);
  r = call('inspect'); assert.equal(r.status, 0, r.stderr); assert.equal(JSON.parse(r.stdout).attempts[0].status, 'running');
  r = call('apply', JSON.stringify(start(1, 'build', 'attempt-2'))); assert.notEqual(r.status, 0); assert.match(r.stderr, /reconcile first/);
  const parent = fixture(), target = join(parent, 'target'); mkdirSync(target); symlinkSync(target, join(parent, 'alias'));
  assert.throws(() => executeGraph(root, parent, 'alias', 'init', plan([{ id: 'x', depends: [] }])), /EEXIST/);
  const syntheticRoot = join(parent, 'synthetic-project'); mkdirSync(syntheticRoot);
  assert.throws(() => executeGraph(syntheticRoot, parent, 'outside', 'init', plan([{ id: 'x', depends: [] }])), /inside the project/);
});
