import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { initSyntheticGit } from './fixtures/synthetic-git.mjs';
import { verifyCandidate } from '../scripts/addy-candidate.mjs';

const root = fileURLToPath(new URL('../', import.meta.url)), suite = join(root, '.agent-work/integration-budget-tests'); mkdirSync(suite, { recursive: true });
const cli = join(root, 'scripts/addy-integrate.mjs'), flags = ['--authorize-local-integration', '--declare-inputs-quiescent'];
const version = spawnSync('/usr/bin/git', ['--version'], { encoding: 'utf8' });
const supported = process.platform === 'darwin' && version.status === 0 && version.stdout.trim() === 'git version 2.54.0 (Apple Git-157)';
const fixtureTest = (name, fn) => test(name, { skip: supported ? false : 'Requires tested Darwin / Apple Git runtime' }, fn);
const zero = '0'.repeat(64), hash = bytes => createHash('sha256').update(bytes).digest('hex');
const sourceSelection = { include: ['.gitignore', 'PLAN.md', 'README.md', 'docs/roles-library.md'], exclude: [] };
function fixture() {
  const parent = mkdtempSync(join(suite, 'synthetic-')), repo = join(parent, 'repo-"-雪'); mkdirSync(repo);
  const env = { PATH: '/usr/bin:/bin', HOME: parent, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' };
  initSyntheticGit(repo, env); writeFileSync(join(repo, 'README.md'), 'synthetic dirty budget baseline\n');
  return { parent, repo, env, boundary: join(repo, '.agent-work/addy-coordination/task'), target: join(repo, '.agent-work/linked-worktrees/task-combined') };
}
function invoke(f, action, value, expectedError) {
  const r = spawnSync(process.execPath, [cli, f.repo, action, 'task', ...(value === undefined ? [] : [JSON.stringify(value)]), ...flags], { env: f.env, encoding: 'utf8', timeout: 120000, maxBuffer: 16 * 1024 * 1024 });
  if (expectedError) { assert.notEqual(r.status, 0, r.stdout); assert.match(r.stderr, expectedError); return { status: r.status, stderr: r.stderr }; }
  assert.equal(r.status, 0, r.stderr); return JSON.parse(r.stdout);
}
function preview(f, prepared, request, exclusions) {
  // Independently construct the public final resultRef schema, including all
  // dynamic paths/escaping. Digests are fixed-width hex, not guessed padding.
  return JSON.stringify({ version: 1, target: f.target, identity: zero, ownerDigest: prepared.ownerDigest, candidate: zero, selectionDigest: zero, request, quiescence: 'caller-declared-not-verified', exclusions });
}
function journalHashes(f) {
  const dir = join(f.boundary, 'graph');
  return readdirSync(dir).sort().map(name => [name, hash(readFileSync(join(dir, name)))]);
}
function hashes(f, prepared, request, selections, targetIdentity = null) {
  const expectedNestedIdentities = [...prepared.builders.map(b => ({ path: '.agent-work/linked-worktrees/' + b.control, identity: b.identity })), { path: '.agent-work/linked-worktrees/task-combined', identity: targetIdentity }];
  const owner = { authorizeRepositoryControl: true, authorizeCoordinationArtifacts: true, coordination: 'task', authorizeNestedLinkedControls: true,
    nestedLinked: [...prepared.builders.map(b => ({ path: '.agent-work/linked-worktrees/' + b.control, controlId: b.control })), { path: '.agent-work/linked-worktrees/task-combined', controlId: 'task-combined' }], expectedNestedIdentities };
  const linked = { authorizeRepositoryControl: true, authorizeCoordinationArtifacts: true, coordination: 'task', authorizeLinkedControl: true, linkedProjectRoot: f.repo };
  return { owner: verifyCandidate(f.repo, sourceSelection, prepared.ownerDigest, owner).digest, sourceIndex: hash(readFileSync(join(f.repo, '.git/index'))), builders: request.builders.map(b => ({ id: b.id,
    candidate: verifyCandidate(join(f.repo, '.agent-work/linked-worktrees/task-' + b.id), selections[b.id], b.outputDigest, linked).digest,
    index: hash(readFileSync(join(f.repo, '.git/worktrees/task-' + b.id, 'index'))) })) };
}
for (const limit of [4096, 4097]) fixtureTest(`normal CLI publication resultRef boundary ${limit}: ${limit === 4096 ? 'succeeds at limit' : 'rejects before intent/target'}`, () => {
  const f = fixture(), prepared = invoke(f, 'prepare', { builders: ['one', 'two', 'three'], target: 'combined', excludedPrefixes: [], selection: sourceSelection });
  const manifest = JSON.parse(readFileSync(join(prepared.workspaces[0].path, '.agent-work/addy-coordination/task/manifests', prepared.builders[0].preparedDigest + '.json'), 'utf8'));
  const request = { attempt: 'boundary', builders: prepared.builders.map((b, i) => ({ id: b.id, preparedDigest: b.preparedDigest, outputDigest: zero, selectionDigest: zero, dependencies: [], paths: [['README.md'], ['PLAN.md'], ['docs/roles-library.md']][i] })) };
  const size = () => preview(f, prepared, request, manifest.manifest.exclusions).length;
  let count = 0;
  while (limit - size() > 230) request.builders[0].paths.push('long-' + count++ + '-' + 'x'.repeat(190) + '-"\n雪');
  request.builders[0].paths.push('tail-');
  const padding = limit - size(); assert.ok(padding >= 0 && padding < 230);
  request.builders[0].paths[request.builders[0].paths.length - 1] += 'x'.repeat(padding);
  assert.equal(size(), limit);
  const selections = {};
  for (const b of request.builders) {
    const path = prepared.workspaces.find(w => w.id === b.id).path;
    for (const name of b.paths) { assert.ok(Buffer.byteLength(name.split('/').at(-1)) < 256); writeFileSync(join(path, name), 'synthetic boundary output ' + b.id + '\n'); }
    const selection = { include: [...new Set([...sourceSelection.include, ...b.paths])].sort(), exclude: [] }; selections[b.id] = selection;
    const output = invoke(f, 'output', { builder: b.id, selection }); b.outputDigest = output.outputDigest; b.selectionDigest = output.selectionDigest;
  }
  assert.equal(size(), limit);
  const taskRefLength = JSON.stringify({ request, quiescence: 'caller-declared-not-verified' }).length;
  assert.ok(taskRefLength <= 4096, 'This must reproduce the taskRef-fits/resultRef-overflows distinction');
  const before = hashes(f, prepared, request, selections), journalBefore = journalHashes(f);
  assert.equal(existsSync(f.target), false); assert.equal(existsSync(join(f.repo, '.git/worktrees/task-combined')), false);
  let result, observed, rejected;
  if (limit === 4096) {
    invoke(f, 'plan', request); result = invoke(f, 'integrate', request); observed = invoke(f, 'observe');
    assert.equal(result.status, 'verified-awaiting-acceptance'); assert.equal(observed.candidate, result.candidate);
    const state = invoke(f, 'inspect'); assert.equal(state.revision, 4); assert.equal(state.attempts.at(-1).prepared.resultRef.length, 4096);
    for (const b of request.builders) for (const name of b.paths) assert.equal(readFileSync(join(f.target, name), 'utf8'), 'synthetic boundary output ' + b.id + '\n');
  } else {
    invoke(f, 'plan', request, /Graph preflight: resultRef/); rejected = invoke(f, 'integrate', request, /Graph preflight: resultRef/);
    assert.equal(invoke(f, 'inspect').revision, 2); assert.deepEqual(journalHashes(f), journalBefore);
    assert.equal(existsSync(f.target), false); assert.equal(existsSync(join(f.repo, '.git/worktrees/task-combined')), false);
  }
  const after = hashes(f, prepared, request, selections, result?.identity ?? null); assert.deepEqual(after, before);
  writeFileSync(join(f.parent, 'evidence.json'), JSON.stringify({ repo: f.repo, resultRefLength: limit, taskRefLength, before, after, journalBefore, journalAfter: journalHashes(f), result, observed, rejected,
    targetExists: existsSync(f.target), targetControlExists: existsSync(join(f.repo, '.git/worktrees/task-combined')) }, null, 2));
  console.log('Synthetic publication-budget evidence: ' + join(f.parent, 'evidence.json'));
});
fixtureTest('oversized preparation baselineRef is rejected before any coordination, graph or target mutation', () => {
  const f = fixture(), config = { builders: ['one', 'two', 'three'], target: 'combined', excludedPrefixes: [], selection: { include: [...sourceSelection.include], exclude: [] } };
  for (let i = 0; i < 22; i++) { const name = 'synthetic-' + i + '-' + 'x'.repeat(190); config.selection.include.push(name); writeFileSync(join(f.repo, name), 'synthetic oversized selection\n'); }
  assert.ok(JSON.stringify(config).length > 4096);
  const before = { index: hash(readFileSync(join(f.repo, '.git/index'))), files: config.selection.include.map(name => [name, hash(readFileSync(join(f.repo, name)))]) };
  invoke(f, 'prepare', config, /Graph preflight: baselineRef/);
  assert.equal(existsSync(join(f.repo, '.agent-work')), false); assert.equal(existsSync(join(f.repo, '.git/worktrees')), false);
  const after = { index: hash(readFileSync(join(f.repo, '.git/index'))), files: config.selection.include.map(name => [name, hash(readFileSync(join(f.repo, name)))]) }; assert.deepEqual(after, before);
  writeFileSync(join(f.parent, 'evidence.json'), JSON.stringify({ repo: f.repo, baselineRefLength: JSON.stringify(config).length, before, after, coordinationExists: existsSync(join(f.repo, '.agent-work')), controlsExist: existsSync(join(f.repo, '.git/worktrees')) }, null, 2));
  console.log('Synthetic preparation-budget evidence: ' + join(f.parent, 'evidence.json'));
});
