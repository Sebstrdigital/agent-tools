import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, renameSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { initSyntheticGit } from './fixtures/synthetic-git.mjs';
import { captureRetainedCandidate, initCoordination, inventoryCandidate, readRetainedCandidateEvidence, retainCandidateSelection, verifyCandidate } from '../scripts/addy-candidate.mjs';
import { executeGraph } from '../scripts/addy-graph.mjs';
import { materializeCandidate } from '../scripts/addy-materialize.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const candidate = join(root, 'scripts/addy-candidate.mjs'), cli = join(root, 'scripts/addy-materialize.mjs');
const grantNames = ['sourceContent', 'repositoryControl', 'coordinationArtifacts', 'journalWrite', 'nestedControls', 'linkedControl', 'worktreeCreate', 'targetContent', 'targetWrite', 'targetCoordination', 'metadataExclusionsAccepted', 'excludedPrefixes'];
const grants = Object.fromEntries(grantNames.map(name => [name, true]));
const flags = ['--authorize-source-content', '--authorize-repository-control', '--authorize-coordination-artifacts', '--authorize-journal-write', '--authorize-nested-controls', '--authorize-linked-control', '--authorize-worktree-create', '--authorize-target-content', '--authorize-target-write', '--authorize-target-coordination', '--accept-metadata-exclusions', '--authorize-excluded-prefixes', '--exclude-prefix', 'excluded'];
const version = spawnSync('/usr/bin/git', ['--version'], { encoding: 'utf8', env: { PATH: '/usr/bin:/bin' } });
const supported = process.platform === 'darwin' && version.status === 0 && version.stdout.trim() === 'git version 2.54.0 (Apple Git-157)';
const fixtureTest = (name, fn) => test(name, { skip: supported ? false : 'Synthetic prefix mode requires the supported macOS/Git runtime' }, fn);
function fixture({ dirty = false, setup, prefix = true, existing = [] } = {}) {
  const parent = mkdtempSync(join(root, '.agent-work/parallel-addy/materialize-test-')), repo = join(parent, 'repo'); mkdirSync(repo);
  const env = { PATH: '/usr/bin:/bin', HOME: parent, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' };
  const initial = initSyntheticGit(repo, env), git = (...args) => execFileSync('git', ['-c', 'core.hooksPath=/dev/null', '-C', repo, ...args], { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  if (prefix) { mkdirSync(join(repo, 'excluded')); writeFileSync(join(repo, 'excluded', 'secret'), 'synthetic excluded'); }
  mkdirSync(join(repo, '.git/info'), { recursive: true }); writeFileSync(join(repo, '.git/info/exclude'), 'excluded/\n');
  if (dirty) {
    writeFileSync(join(repo, 'README.md'), 'staged fixture\n'); git('add', 'README.md'); writeFileSync(join(repo, 'README.md'), 'unstaged fixture\n');
    renameSync(join(repo, 'PLAN.md'), join(parent, 'plan-retained')); git('add', '-u', 'PLAN.md'); writeFileSync(join(repo, 'PLAN.md'), 'recreated after staged deletion\n');
    renameSync(join(repo, '.gitignore'), join(parent, 'ignore-retained')); git('add', '-u', '.gitignore');
    renameSync(join(repo, 'docs/roles-library.md'), join(parent, 'roles-retained'));
    writeFileSync(join(repo, 'staged-new'), 'staged addition\n'); chmodSync(join(repo, 'staged-new'), 0o755); git('add', 'staged-new'); chmodSync(join(repo, 'staged-new'), 0o644); writeFileSync(join(repo, 'staged-new'), 'unstaged addition edit\n');
    writeFileSync(join(repo, 'staged-gone'), 'staged but missing\n'); git('add', 'staged-gone'); renameSync(join(repo, 'staged-gone'), join(parent, 'staged-retained'));
    writeFileSync(join(repo, 'untracked-exec'), 'synthetic executable\n'); chmodSync(join(repo, 'untracked-exec'), 0o755);
  }
  setup?.({ repo, parent, git });
  if (existing.length) {
    mkdirSync(join(repo, '.agent-work/linked-worktrees'), { recursive: true });
    for (const name of existing) git('worktree', 'add', '--detach', '--no-checkout', join(repo, '.agent-work/linked-worktrees', name), initial);
  }
  const task = 'task', controlId = 'builder', rel = '.agent-work/linked-worktrees/' + controlId, boundary = join(repo, '.agent-work/addy-coordination', task);
  initCoordination(repo, task, { authorizeRepositoryControl: true, authorizeCoordinationArtifacts: true });
  const source = { authorizeRepositoryControl: true, authorizeCoordinationArtifacts: true, authorizeNestedLinkedControls: true, coordination: task,
    nestedLinked: [{ path: rel, controlId }, ...existing.map(name => ({ path: '.agent-work/linked-worktrees/' + name, controlId: name }))], ...(prefix ? { authorizeExcludedPrefixes: true, excludedPrefixes: ['excluded'] } : {}) };
  const inv = inventoryCandidate(repo, source), additional = existing.map(name => {
    const path = '.agent-work/linked-worktrees/' + name, found = inv.nestedLinkedBoundaries.find(x => x.path === path);
    return { path, controlId: name, identity: found.identity };
  }), selection = { include: inv.paths, exclude: [] }, selectionPath = join(boundary, 'selection.json');
  writeFileSync(selectionPath, JSON.stringify(selection));
  const sourceFlags = ['--authorize-repository-control', '--authorize-coordination-artifacts', '--authorize-nested-linked-controls', '--nested-linked', rel + '=builder', ...existing.flatMap(name => ['--nested-linked', '.agent-work/linked-worktrees/' + name + '=' + name]), ...(prefix ? ['--authorize-excluded-prefixes', '--exclude-prefix', 'excluded'] : []), '--coordination', task];
  const captured = spawnSync(process.execPath, [candidate, repo, ...sourceFlags, 'capture', selectionPath, '--write-manifest'], { env, encoding: 'utf8' });
  assert.equal(captured.status, 0, captured.stderr); const digest = JSON.parse(captured.stdout).digest;
  executeGraph(repo, boundary, 'graph', 'init', { op: 'init', baseline: digest, baselineRef: 'synthetic', slices: [{ id: 'materialize', depends: [] }] });
  const request = { project: repo, task, attempt: 'attempt-1', controlId, expectedDigest: digest, graphRevision: 0, excludedPrefixes: prefix ? ['excluded'] : [], additionalBoundaries: additional, grants };
  return { parent, repo, initial, env, git, task, controlId, rel, boundary, source, selection, digest, request, additional, target: join(repo, rel) };
}
fixtureTest('normal CLI preserves staged, unstaged, deleted, added and executable state without excluded reads or source mutation', () => {
  const f = fixture({ dirty: true }), sourceIndex = readFileSync(join(f.repo, '.git/index'));
  const args = [cli, f.repo, f.task, f.request.attempt, f.controlId, f.digest, '0', ...flags];
  let command = process.execPath, commandArgs = args;
  if (existsSync('/usr/bin/sandbox-exec')) {
    const dir = join(f.repo, 'excluded'), pattern = '^' + dir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '/';
    const profile = `(version 1)(allow default)(deny file-read-data (subpath ${JSON.stringify(dir)}))(deny file-read-metadata (regex #${JSON.stringify(pattern)}))`;
    command = '/usr/bin/sandbox-exec'; commandArgs = ['-p', profile, process.execPath, ...args];
  }
  const r = spawnSync(command, commandArgs, { env: f.env, encoding: 'utf8', timeout: 120000 });
  assert.equal(r.status, 0, r.stderr); const result = JSON.parse(r.stdout); assert.equal(result.status, 'verified-awaiting-acceptance'); assert.match(result.scope, /^partial:/);
  assert.equal(existsSync(join(f.target, 'excluded')), false); assert.deepEqual(readFileSync(join(f.repo, '.git/index')), sourceIndex);
  assert.equal(readFileSync(join(f.target, 'README.md'), 'utf8'), 'unstaged fixture\n');
  assert.equal(readFileSync(join(f.target, 'staged-new'), 'utf8'), 'unstaged addition edit\n');
  assert.equal(lstatSync(join(f.target, 'untracked-exec')).mode & 0o777, 0o755);
  assert.equal(readFileSync(join(f.target, 'PLAN.md'), 'utf8'), 'recreated after staged deletion\n'); assert.equal(existsSync(join(f.target, '.gitignore')), false);
  assert.equal(existsSync(join(f.target, 'docs/roles-library.md')), false); assert.equal(existsSync(join(f.target, 'staged-gone')), false);
  assert.equal(f.git('-C', f.target, 'show', ':README.md'), 'staged fixture'); assert.equal(f.git('-C', f.target, 'show', ':staged-new'), 'staged addition');
  assert.equal(f.git('-C', f.target, 'show', ':staged-gone'), 'staged but missing');
  assert.match(f.git('-C', f.target, 'ls-files', '--stage', '--', 'staged-new'), /^100755 /); assert.equal(lstatSync(join(f.target, 'staged-new')).mode & 0o777, 0o644);
  assert.equal(f.git('-C', f.target, 'ls-files', '--stage', '--', 'PLAN.md'), ''); assert.equal(f.git('-C', f.target, 'ls-files', '--stage', '--', '.gitignore'), '');
  const nested = inventoryCandidate(f.repo, f.source).nestedLinkedBoundaries[0];
  verifyCandidate(f.repo, f.selection, f.digest, { ...f.source, expectedNestedIdentities: [{ path: f.rel, identity: nested.identity }] });
  const graph = executeGraph(f.repo, f.boundary, 'graph', 'inspect'); assert.equal(graph.attempts[0].status, 'running'); assert.equal(graph.slices[0].ready, false);
  assert.deepEqual(graph.attempts[0].prepared, { candidate: result.linkedDigest, evidence: result.evidenceDigest, resultRef: result.resultRef });
  executeGraph(f.repo, f.boundary, 'graph', 'apply', { op: 'finish', expected: result.graphRevision, attempt: result.attempt, candidate: result.linkedDigest, evidence: result.evidenceDigest, resultRef: result.resultRef });
  assert.equal(executeGraph(f.repo, f.boundary, 'graph', 'inspect').attempts[0].status, 'completed');
});
fixtureTest('CLI materializes beside all declared linked boundaries without changing their identities', () => {
  const f = fixture({ dirty: true, existing: ['alpha', 'omega'] }), beforeIndex = readFileSync(join(f.repo, '.git/index'));
  const extra = f.additional.flatMap(x => ['--existing-linked', x.controlId + '=' + x.identity]);
  const result = spawnSync(process.execPath, [cli, f.repo, f.task, f.request.attempt, f.controlId, f.digest, '0', ...flags, ...extra], { env: f.env, encoding: 'utf8', timeout: 120000 });
  assert.equal(result.status, 0, result.stderr); const output = JSON.parse(result.stdout);
  assert.equal(output.status, 'verified-awaiting-acceptance'); assert.deepEqual(output.additionalBoundaries, f.additional);
  assert.deepEqual(readFileSync(join(f.repo, '.git/index')), beforeIndex);
  const state = inventoryCandidate(f.repo, f.source).nestedLinkedBoundaries;
  for (const boundary of f.additional) assert.equal(state.find(x => x.path === boundary.path).identity, boundary.identity);
  assert.equal(readFileSync(join(f.target, 'README.md'), 'utf8'), 'unstaged fixture\n');
});
fixtureTest('additional boundary declarations reject stale, missing and duplicate identities before intent', () => {
  const f = fixture({ existing: ['alpha', 'omega'] });
  for (const extra of [f.additional.slice(0, 1), [{ ...f.additional[0], identity: '0'.repeat(64) }, f.additional[1]], [f.additional[0], f.additional[0]]]) {
    assert.throws(() => materializeCandidate({ ...f.request, additionalBoundaries: extra }), /boundary|repository/i);
    assert.equal(executeGraph(f.repo, f.boundary, 'graph', 'inspect').revision, 0); assert.equal(existsSync(f.target), false);
  }
});
fixtureTest('additional boundary identities are retained in intent before any target creation', () => {
  const f = fixture({ existing: ['alpha', 'omega'] });
  assert.throws(() => materializeCandidate(f.request, { afterIntent: () => { throw Error('synthetic interruption'); } }), /synthetic interruption/);
  const attempt = executeGraph(f.repo, f.boundary, 'graph', 'inspect').attempts[0];
  assert.equal(attempt.status, 'running'); assert.deepEqual(JSON.parse(attempt.taskRef).additionalBoundaries, f.additional); assert.equal(existsSync(f.target), false);
});
fixtureTest('additional linked-control drift after target creation leaves unresolved intent', () => {
  const f = fixture({ existing: ['alpha'] });
  assert.throws(() => materializeCandidate(f.request, { afterWorktree: () => writeFileSync(join(f.repo, '.agent-work/linked-worktrees/alpha/.git'), 'synthetic drift\n') }), /linked|control|gitdir/i);
  assert.equal(executeGraph(f.repo, f.boundary, 'graph', 'inspect').attempts[0].status, 'running'); assert.equal(existsSync(f.target), true);
});
fixtureTest('fresh output selections and manifests retain explicit new paths without replacing the prepared baseline', () => {
  const f = fixture(), oldSelection = readFileSync(join(f.boundary, 'selection.json')), oldManifest = readFileSync(join(f.boundary, 'manifests', f.digest + '.json'));
  writeFileSync(join(f.repo, 'new-output'), 'synthetic output\n');
  assert.throws(() => retainCandidateSelection(f.repo, f.selection, f.source), /explicitly include or exclude/);
  assert.throws(() => retainCandidateSelection(f.repo, { include: [...f.selection.include, 'excluded/private'], exclude: [] }, f.source), /excluded prefix/);
  const selected = { include: inventoryCandidate(f.repo, f.source).paths, exclude: [] };
  const retained = retainCandidateSelection(f.repo, selected, f.source);
  assert.deepEqual(JSON.parse(readFileSync(join(f.boundary, retained.path), 'utf8')), selected);
  assert.throws(() => retainCandidateSelection(f.repo, selected, f.source), /EEXIST/);
  const result = captureRetainedCandidate(f.repo, selected, f.source); assert.notEqual(result.digest, f.digest);
  assert.equal(verifyCandidate(f.repo, selected, result.digest, { ...f.source, expectedNestedIdentities: [{ path: f.rel, identity: null }] }).digest, result.digest);
  assert.throws(() => captureRetainedCandidate(f.repo, selected, f.source), /EEXIST/);
  assert.deepEqual(readFileSync(join(f.boundary, 'selection.json')), oldSelection); assert.deepEqual(readFileSync(join(f.boundary, 'manifests', f.digest + '.json')), oldManifest);
});
fixtureTest('linked worker output retains new explicitly selected paths separately from its prepared manifest', () => {
  const f = fixture(), prepared = materializeCandidate(f.request), workerBoundary = join(f.target, '.agent-work/addy-coordination', f.task);
  const oldSelection = readFileSync(join(workerBoundary, 'selection.json')), oldManifest = readFileSync(join(workerBoundary, 'manifests', prepared.linkedDigest + '.json'));
  writeFileSync(join(f.target, 'new-worker-output'), 'synthetic worker output\n');
  const options = { authorizeRepositoryControl: true, authorizeCoordinationArtifacts: true, authorizeLinkedControl: true, linkedProjectRoot: f.repo, coordination: f.task, authorizeExcludedPrefixes: true, excludedPrefixes: ['excluded'] };
  const selected = { include: inventoryCandidate(f.target, options).paths, exclude: [] };
  const selectionRef = retainCandidateSelection(f.target, selected, options), output = captureRetainedCandidate(f.target, selected, options);
  assert.notEqual(output.digest, prepared.linkedDigest); assert.equal(verifyCandidate(f.target, selected, output.digest, options).digest, output.digest);
  assert.equal(readRetainedCandidateEvidence(f.target, 'manifest', prepared.linkedDigest, options).digest, prepared.linkedDigest);
  assert.equal(readRetainedCandidateEvidence(f.target, 'manifest', output.digest, options).digest, output.digest);
  assert.deepEqual(readRetainedCandidateEvidence(f.target, 'selection', selectionRef.digest, options), selected);
  assert.deepEqual(JSON.parse(readFileSync(join(workerBoundary, selectionRef.path), 'utf8')), selected);
  assert.deepEqual(readFileSync(join(workerBoundary, 'selection.json')), oldSelection); assert.deepEqual(readFileSync(join(workerBoundary, 'manifests', prepared.linkedDigest + '.json')), oldManifest);
});
fixtureTest('normal CLI does not run configured hooks, filters or fsmonitor subprocesses', () => {
  const f = fixture({ setup: ({ repo }) => {
    writeFileSync(join(repo, '.gitattributes'), 'README.md filter=sentinel\n');
    mkdirSync(join(repo, '.git/hooks'));
    const hook = join(repo, '.git/hooks/post-checkout'); writeFileSync(hook, '#!/bin/sh\nprintf hit > "$SENTINEL_HOOK"\n'); chmodSync(hook, 0o755);
  } });
  const filter = join(f.parent, 'synthetic-filter'), monitor = join(f.parent, 'synthetic-monitor'), config = join(f.parent, 'synthetic-gitconfig');
  writeFileSync(filter, '#!/bin/sh\nprintf hit > "$SENTINEL_FILTER"\n/bin/cat\n'); chmodSync(filter, 0o755);
  writeFileSync(monitor, '#!/bin/sh\nprintf hit > "$SENTINEL_MONITOR"\nprintf "token\\0"\n'); chmodSync(monitor, 0o755);
  writeFileSync(config, `[filter "sentinel"]\n smudge = ${filter}\n clean = ${filter}\n required = true\n[core]\n fsmonitor = ${monitor}\n`);
  const positive = { ...f.env, GIT_OPTIONAL_LOCKS: '0', GIT_CONFIG_GLOBAL: config, SENTINEL_HOOK: join(f.parent, 'positive-hook'), SENTINEL_FILTER: join(f.parent, 'positive-filter'), SENTINEL_MONITOR: join(f.parent, 'positive-monitor') };
  execFileSync('git', ['-C', f.repo, 'hook', 'run', 'post-checkout', '--', '0', '0', '1'], { env: positive });
  execFileSync('git', ['-C', f.repo, 'cat-file', '--filters', 'HEAD:README.md'], { env: positive });
  execFileSync('git', ['-C', f.repo, 'status', '--porcelain'], { env: positive });
  for (const name of ['HOOK', 'FILTER', 'MONITOR']) assert.equal(existsSync(positive['SENTINEL_' + name]), true, 'positive control ' + name);
  const negative = { ...positive, SENTINEL_HOOK: join(f.parent, 'negative-hook'), SENTINEL_FILTER: join(f.parent, 'negative-filter'), SENTINEL_MONITOR: join(f.parent, 'negative-monitor') };
  const result = spawnSync(process.execPath, [cli, f.repo, f.task, f.request.attempt, f.controlId, f.digest, '0', ...flags], { env: negative, encoding: 'utf8', timeout: 120000 });
  assert.equal(result.status, 0, result.stderr); assert.equal(JSON.parse(result.stdout).status, 'verified-awaiting-acceptance');
  for (const name of ['HOOK', 'FILTER', 'MONITOR']) assert.equal(existsSync(negative['SENTINEL_' + name]), false, 'unexpected subprocess ' + name);
});
fixtureTest('local hook, filter and fsmonitor configuration is rejected before materialization', () => {
  for (const key of ['core.hooksPath', 'filter.sentinel.smudge', 'core.fsmonitor']) {
    const f = fixture(), sentinel = join(f.parent, 'configured-effect'), script = join(f.parent, 'configured-command');
    writeFileSync(script, `#!/bin/sh\nprintf hit > "${sentinel}"\n`); chmodSync(script, 0o755);
    f.git('config', '--local', key, script);
    assert.throws(() => materializeCandidate(f.request), /unsupported/i, key);
    assert.equal(existsSync(sentinel), false); assert.equal(existsSync(f.target), false);
    assert.equal(executeGraph(f.repo, f.boundary, 'graph', 'inspect').revision, 0);
  }
});
fixtureTest('no-prefix CLI rejects an unsupported runtime before materialization', () => {
  const f = fixture({ prefix: false }), loader = join(f.parent, 'synthetic-platform.mjs');
  writeFileSync(loader, `Object.defineProperty(process, 'platform', { value: 'linux' });`);
  const noPrefixFlags = flags.slice(0, -3);
  const r = spawnSync(process.execPath, ['--import', loader, cli, f.repo, f.task, f.request.attempt, f.controlId, f.digest, '0', ...noPrefixFlags], { env: f.env, encoding: 'utf8' });
  assert.notEqual(r.status, 0); assert.match(r.stderr, /Unsupported materialization runtime/);
  const bin = join(f.parent, 'synthetic-bin'); mkdirSync(bin); writeFileSync(join(bin, 'git'), '#!/bin/sh\nprintf "git version 0.0-synthetic\\n"\n'); chmodSync(join(bin, 'git'), 0o755);
  const badGit = spawnSync(process.execPath, [cli, f.repo, f.task, f.request.attempt, f.controlId, f.digest, '0', ...noPrefixFlags], { env: { ...f.env, PATH: `${bin}:/usr/bin:/bin` }, encoding: 'utf8' });
  assert.notEqual(badGit.status, 0); assert.match(badGit.stderr, /Unsupported materialization runtime/);
  assert.equal(existsSync(f.target), false); assert.equal(executeGraph(f.repo, f.boundary, 'graph', 'inspect').revision, 0);
});
fixtureTest('an empty staged index retains staged deletions and recreated worktree files', () => {
  const f = fixture({ setup: ({ git }) => git('rm', '-r', '--cached', '.') });
  const result = materializeCandidate(f.request); assert.equal(result.status, 'verified-awaiting-acceptance');
  assert.equal(execFileSync('git', ['-C', f.target, 'ls-files', '--stage'], { env: f.env, encoding: 'utf8' }), '');
  assert.equal(readFileSync(join(f.target, 'README.md'), 'utf8'), 'synthetic readme\n');
});
fixtureTest('materialization without prefix exclusions preserves the legacy comparison path', () => {
  const f = fixture({ prefix: false }); const result = materializeCandidate(f.request);
  assert.equal(result.status, 'verified-awaiting-acceptance'); assert.equal(readFileSync(join(f.target, 'README.md'), 'utf8'), 'synthetic readme\n');
  assert.equal(executeGraph(f.repo, f.boundary, 'graph', 'inspect').attempts[0].status, 'running');
});
fixtureTest('authorization and preexisting target fail before intent or target mutation', () => {
  assert.throws(() => materializeCandidate({ project: '/no-access', grants: {} }), /grants required/);
  const f = fixture(); mkdirSync(join(f.repo, '.agent-work/linked-worktrees'), { recursive: true }); mkdirSync(f.target); writeFileSync(join(f.target, 'sentinel'), 'keep');
  assert.throws(() => materializeCandidate(f.request), /linked|control|target/i);
  assert.equal(readFileSync(join(f.target, 'sentinel'), 'utf8'), 'keep'); assert.equal(executeGraph(f.repo, f.boundary, 'graph', 'inspect').revision, 0);
});
for (const phase of ['afterIntent', 'afterWorktree', 'afterIndex', 'afterFirstFile', 'beforeVerification', 'beforeFinish']) fixtureTest(`interruption at ${phase} retains unresolved intent and forbids replay`, () => {
  const f = fixture({ dirty: true });
  assert.throws(() => materializeCandidate(f.request, { [phase]: () => { throw Error('synthetic interruption'); } }), /synthetic interruption/);
  const state = executeGraph(f.repo, f.boundary, 'graph', 'inspect'); assert.equal(state.revision, 1); assert.equal(state.attempts[0].status, 'running');
  assert.throws(() => materializeCandidate(f.request), /stale|boundary|control|target/i);
  executeGraph(f.repo, f.boundary, 'graph', 'apply', { op: 'reconcile', expected: 1, attempt: 'attempt-1', outcome: 'abandoned', note: 'Synthetic operator inspection; retained without cleanup' });
  assert.equal(executeGraph(f.repo, f.boundary, 'graph', 'inspect').attempts[0].status, 'abandoned');
  assert.throws(() => materializeCandidate({ ...f.request, graphRevision: 2 }), /Attempt ID already used|target boundary|linked|control/i);
  if (phase !== 'afterIntent') assert.equal(existsSync(f.target), true);
});
fixtureTest('source and target drift at materialization and publication leave attempts unresolved', () => {
  for (const [phase, side] of [['afterIndex', 'source'], ['beforeVerification', 'source'], ['beforeFinish', 'source'], ['beforeFinish', 'target']]) {
    const f = fixture(), path = join(side === 'source' ? f.repo : f.target, 'README.md');
    assert.throws(() => materializeCandidate(f.request, { [phase]: () => writeFileSync(path, 'synthetic drift\n') }), /drift|digest mismatch|changed during observation/);
    assert.equal(executeGraph(f.repo, f.boundary, 'graph', 'inspect').attempts[0].status, 'running'); assert.equal(existsSync(f.target), true);
  }
});
fixtureTest('unsupported source states, unselected untracked paths, and Git control collisions fail before intent', () => {
  for (const [name, setup] of [
    ['symlink', ({ repo }) => symlinkSync('synthetic-target', join(repo, 'synthetic-link'))],
    ['special mode', ({ repo }) => chmodSync(join(repo, 'README.md'), 0o4755)],
  ]) {
    const f = fixture({ setup }); assert.throws(() => materializeCandidate(f.request), /symlinks|special/i, name);
    assert.equal(executeGraph(f.repo, f.boundary, 'graph', 'inspect').revision, 0); assert.equal(existsSync(f.target), false);
  }
  const f = fixture(); f.git('update-index', '--skip-worktree', 'README.md');
  assert.throws(() => materializeCandidate(f.request), /index flags/i); assert.equal(executeGraph(f.repo, f.boundary, 'graph', 'inspect').revision, 0);
  const sub = fixture(); sub.git('update-index', '--add', '--cacheinfo', '160000', sub.initial, 'synthetic-submodule');
  assert.throws(() => materializeCandidate(sub.request), /submodule|unsupported index/i); assert.equal(executeGraph(sub.repo, sub.boundary, 'graph', 'inspect').revision, 0);
  const g = fixture({ setup: ({ repo }) => writeFileSync(join(repo, 'not-selected'), 'synthetic') });
  const selectionPath = join(g.boundary, 'selection.json');
  writeFileSync(selectionPath, JSON.stringify({ include: g.selection.include.filter(p => p !== 'not-selected'), exclude: ['not-selected'] }));
  assert.throws(() => materializeCandidate(g.request), /all tracked and inventoried/i); assert.equal(executeGraph(g.repo, g.boundary, 'graph', 'inspect').revision, 0);
  const h = fixture(); mkdirSync(join(h.repo, '.git/worktrees'), { recursive: true }); mkdirSync(join(h.repo, '.git/worktrees/builder'));
  assert.throws(() => materializeCandidate(h.request), /Git control.*already exists/i); assert.equal(executeGraph(h.repo, h.boundary, 'graph', 'inspect').revision, 0);
});
fixtureTest('unexpected target file or parent symlink is never overwritten or adopted', () => {
  for (const kind of ['file', 'parent-symlink']) {
    const f = fixture(), outside = join(f.parent, 'outside'); mkdirSync(outside); writeFileSync(join(outside, 'sentinel'), 'synthetic sentinel');
    const hook = () => kind === 'file' ? writeFileSync(join(f.target, 'README.md'), 'target sentinel') : symlinkSync(outside, join(f.target, 'docs'));
    assert.throws(() => materializeCandidate(f.request, { afterIndex: hook }), /EEXIST|exists/i);
    if (kind === 'file') assert.equal(readFileSync(join(f.target, 'README.md'), 'utf8'), 'target sentinel');
    assert.equal(readFileSync(join(outside, 'sentinel'), 'utf8'), 'synthetic sentinel');
    assert.equal(executeGraph(f.repo, f.boundary, 'graph', 'inspect').attempts[0].status, 'running');
  }
});
for (const stage of ['intent', 'terminal']) fixtureTest(`journal ${stage} fsync failure never reports success or replays`, () => {
  const f = fixture(), loader = join(f.parent, 'fail-' + stage + '-sync.mjs'), number = stage === 'intent' ? '00000001.json' : '00000002.json';
  writeFileSync(loader, `import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';const open=fs.openSync,sync=fs.fsyncSync,files=new Map();fs.openSync=function(path,...args){const fd=open.call(this,path,...args);if(String(path).endsWith('/graph/${number}'))files.set(fd,true);return fd};fs.fsyncSync=function(fd){if(files.has(fd))throw Error('synthetic journal fsync failure');return sync.call(this,fd)};syncBuiltinESMExports();`);
  const result = spawnSync(process.execPath, ['--import', loader, cli, f.repo, f.task, f.request.attempt, f.controlId, f.digest, '0', ...flags], { env: f.env, encoding: 'utf8', timeout: 120000 });
  assert.notEqual(result.status, 0); assert.match(result.stderr, /journal fsync failure/); assert.equal(result.stdout, '');
  const state = executeGraph(f.repo, f.boundary, 'graph', 'inspect');
  assert.equal(state.attempts[0].status, 'running'); assert.equal(state.slices[0].ready, false);
  if (stage === 'terminal') assert.ok(state.attempts[0].prepared); // A written prepare event may be visible despite failed fsync.
  assert.throws(() => materializeCandidate(f.request), /stale|not ready|target boundary/i);
});
for (const point of ['worktree', 'index']) fixtureTest(`abrupt CLI death before ${point} cannot be blindly replayed`, () => {
  const f = fixture(), loader = join(f.parent, 'kill-before-' + point + '.mjs');
  writeFileSync(loader, `import cp from 'node:child_process';import {syncBuiltinESMExports} from 'node:module';const original=cp.spawnSync;cp.spawnSync=function(command,args,...rest){if(${point === 'worktree' ? "args?.includes('worktree')&&args?.includes('add')" : "args?.includes('update-index')"})process.kill(process.pid,'SIGKILL');return original.call(this,command,args,...rest)};syncBuiltinESMExports();`);
  const args = ['--import', loader, cli, f.repo, f.task, f.request.attempt, f.controlId, f.digest, '0', ...flags];
  const r = spawnSync(process.execPath, args, { env: f.env, encoding: 'utf8', timeout: 120000 }); assert.equal(r.signal, 'SIGKILL');
  const state = executeGraph(f.repo, f.boundary, 'graph', 'inspect'); assert.equal(state.revision, 1); assert.equal(state.attempts[0].status, 'running');
  const retry = spawnSync(process.execPath, [cli, f.repo, f.task, f.request.attempt, f.controlId, f.digest, '0', ...flags], { env: f.env, encoding: 'utf8' });
  assert.notEqual(retry.status, 0); assert.match(retry.stderr, /stale|not ready|target boundary/i); assert.equal(existsSync(f.target), point === 'index');
});
