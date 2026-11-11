import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, renameSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { captureCandidate, compareCandidates, initCoordination, inventoryCandidate, verifyCandidate } from '../scripts/addy-candidate.mjs';
import { initSyntheticGit } from './fixtures/synthetic-git.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const candidate = join(root, 'scripts/addy-candidate.mjs'), compare = join(root, 'scripts/addy-compare.mjs');
const baseAuth = { authorizeRepositoryControl: true, authorizeCoordinationArtifacts: true };
const runtime = spawnSync('/usr/bin/git', ['--version'], { encoding: 'utf8', env: { PATH: '/usr/bin:/bin' } });
const testSupported = (name, fn) => test(name, { skip: process.platform === 'darwin' && runtime.status === 0 && runtime.stdout.trim() === 'git version 2.54.0 (Apple Git-157)' ? false : 'Prefix pruning supports only the explicitly tested macOS/Git runtime' }, fn);
function fixture() {
  const parent = mkdtempSync(join(root, '.agent-work/parallel-addy/prefix-test-')), repo = join(parent, 'repo'); mkdirSync(repo);
  const env = { PATH: '/usr/bin:/bin', HOME: parent, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' };
  const initial = initSyntheticGit(repo, env);
  const git = (...args) => execFileSync('git', ['-c', 'core.hooksPath=/dev/null', ...args], { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  mkdirSync(join(repo, 'excluded')); writeFileSync(join(repo, 'excluded', 'synthetic-secret'), 'synthetic only');
  writeFileSync(join(repo, 'visible'), 'synthetic visible');
  return { parent, repo, env, initial, git };
}
const scoped = { ...baseAuth, authorizeExcludedPrefixes: true, excludedPrefixes: ['excluded'] };
const selection = (repo, options) => ({ include: inventoryCandidate(repo, options).paths, exclude: [] });

testSupported('prefix API requires explicit authority, prunes the subtree, and records partial scope', () => {
  const f = fixture();
  assert.throws(() => inventoryCandidate(f.repo, { ...baseAuth, excludedPrefixes: ['excluded'] }), /authorization/);
  const inv = inventoryCandidate(f.repo, scoped);
  assert.deepEqual(inv.excludedPrefixes, ['excluded']); assert.ok(inv.paths.includes('visible')); assert.ok(!inv.paths.some(x => x.startsWith('excluded/')));
  const selected = selection(f.repo, scoped), result = captureCandidate(f.repo, selected, scoped);
  assert.equal(result.manifest.version, 7); assert.equal(result.manifest.coverage, 'partial'); assert.deepEqual(result.manifest.excludedPrefixes, ['excluded']);
  const path = join(f.parent, 'selection.json'); writeFileSync(path, JSON.stringify(selected));
  const flags = ['--authorize-repository-control', '--authorize-excluded-prefixes', '--exclude-prefix', 'excluded'];
  let cli = spawnSync(process.execPath, [candidate, f.repo, ...flags, 'capture', path], { env: f.env, encoding: 'utf8' });
  assert.equal(cli.status, 0, cli.stderr); assert.equal(JSON.parse(cli.stdout).digest, result.digest);
  cli = spawnSync(process.execPath, [candidate, f.repo, ...flags, 'verify', path, result.digest], { env: f.env, encoding: 'utf8' });
  assert.equal(cli.status, 0, cli.stderr);
  writeFileSync(join(f.repo, 'excluded', 'synthetic-secret'), 'changed outside selected scope');
  assert.equal(verifyCandidate(f.repo, selection(f.repo, scoped), result.digest, scoped).digest, result.digest);
  assert.throws(() => captureCandidate(f.repo, selection(f.repo, scoped), { ...scoped, beforeSecondPass: () => {
    renameSync(join(f.repo, 'excluded'), join(f.parent, 'excluded-retained')); mkdirSync(join(f.repo, 'excluded'));
  } }), /changed during observation/);
  const second = fixture();
  assert.throws(() => captureCandidate(second.repo, selection(second.repo, scoped), { ...scoped, beforeSecondPass: () => writeFileSync(join(second.repo, 'visible'), 'changed') }), /changed during observation/);
});

testSupported('prefixes reject tracked overlap, unsafe names, aliases, symlinks, and unknown unexcluded repositories', () => {
  const f = fixture(), opts = prefix => ({ ...baseAuth, authorizeExcludedPrefixes: true, excludedPrefixes: [prefix] });
  for (const p of ['README.md', 'docs', '.git', '../escape', 'bad\nname', 'é', 'excluded/../visible']) assert.throws(() => inventoryCandidate(f.repo, opts(p)), /prefix|path/i, p);
  assert.throws(() => inventoryCandidate(f.repo, { ...opts('excluded'), excludedPrefixes: ['excluded', 'excluded/child'] }), /overlapping/i);
  const bin = join(f.parent, 'bin'); mkdirSync(bin);
  writeFileSync(join(bin, 'git'), '#!/bin/sh\ncase "$*" in *--version*) echo "git version 0.0 unsupported" ;; *) exec /usr/bin/git "$@" ;; esac\n', { mode: 0o755 });
  const previousPath = process.env.PATH; process.env.PATH = bin + ':/usr/bin:/bin';
  try { assert.throws(() => inventoryCandidate(f.repo, opts('excluded')), /Unsupported Git runtime/); }
  finally { previousPath === undefined ? delete process.env.PATH : process.env.PATH = previousPath; }
  f.git('-C', f.repo, 'add', '-f', 'excluded/synthetic-secret');
  assert.throws(() => inventoryCandidate(f.repo, opts('excluded')), /tracked HEAD or index/);
  mkdirSync(join(f.repo, 'outside')); symlinkSync(join(f.repo, 'outside'), join(f.repo, 'link'));
  assert.throws(() => inventoryCandidate(f.repo, opts('link/child')), /directory|prefix/i);
  const nested = join(f.repo, 'unknown'); mkdirSync(nested); initSyntheticGit(nested, f.env);
  assert.throws(() => inventoryCandidate(f.repo, opts('outside')), /nested repository|directory record/i);
  const other = fixture(); renameSync(join(other.repo, 'docs/roles-library.md'), join(other.parent, 'roles-retained')); other.git('-C', other.repo, 'add', '-u', 'docs');
  assert.throws(() => inventoryCandidate(other.repo, opts('docs')), /tracked HEAD or index/);
});

testSupported('literal punctuation prefixes remain opaque, including nested repositories', () => {
  const f = fixture(), prefix = 'odd [*] : name'; mkdirSync(join(f.repo, prefix));
  const nested = join(f.repo, prefix, 'nested'); mkdirSync(nested); initSyntheticGit(nested, f.env);
  const options = { ...baseAuth, authorizeExcludedPrefixes: true, excludedPrefixes: [prefix] };
  const inv = inventoryCandidate(f.repo, options);
  assert.deepEqual(inv.excludedPrefixes, [prefix]); assert.ok(!inv.paths.some(path => path.startsWith(prefix + '/')));
  assert.throws(() => initCoordination(f.repo, 'no-write', options), /before declaring excluded prefixes/);
});

testSupported('literal pathspec pruning has denied-read and positive controls on macOS', t => {
  if (process.platform !== 'darwin' || !existsSync('/usr/bin/sandbox-exec')) { t.skip('macOS sandbox-exec unavailable'); return; }
  const f = fixture(), directory = join(f.repo, 'excluded');
  const hiddenNested = join(directory, 'nested-repo'); mkdirSync(hiddenNested); initSyntheticGit(hiddenNested, f.env);
  const descendants = '^' + directory.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '/';
  // Boundary metadata is allowed; listing or reading any descendant is denied.
  const profile = `(version 1)(allow default)(deny file-read-data (subpath ${JSON.stringify(directory)}))(deny file-read-metadata (regex #${JSON.stringify(descendants)}))`;
  const git = (...args) => spawnSync('/usr/bin/sandbox-exec', ['-p', profile, '/usr/bin/git', '-C', f.repo, 'ls-files', '--others', '-z', '--', '.', ...args], { env: f.env, encoding: 'utf8' });
  const control = git(); assert.match(control.stderr, /permission|permitted/i);
  const pruned = git(':(exclude,literal)excluded'); assert.equal(pruned.status, 0); assert.equal(pruned.stderr, ''); assert.deepEqual(pruned.stdout.split('\0').filter(Boolean), ['visible']);
  const run = (...args) => spawnSync('/usr/bin/sandbox-exec', ['-p', profile, process.execPath, candidate, f.repo, ...args], { env: f.env, encoding: 'utf8' });
  const normal = run('--authorize-repository-control', 'inventory'); assert.notEqual(normal.status, 0);
  const unauthorized = run('--authorize-repository-control', '--exclude-prefix', 'excluded', 'inventory'); assert.notEqual(unauthorized.status, 0); assert.match(unauthorized.stderr, /authorization/);
  const safe = run('--authorize-repository-control', '--authorize-excluded-prefixes', '--exclude-prefix', 'excluded', 'inventory');
  assert.equal(safe.status, 0, safe.stderr); assert.deepEqual(JSON.parse(safe.stdout).excludedPrefixes, ['excluded']);
});

testSupported('normal CLI and API compare the same explicitly partial source and linked scope', () => {
  const f = fixture(), task = 'scope', rel = '.agent-work/linked-worktrees/builder', tree = join(f.repo, rel);
  const nested = [{ path: rel, controlId: 'builder' }], owner = { ...scoped, coordination: task, authorizeNestedLinkedControls: true, nestedLinked: nested };
  initCoordination(f.repo, task, baseAuth);
  const ownerFlags = ['--authorize-repository-control', '--authorize-coordination-artifacts', '--authorize-nested-linked-controls', '--nested-linked', rel + '=builder', '--authorize-excluded-prefixes', '--exclude-prefix', 'excluded', '--coordination', task];
  const run = (project, flags, ...args) => spawnSync(process.execPath, [candidate, project, ...flags, ...args], { env: f.env, encoding: 'utf8' });
  let r = run(f.repo, ownerFlags, 'inventory'); assert.equal(r.status, 0, r.stderr);
  const aSelection = join(f.repo, '.agent-work/addy-coordination', task, 'selection.json'); writeFileSync(aSelection, JSON.stringify({ include: JSON.parse(r.stdout).paths, exclude: [] }));
  r = run(f.repo, ownerFlags, 'capture', aSelection, '--write-manifest'); assert.equal(r.status, 0, r.stderr); const a = JSON.parse(r.stdout); assert.equal(a.manifest.version, 6);
  f.git('-C', f.repo, 'worktree', 'add', '--detach', '--no-checkout', tree, f.initial); f.git('-C', tree, 'read-tree', 'HEAD'); f.git('-C', tree, 'checkout-index', '-a');
  writeFileSync(join(tree, 'visible'), 'synthetic visible');
  const linked = { ...scoped, coordination: task, authorizeLinkedControl: true, linkedProjectRoot: f.repo };
  initCoordination(tree, task, { ...baseAuth, authorizeLinkedControl: true, linkedProjectRoot: f.repo });
  const linkedFlags = ['--authorize-repository-control', '--authorize-coordination-artifacts', '--authorize-linked-control', '--linked-project-root', f.repo, '--authorize-excluded-prefixes', '--exclude-prefix', 'excluded', '--coordination', task];
  r = run(tree, linkedFlags, 'inventory'); assert.equal(r.status, 0, r.stderr);
  const bSelection = join(tree, '.agent-work/addy-coordination', task, 'selection.json'); writeFileSync(bSelection, JSON.stringify({ include: JSON.parse(r.stdout).paths, exclude: [] }));
  r = run(tree, linkedFlags, 'capture', bSelection, '--write-manifest'); assert.equal(r.status, 0, r.stderr); const b = JSON.parse(r.stdout); assert.equal(b.manifest.version, 5);
  r = run(tree, linkedFlags, 'verify', bSelection, b.digest); assert.equal(r.status, 0, r.stderr);
  r = run(f.repo, ownerFlags, 'inventory'); assert.equal(r.status, 0, r.stderr); const identity = JSON.parse(r.stdout).nestedLinkedBoundaries[0].identity;
  r = run(f.repo, [...ownerFlags, '--expected-nested-identity', rel + '=' + identity], 'verify', aSelection, a.digest); assert.equal(r.status, 0, r.stderr);
  const request = { ownerProject: f.repo, linkedProject: tree, task, boundary: rel, controlId: 'builder', expectedControlIdentity: identity, ownerDigest: a.digest, linkedDigest: b.digest, ownerAuthorization: owner, linkedAuthorization: linked };
  const result = compareCandidates(request); assert.equal(result.equal, true); assert.match(result.scope, /^partial:/); assert.deepEqual(result.excludedPrefixes, ['excluded']);
  const flags = ['--authorize-owner-repository-control', '--authorize-owner-coordination-artifacts', '--authorize-owner-nested-linked-controls', '--authorize-linked-repository-control', '--authorize-linked-coordination-artifacts', '--authorize-linked-control', '--authorize-excluded-prefixes', '--exclude-prefix', 'excluded'];
  r = spawnSync(process.execPath, [compare, f.repo, tree, task, rel, 'builder', identity, a.digest, b.digest, ...flags], { env: f.env, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr); assert.match(JSON.parse(r.stdout).scope, /^partial:/);
  assert.throws(() => compareCandidates({ ...request, linkedAuthorization: { ...linked, authorizeExcludedPrefixes: false } }), /authorization/);
  const otherFlags = linkedFlags.map(x => x === 'excluded' ? 'different-prefix' : x);
  r = run(tree, otherFlags, 'capture', bSelection, '--write-manifest'); assert.equal(r.status, 0, r.stderr);
  const other = JSON.parse(r.stdout);
  assert.throws(() => compareCandidates({ ...request, linkedDigest: other.digest, linkedAuthorization: { ...linked, excludedPrefixes: ['different-prefix'] } }), /coverage or exclusions are incompatible/);
  writeFileSync(join(tree, 'visible'), 'changed'); assert.throws(() => compareCandidates(request), /digest mismatch/);
});
