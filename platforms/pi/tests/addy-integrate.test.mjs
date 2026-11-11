import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, renameSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { initSyntheticGit } from './fixtures/synthetic-git.mjs';
import { integrateBuilders, prepareIntegration } from '../scripts/addy-integrate.mjs';

const root = fileURLToPath(new URL('../', import.meta.url)), suite = join(root, '.agent-work/integration-tests'); mkdirSync(suite, { recursive: true });
const cli = join(root, 'scripts/addy-integrate.mjs'), candidate = join(root, 'scripts/addy-candidate.mjs');
const flags = ['--authorize-local-integration', '--declare-inputs-quiescent'];
const options = { authorizeLocalIntegration: true, inputsQuiescent: true };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const version = spawnSync('/usr/bin/git', ['--version'], { encoding: 'utf8' });
const supported = process.platform === 'darwin' && version.status === 0 && version.stdout.trim() === 'git version 2.54.0 (Apple Git-157)';
const fixtureTest = (name, fn) => test(name, { skip: supported ? false : 'Requires tested Darwin / Apple Git runtime' }, fn);
function run(script, args, env) { return spawnSync(process.execPath, [script, ...args], { env, encoding: 'utf8', timeout: 120000, maxBuffer: 16 * 1024 * 1024 }); }
function ok(result) { assert.equal(result.status, 0, result.stderr); return JSON.parse(result.stdout); }
function invoke(f, action, value, expectedError) {
  const result = run(cli, [f.repo, action, f.task, ...(value === undefined ? [] : [JSON.stringify(value)]), ...flags], f.env);
  if (expectedError) { assert.notEqual(result.status, 0, result.stdout); assert.match(result.stderr, expectedError); return result; }
  return ok(result);
}
function fixture() {
  const parent = mkdtempSync(join(suite, 'synthetic-')), repo = join(parent, 'repo'); mkdirSync(repo);
  const env = { PATH: '/usr/bin:/bin', HOME: parent, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' };
  const initial = initSyntheticGit(repo, env);
  const git = (where, ...args) => execFileSync('/usr/bin/git', ['-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false', '-C', where, ...args], { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  writeFileSync(join(repo, 'README.md'), 'synthetic staged baseline\n'); git(repo, 'add', 'README.md'); writeFileSync(join(repo, 'README.md'), 'synthetic unstaged baseline\n');
  git(repo, 'update-index', '--force-remove', 'PLAN.md'); writeFileSync(join(repo, 'PLAN.md'), 'synthetic recreated after staged deletion\n');
  renameSync(join(repo, 'docs/roles-library.md'), join(parent, 'roles-retained'));
  writeFileSync(join(repo, 'staged-new'), 'synthetic baseline staged addition\n'); chmodSync(join(repo, 'staged-new'), 0o755); git(repo, 'add', 'staged-new'); chmodSync(join(repo, 'staged-new'), 0o644); writeFileSync(join(repo, 'staged-new'), 'synthetic baseline unstaged addition\n');
  writeFileSync(join(repo, 'staged-gone'), 'synthetic staged but missing\n'); git(repo, 'add', 'staged-gone'); renameSync(join(repo, 'staged-gone'), join(parent, 'gone-retained'));
  writeFileSync(join(repo, 'untracked-exec'), 'synthetic baseline executable\n'); chmodSync(join(repo, 'untracked-exec'), 0o755);
  mkdirSync(join(repo, 'excluded')); writeFileSync(join(repo, 'excluded/sentinel'), 'synthetic excluded sentinel\n');
  const selection = { include: ok(run(candidate, [repo, '--authorize-repository-control', '--authorize-excluded-prefixes', '--exclude-prefix', 'excluded', 'inventory'], env)).paths, exclude: [] };
  const config = { builders: ['one', 'two', 'three'], target: 'combined', excludedPrefixes: ['excluded'], selection };
  const task = 'integration', boundary = join(repo, '.agent-work/addy-coordination', task), target = join(repo, '.agent-work/linked-worktrees', task + '-combined');
  return { parent, repo, env, initial, git, selection, config, task, boundary, target };
}
function prepare(f) { f.prepared = invoke(f, 'prepare', f.config); f.builders = Object.fromEntries(f.prepared.workspaces.map(b => [b.id, b.path])); return f; }
function selection(f, where) {
  return { include: ok(run(candidate, [where, '--authorize-repository-control', '--authorize-coordination-artifacts', '--authorize-excluded-prefixes', '--exclude-prefix', 'excluded', '--authorize-linked-control', '--linked-project-root', f.repo, '--coordination', f.task, 'inventory'], f.env)).paths, exclude: [] };
}
function outputs(f, mutate) {
  if (mutate) mutate(f);
  else {
    const one = f.builders.one, two = f.builders.two, three = f.builders.three;
    writeFileSync(join(one, 'README.md'), 'synthetic one staged\n'); f.git(one, 'add', 'README.md'); writeFileSync(join(one, 'README.md'), 'synthetic one unstaged\n');
    writeFileSync(join(one, 'one-new'), 'synthetic one staged new\n'); f.git(one, 'add', 'one-new'); writeFileSync(join(one, 'one-new'), 'synthetic one unstaged new\n');
    renameSync(join(two, 'PLAN.md'), join(f.parent, 'two-plan-retained')); f.git(two, 'update-index', '--force-remove', '.gitignore'); renameSync(join(two, '.gitignore'), join(f.parent, 'two-ignore-retained'));
    writeFileSync(join(three, 'staged-new'), 'synthetic three staged\n'); f.git(three, 'add', 'staged-new'); writeFileSync(join(three, 'staged-new'), 'synthetic three unstaged\n'); chmodSync(join(three, 'staged-new'), 0o755);
    writeFileSync(join(three, 'three-exec'), 'synthetic three executable\n'); chmodSync(join(three, 'three-exec'), 0o755);
  }
  const paths = { one: ['README.md', 'one-new'], two: ['.gitignore', 'PLAN.md'], three: ['staged-new', 'three-exec'] };
  f.request = { attempt: 'integrate-1', builders: f.config.builders.map(builder => ({ ...invoke(f, 'output', { builder, selection: selection(f, f.builders[builder]) }), paths: paths[builder] })) };
  return f;
}
function sourceEvidence(f) {
  const boundaryFlags = [...f.prepared.builders.map(b => ['--nested-linked', '.agent-work/linked-worktrees/' + b.control + '=' + b.control]).flat(), '--nested-linked', '.agent-work/linked-worktrees/integration-combined=integration-combined'];
  const inv = ok(run(candidate, [f.repo, '--authorize-repository-control', '--authorize-coordination-artifacts', '--authorize-excluded-prefixes', '--exclude-prefix', 'excluded', '--authorize-nested-linked-controls', ...boundaryFlags, '--coordination', f.task, 'inventory'], f.env));
  const expected = inv.nestedLinkedBoundaries.flatMap(b => b.present ? ['--expected-nested-identity', b.path + '=' + b.identity] : ['--expect-nested-absent', b.path]);
  return ok(run(candidate, [f.repo, '--authorize-repository-control', '--authorize-coordination-artifacts', '--authorize-excluded-prefixes', '--exclude-prefix', 'excluded', '--authorize-nested-linked-controls', ...boundaryFlags, ...expected, '--coordination', f.task, 'verify', join(f.boundary, 'selection.json'), f.prepared.ownerDigest], f.env));
}
function currentHashes(f) {
  const result = { source: sourceEvidence(f).digest, sourceIndex: hash(readFileSync(join(f.repo, '.git/index'))), builders: {} };
  for (const b of f.request.builders) {
    const path = f.builders[b.id], selectionPath = join(path, '.agent-work/addy-coordination', f.task, 'selections', b.selectionDigest + '.json');
    // CLI candidate verification requires legacy selection.json. Integration's
    // plan command verifies retained output selections without replacing it.
    result.builders[b.id] = { output: b.outputDigest, selection: hash(Buffer.from(JSON.stringify(JSON.parse(readFileSync(selectionPath, 'utf8'))))), index: hash(readFileSync(join(f.repo, '.git/worktrees', 'integration-' + b.id, 'index'))) };
  }
  invoke(f, 'plan', f.request); return result;
}
fixtureTest('normal CLI integrates three independent builders from a dirty baseline and re-observes without input mutation', () => {
  const f = outputs(prepare(fixture())), before = currentHashes(f), plan = invoke(f, 'plan', f.request), result = invoke(f, 'integrate', f.request);
  assert.equal(result.status, 'verified-awaiting-acceptance'); assert.equal(plan.changes.length, 6);
  assert.equal(readFileSync(join(f.target, 'README.md'), 'utf8'), 'synthetic one unstaged\n'); assert.equal(f.git(f.target, 'show', ':README.md'), 'synthetic one staged');
  assert.equal(readFileSync(join(f.target, 'one-new'), 'utf8'), 'synthetic one unstaged new\n'); assert.equal(f.git(f.target, 'show', ':one-new'), 'synthetic one staged new');
  assert.equal(existsSync(join(f.target, 'PLAN.md')), false); assert.equal(existsSync(join(f.target, '.gitignore')), false); assert.equal(f.git(f.target, 'ls-files', '--', 'PLAN.md', '.gitignore'), '');
  assert.equal(existsSync(join(f.target, 'docs/roles-library.md')), false); assert.equal(existsSync(join(f.target, 'staged-gone')), false); assert.equal(f.git(f.target, 'show', ':staged-gone'), 'synthetic staged but missing');
  assert.equal(readFileSync(join(f.target, 'staged-new'), 'utf8'), 'synthetic three unstaged\n'); assert.equal(f.git(f.target, 'show', ':staged-new'), 'synthetic three staged');
  for (const path of ['staged-new', 'three-exec', 'untracked-exec']) assert.equal(lstatSync(join(f.target, path)).mode & 0o777, 0o755);
  assert.equal(existsSync(join(f.target, 'excluded')), false); assert.equal(readFileSync(join(f.repo, 'excluded/sentinel'), 'utf8'), 'synthetic excluded sentinel\n');
  assert.equal(f.git(f.target, 'rev-parse', 'HEAD'), f.initial); assert.equal(f.git(f.repo, 'rev-parse', 'HEAD'), f.initial);
  const observed = invoke(f, 'observe'); assert.equal(observed.candidate, result.candidate);
  // Plan requires an absent target; observe performs the same input verification
  // after materialization and must return the original owner/output digests.
  const after = { source: sourceEvidence(f).digest, sourceIndex: hash(readFileSync(join(f.repo, '.git/index'))), builders: {} };
  for (const b of f.request.builders) after.builders[b.id] = { output: observed.request.builders.find(x => x.id === b.id).outputDigest, selection: b.selectionDigest, index: hash(readFileSync(join(f.repo, '.git/worktrees', 'integration-' + b.id, 'index'))) };
  assert.deepEqual(after, before);
  const state = invoke(f, 'inspect'); assert.equal(state.attempts.at(-1).status, 'running'); assert.equal(state.attempts.at(-1).prepared.candidate, result.candidate);
  invoke(f, 'integrate', f.request, /boundary|exists|stale/i);
  writeFileSync(join(f.parent, 'evidence.json'), JSON.stringify({ repo: f.repo, before, after, plan, result, observed, state }, null, 2));
  console.log('Synthetic normal-CLI evidence: ' + join(f.parent, 'evidence.json'));
});
fixtureTest('conflicting builder changes and undeclared paths fail before intent', () => {
  const f = prepare(fixture());
  for (const name of f.config.builders) writeFileSync(join(f.builders[name], 'README.md'), 'synthetic conflict ' + name + '\n');
  outputs(f, () => {}); for (const b of f.request.builders) b.paths = ['README.md'];
  invoke(f, 'plan', f.request, /overlapping/i); invoke(f, 'integrate', f.request, /overlapping/i);
  const undeclared = structuredClone(f.request); undeclared.builders[0].paths = [];
  invoke(f, 'integrate', undeclared, /undeclared/i);
  assert.equal(invoke(f, 'inspect').revision, 2); assert.equal(existsSync(f.target), false);
});
fixtureTest('stale source, output, prepared evidence, selection and identity are rejected', () => {
  const f = outputs(prepare(fixture())), first = f.request.builders[0], path = join(f.builders.one, 'README.md'), old = readFileSync(path);
  writeFileSync(path, 'synthetic stale output\n'); invoke(f, 'integrate', f.request, /digest mismatch/i); writeFileSync(path, old);
  writeFileSync(join(f.builders.one, 'undeclared-output'), 'synthetic unselected\n'); invoke(f, 'integrate', f.request, /exactly all inventoried/i); renameSync(join(f.builders.one, 'undeclared-output'), join(f.parent, 'unselected-retained'));
  const source = join(f.repo, 'README.md'), oldSource = readFileSync(source); writeFileSync(source, 'synthetic stale source\n'); invoke(f, 'integrate', f.request, /digest mismatch/i); writeFileSync(source, oldSource);
  const wrong = structuredClone(f.request); wrong.builders[0].preparedDigest = '0'.repeat(64); invoke(f, 'integrate', wrong, /prepared builder identity/i);
  const missing = structuredClone(f.request); missing.builders[0].selectionDigest = '0'.repeat(64); invoke(f, 'integrate', missing, /ENOENT/);
  const retained = join(f.builders.one, '.agent-work/addy-coordination', f.task, 'manifests', first.preparedDigest + '.json'), raw = readFileSync(retained);
  const corrupt = JSON.parse(raw); corrupt.manifest.worktree[0].sha256 = '0'.repeat(64); writeFileSync(retained, JSON.stringify(corrupt)); invoke(f, 'integrate', f.request, /invalid coordination manifest/i); writeFileSync(retained, raw);
  const pointer = join(f.builders.one, '.git'); renameSync(pointer, join(f.parent, 'one-git-pointer-retained')); writeFileSync(pointer, 'synthetic invalid pointer\n'); invoke(f, 'integrate', f.request, /linked|pointer|control|gitdir/i);
  assert.equal(existsSync(f.target), false);
});
fixtureTest('unsupported dependent builders, symlinks and index flags fail closed', () => {
  const f = outputs(prepare(fixture())), dependent = structuredClone(f.request); dependent.builders[0].dependencies = ['two'];
  invoke(f, 'integrate', dependent, /dependencies/i);
  f.git(f.builders.one, 'update-index', '--skip-worktree', 'README.md'); invoke(f, 'integrate', f.request, /index flags/i);
  const g = prepare(fixture()); symlinkSync('synthetic-target', join(g.builders.one, 'symlink'));
  const captured = invoke(g, 'output', { builder: 'one', selection: selection(g, g.builders.one) });
  assert.ok(captured.outputDigest); // capture may describe unsupported integration states
  const noChanges = ['two', 'three'].map(builder => ({ ...invoke(g, 'output', { builder, selection: selection(g, g.builders[builder]) }), paths: [] }));
  invoke(g, 'integrate', { attempt: 'bad-link', builders: [{ ...captured, paths: ['symlink'] }, ...noChanges] }, /unsupported/i);
  assert.equal(existsSync(g.target), false);
});
fixtureTest('preexisting targets and omitted quiescence/authorization preserve sentinels', () => {
  const f = outputs(prepare(fixture())); mkdirSync(f.target); writeFileSync(join(f.target, 'sentinel'), 'synthetic preserve\n');
  invoke(f, 'integrate', f.request, /linked|git|control|boundary/i); assert.equal(readFileSync(join(f.target, 'sentinel'), 'utf8'), 'synthetic preserve\n');
  for (const kept of [[], flags.slice(0, 1), flags.slice(1)]) {
    const result = run(cli, ['/not-a-real-repo', 'integrate', 'task', '{}', ...kept], f.env); assert.notEqual(result.status, 0); assert.match(result.stderr, /required/i);
  }
  assert.equal(invoke(f, 'inspect').revision, 2);
});
for (const phase of ['afterIntent', 'afterWorktree', 'afterIndex', 'afterFirstFile', 'beforeVerification', 'beforePublication']) fixtureTest(`interruption ${phase} retains journal/target and CLI reconciliation never replays or deletes`, () => {
  const f = outputs(prepare(fixture())), before = currentHashes(f);
  assert.throws(() => integrateBuilders(f.repo, f.task, f.request, options, { [phase]: () => { throw Error('synthetic interruption'); } }), /synthetic interruption/);
  const state = invoke(f, 'inspect'); assert.equal(state.revision, 3); assert.equal(state.attempts.at(-1).status, 'running');
  invoke(f, 'integrate', f.request, /unresolved|boundary|exists|already used/i); invoke(f, 'observe', undefined, /no prepared integration/i);
  const filesBefore = existsSync(f.target) ? f.git(f.target, 'ls-files', '--stage') : null;
  invoke(f, 'reconcile', { attempt: 'integrate-1', expectedRevision: 3, outcome: 'abandoned', note: 'Synthetic operator inspected retained attempt; no cleanup or resume authorized.' });
  assert.equal(invoke(f, 'inspect').attempts.at(-1).status, 'abandoned'); assert.equal(existsSync(f.target), phase !== 'afterIntent');
  if (filesBefore !== null) assert.equal(f.git(f.target, 'ls-files', '--stage'), filesBefore);
  invoke(f, 'integrate', f.request, /boundary|exists|already used/i);
  assert.equal(sourceEvidence(f).digest, before.source); assert.equal(hash(readFileSync(join(f.repo, '.git/index'))), before.sourceIndex);
});
fixtureTest('preparation interruption is inspectable and cannot be adopted or replayed', () => {
  const f = fixture(); assert.throws(() => prepareIntegration(f.repo, f.task, f.config, options, { afterFirstFile: () => { throw Error('synthetic preparation interruption'); } }), /synthetic preparation interruption/);
  const state = invoke(f, 'inspect'); assert.equal(state.attempts[0].status, 'running'); assert.equal(existsSync(join(f.repo, '.agent-work/linked-worktrees/integration-one')), true);
  invoke(f, 'prepare', f.config, /exists/i); invoke(f, 'output', { builder: 'one', selection: f.selection }, /unresolved/i);
  invoke(f, 'reconcile', { attempt: 'prepare', expectedRevision: 1, outcome: 'failed', note: 'Synthetic partial preparation retained. Use a fresh project/task after inspection.' });
  assert.equal(existsSync(join(f.repo, '.agent-work/linked-worktrees/integration-one')), true);
});
fixtureTest('preparation rechecks earlier builder candidates before publishing the complete prepared set', () => {
  const f = fixture(); let created = 0;
  assert.throws(() => prepareIntegration(f.repo, f.task, f.config, options, { afterFirstFile: () => {
    if (++created === 3) writeFileSync(join(f.repo, '.agent-work/linked-worktrees/integration-one/README.md'), 'synthetic earlier prepared builder drift\n');
  } }), /digest mismatch/i);
  const state = invoke(f, 'inspect'); assert.equal(state.revision, 1); assert.equal(state.attempts[0].status, 'running'); assert.equal(state.attempts[0].prepared, undefined);
});
fixtureTest('drift during integration and after publication never produces a false observation', () => {
  for (const side of ['source', 'builder', 'target']) {
    const f = outputs(prepare(fixture()));
    assert.throws(() => integrateBuilders(f.repo, f.task, f.request, options, { beforePublication: () => writeFileSync(join(side === 'source' ? f.repo : side === 'builder' ? f.builders.one : f.target, 'README.md'), 'synthetic drift\n') }), /digest mismatch/i);
    assert.equal(invoke(f, 'inspect').attempts.at(-1).prepared, undefined);
  }
  const f = outputs(prepare(fixture())); invoke(f, 'integrate', f.request); writeFileSync(join(f.target, 'README.md'), 'synthetic post-publication drift\n'); invoke(f, 'observe', undefined, /digest mismatch/i);
});
