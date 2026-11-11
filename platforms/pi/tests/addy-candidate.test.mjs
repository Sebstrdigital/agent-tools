import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { captureCandidate, compareCandidates, initCoordination, inventoryCandidate, transferCandidate, verifyCandidate } from '../scripts/addy-candidate.mjs';
import { executeGraph } from '../scripts/addy-graph.mjs';
import { initSyntheticGit } from './fixtures/synthetic-git.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const task = join(root, '.agent-work/parallel-addy');
const script = join(root, 'scripts/addy-candidate.mjs');
const sha = data => createHash('sha256').update(data).digest('hex');
const auth = { authorizeRepositoryControl: true };
const coordAuth = { ...auth, authorizeCoordinationArtifacts: true };
const inventory = repo => inventoryCandidate(repo, auth);
const capture = (repo, paths, options = {}) => captureCandidate(repo, { include: paths, exclude: [] }, { ...auth, ...options });
const verify = (repo, paths, expected) => verifyCandidate(repo, { include: paths, exclude: [] }, expected, auth);
function fixture() {
  const parent = mkdtempSync(join(task, 'candidate-real-')), repo = join(parent, 'repo'); mkdirSync(repo);
  const env = { PATH: '/usr/bin:/bin', HOME: parent, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' };
  const git = (cwd, ...args) => execFileSync('git', ['-c', 'core.hooksPath=/dev/null', '-C', cwd, ...args], { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const initial = initSyntheticGit(repo, env);
  return { parent, repo, git, initial };
}

test('real dirty baseline covers index, unstaged data, additions, deletions, modes and symlinks without ignored content', () => {
  const { repo, git, initial } = fixture();
  writeFileSync(join(repo, 'README.md'), 'staged content\n'); git(repo, 'add', 'README.md');
  writeFileSync(join(repo, 'README.md'), 'unstaged content\n');
  chmodSync(join(repo, 'PLAN.md'), 0o755);
  renameSync(join(repo, 'docs/roles-library.md'), join(repo, 'docs/roles-library.md.moved'));
  git(repo, 'add', '-A', '--', 'docs/roles-library.md');
  writeFileSync(join(repo, 'staged-new.txt'), 'staged new content\n'); git(repo, 'add', 'staged-new.txt');
  writeFileSync(join(repo, 'new\nfile.txt'), 'authorized fixture\n');
  symlinkSync('../../outside-do-not-read', join(repo, 'link-fixture'));
  writeFileSync(join(repo, '.gitignore'), '*.ignored-secret\n');
  writeFileSync(join(repo, 'private.ignored-secret'), 'never include this content'); chmodSync(join(repo, 'private.ignored-secret'), 0);
  const inv = inventory(repo);
  assert.equal(inv.head, initial); assert.ok(inv.paths.includes('private.ignored-secret'));
  const included = inv.paths.filter(p => p !== 'private.ignored-secret');
  const selection = { include: included, exclude: ['private.ignored-secret'] };
  assert.throws(() => capture(repo, included), /exactly all/);
  assert.throws(() => captureCandidate(repo, { include: included, exclude: [] }, auth), /exactly all/);
  const result = captureCandidate(repo, selection, auth), work = new Map(result.manifest.worktree.map(f => [f.path, f]));
  assert.ok(result.manifest.exclusions.includes('extended attributes and ACLs'));
  assert.equal(result.manifest.coverage, 'partial');
  assert.deepEqual(result.manifest.excludedPaths, ['private.ignored-secret']);
  assert.equal(work.get('README.md').sha256, sha('unstaged content\n'));
  assert.notEqual(result.manifest.index.find(f => f.path === 'README.md').oid, result.manifest.tree.find(f => f.path === 'README.md').oid);
  assert.equal(result.manifest.index.find(f => f.path === 'README.md').sha256, sha('staged content\n'));
  assert.equal(result.manifest.index.find(f => f.path === 'staged-new.txt').sha256, sha('staged new content\n'));
  assert.equal(result.manifest.index.some(f => f.path === 'docs/roles-library.md'), false);
  assert.equal(work.get('docs/roles-library.md').kind, 'missing');
  assert.equal(result.manifest.tree.find(f => f.path === 'docs/roles-library.md').sha256, sha(readFileSync(join(repo, 'docs/roles-library.md.moved'))));
  assert.equal(work.get('docs/roles-library.md.moved').sha256, sha(readFileSync(join(repo, 'docs/roles-library.md.moved'))));
  assert.equal(work.get('PLAN.md').mode & 0o111, 0o111);
  assert.equal(Buffer.from(work.get('link-fixture').targetBase64, 'base64').toString(), '../../outside-do-not-read');
  assert.equal(work.get('new\nfile.txt').kind, 'file');
  assert.equal(verifyCandidate(repo, selection, result.digest, auth).digest, result.digest);
  writeFileSync(join(repo, 'README.md'), 'later mutation\n');
  assert.throws(() => verifyCandidate(repo, selection, result.digest, auth), /digest mismatch/);
});

test('identical authorized fixture candidates have a reproducible digest across directories', () => {
  const one = fixture(), two = fixture();
  const a = capture(one.repo, inventory(one.repo).paths);
  const b = capture(two.repo, inventory(two.repo).paths);
  assert.equal(a.digest, b.digest);
  assert.deepEqual(a.manifest, b.manifest);
});

test('staged and unstaged identities remain distinct even when worktree bytes match', () => {
  const { repo, git } = fixture(), file = join(repo, 'README.md');
  writeFileSync(file, 'stage one\n'); git(repo, 'add', 'README.md'); writeFileSync(file, 'same worktree\n');
  const paths = inventory(repo).paths, before = capture(repo, paths);
  writeFileSync(file, 'stage two\n'); git(repo, 'add', 'README.md'); writeFileSync(file, 'same worktree\n');
  const after = capture(repo, paths);
  assert.equal(before.manifest.worktree.find(f => f.path === 'README.md').sha256, after.manifest.worktree.find(f => f.path === 'README.md').sha256);
  assert.notEqual(before.manifest.index.find(f => f.path === 'README.md').sha256, after.manifest.index.find(f => f.path === 'README.md').sha256);
  assert.notEqual(before.digest, after.digest);
});

test('initial allowlist and trailing content or inventory drift fail closed without reading new paths', () => {
  const { repo } = fixture(), inv = inventory(repo);
  assert.throws(() => capture(repo, inv.paths.slice(1)), /exactly all/);
  assert.throws(() => capture(repo, inv.paths, { beforeSecondPass: () => writeFileSync(join(repo, 'README.md'), 'during capture\n') }), /changed during observation/);
  const fresh = inventory(repo);
  assert.throws(() => capture(repo, fresh.paths, { beforeSecondPass: () => {
    writeFileSync(join(repo, 'new-unapproved'), 'must not be read'); chmodSync(join(repo, 'new-unapproved'), 0);
  } }), /changed during observation/);
  const trailing = fixture(), paths = inventory(trailing.repo).paths;
  assert.throws(() => capture(trailing.repo, paths, { afterSecondPass: () => {
    writeFileSync(join(trailing.repo, 'late-unapproved'), 'must not be read'); chmodSync(join(trailing.repo, 'late-unapproved'), 0);
  } }), /changed during observation/);
});

test('file permissions, sizes and symlink parents fail closed; final symlinks are not followed', () => {
  const one = fixture(); chmodSync(join(one.repo, 'README.md'), 0);
  assert.throws(() => capture(one.repo, inventory(one.repo).paths), /no read permission/);
  const two = fixture();
  assert.throws(() => capture(two.repo, inventory(two.repo).paths, { maxFileBytes: 1 }), /size limit/);
  assert.throws(() => capture(two.repo, inventory(two.repo).paths, { maxTotalBytes: 1 }), /total size limit/);
  const three = fixture();
  renameSync(join(three.repo, 'docs'), join(three.repo, 'docs-moved'));
  const outside = join(three.parent, 'outside'); mkdirSync(outside); writeFileSync(join(outside, 'roles-library.md'), 'private');
  symlinkSync(outside, join(three.repo, 'docs'));
  assert.throws(() => capture(three.repo, inventory(three.repo).paths), /Unsafe or non-directory parent/);
});

test('skip-worktree index flags are not accepted as a verified baseline', () => {
  const { repo, git } = fixture();
  git(repo, 'update-index', '--skip-worktree', 'README.md');
  assert.throws(() => inventory(repo), /Skip-worktree or assume-unchanged/);
});

test('intent-to-add index entries cannot masquerade as ordinary staged blobs', () => {
  const { repo, git } = fixture();
  writeFileSync(join(repo, 'intent.txt'), 'not staged\n'); git(repo, 'add', '-N', 'intent.txt');
  assert.throws(() => inventory(repo), /Unsupported index flags/);
});

test('explicit control authority and selection are required before repository or Git access', () => {
  const { parent, repo } = fixture(), bin = join(parent, 'bin'), log = join(parent, 'git-called'); mkdirSync(bin);
  writeFileSync(join(bin, 'git'), `#!/bin/sh\nprintf called > ${JSON.stringify(log)}\nexit 1\n`, { mode: 0o755 });
  const old = process.env.PATH; process.env.PATH = bin + ':/usr/bin:/bin';
  try {
    chmodSync(join(repo, '.git/config'), 0);
    assert.throws(() => inventoryCandidate(repo), /authorization required/);
    assert.throws(() => captureCandidate(repo, undefined, auth), /Selection requires/);
    assert.equal(existsSync(log), false, 'Git must not be invoked');
  } finally { process.env.PATH = old; }
});

test('external excludes and include config are rejected before Git can access external contents', () => {
  for (const setting of ['\\n[include]\\n path = EXTERNAL\\n', '\\n[core]\\n excludesFile = EXTERNAL\\n']) {
    const { parent, repo } = fixture(), external = join(parent, 'private'), bin = join(parent, 'bin'), log = join(parent, 'git-called');
    writeFileSync(external, 'private config must not be read'); chmodSync(external, 0); mkdirSync(bin);
    const config = join(repo, '.git/config'); writeFileSync(config, readFileSync(config, 'utf8') + setting.replace('EXTERNAL', external));
    writeFileSync(join(bin, 'git'), `#!/bin/sh\nprintf called > ${JSON.stringify(log)}\nexit 1\n`, { mode: 0o755 });
    const old = process.env.PATH; process.env.PATH = bin + ':/usr/bin:/bin';
    try {
      assert.throws(() => inventory(repo), /unsupported/i);
      assert.equal(existsSync(log), false, 'No Git command may load external config');
    } finally { process.env.PATH = old; }
  }
});

test('alternate object stores and control-directory symlinks are rejected', () => {
  const a = fixture(); mkdirSync(join(a.repo, '.git/objects/info'), { recursive: true });
  writeFileSync(join(a.repo, '.git/objects/info/alternates'), join(a.parent, 'external-objects') + '\n');
  assert.throws(() => inventory(a.repo), /External or alternate/);
  const b = fixture(); symlinkSync(join(b.parent, 'external'), join(b.repo, '.git/unsafe-link'));
  assert.throws(() => inventory(b.repo), /Symlink in repository-control/);
});

function linkedFixture() {
  const f = fixture(), parent = join(f.repo, '.agent-work', 'linked'); mkdirSync(parent, { recursive: true });
  const make = name => {
    const tree = join(parent, name);
    f.git(f.repo, 'worktree', 'add', '--detach', '--no-checkout', tree, f.initial);
    f.git(tree, 'read-tree', 'HEAD'); f.git(tree, 'checkout-index', '-a');
    return tree;
  };
  return { ...f, make };
}

test('owner baseline survives explicitly declared linked-worktree setup while linked evidence remains separate', () => {
  const f = fixture(), tree = join(f.repo, '.agent-work/linked-worktrees/builder'), rel = '.agent-work/linked-worktrees/builder';
  writeFileSync(join(f.repo, 'README.md'), 'owner staged\n'); f.git(f.repo, 'add', 'README.md');
  writeFileSync(join(f.repo, 'README.md'), 'owner unstaged\n'); writeFileSync(join(f.repo, 'owner-new'), 'owner untracked\n');
  const common = ['--authorize-repository-control', '--authorize-coordination-artifacts'];
  const ownerFlags = [...common, '--authorize-nested-linked-controls', '--nested-linked', rel + '=builder', '--coordination', 'task'];
  const run = (root, flags, ...args) => spawnSync(process.execPath, [script, root, ...flags, ...args], { encoding: 'utf8' });
  let r = run(f.repo, common, 'init-coordination', 'task'); assert.equal(r.status, 0, r.stderr);
  r = run(f.repo, ownerFlags, 'inventory'); assert.equal(r.status, 0, r.stderr);
  const inv = JSON.parse(r.stdout); assert.equal(inv.nestedLinkedBoundaries[0].present, false);
  const selection = join(f.repo, '.agent-work/addy-coordination/task/selection.json'); writeFileSync(selection, JSON.stringify({ include: inv.paths, exclude: [] }));
  r = run(f.repo, ownerFlags, 'capture', selection, '--write-manifest'); assert.equal(r.status, 0, r.stderr);
  const owner = JSON.parse(r.stdout); assert.equal(owner.manifest.coverage, 'partial');
  r = run(f.repo, ownerFlags, 'verify', selection, owner.digest); assert.notEqual(r.status, 0); assert.match(r.stderr, /present nested/);
  r = run(f.repo, [...ownerFlags, '--expect-nested-absent', rel], 'verify', selection, owner.digest); assert.equal(r.status, 0, r.stderr);
  assert.equal(JSON.parse(r.stdout).nestedVerification[0].present, false);
  f.git(f.repo, 'worktree', 'add', '--detach', '--no-checkout', tree, f.initial);
  r = run(f.repo, [...ownerFlags, '--expect-nested-absent', rel], 'verify', selection, owner.digest); assert.notEqual(r.status, 0); assert.match(r.stderr, /control identities/); f.git(tree, 'read-tree', 'HEAD'); f.git(tree, 'checkout-index', '-a');
  r = run(f.repo, ownerFlags, 'inventory'); assert.equal(r.status, 0, r.stderr);
  const nested = JSON.parse(r.stdout).nestedLinkedBoundaries[0]; assert.equal(nested.present, true);
  const verifiedFlags = [...ownerFlags, '--expected-nested-identity', rel + '=' + nested.identity];
  r = run(f.repo, verifiedFlags, 'verify', selection, owner.digest); assert.equal(r.status, 0, r.stderr);
  const linkedFlags = [...common, '--authorize-linked-control', '--linked-project-root', f.repo];
  r = run(tree, linkedFlags, 'init-coordination', 'task'); assert.equal(r.status, 0, r.stderr);
  r = run(tree, [...linkedFlags, '--coordination', 'task'], 'inventory'); assert.equal(r.status, 0, r.stderr);
  const linkedInv = JSON.parse(r.stdout), linkedSelection = join(tree, '.agent-work/addy-coordination/task/selection.json');
  writeFileSync(linkedSelection, JSON.stringify({ include: linkedInv.paths, exclude: [] }));
  r = run(tree, [...linkedFlags, '--coordination', 'task'], 'capture', linkedSelection, '--write-manifest'); assert.equal(r.status, 0, r.stderr);
  const linked = JSON.parse(r.stdout); assert.notEqual(linked.digest, owner.digest, 'No dirty baseline transfer is implied');
  r = run(tree, [...linkedFlags, '--coordination', 'task'], 'verify', linkedSelection, linked.digest); assert.equal(r.status, 0, r.stderr);
  writeFileSync(join(tree, 'README.md'), 'builder mutation\n');
  r = run(f.repo, verifiedFlags, 'verify', selection, owner.digest); assert.equal(r.status, 0, r.stderr);
  r = run(tree, [...linkedFlags, '--coordination', 'task'], 'verify', linkedSelection, linked.digest); assert.notEqual(r.status, 0); assert.match(r.stderr, /digest mismatch/);
  r = run(f.repo, [...ownerFlags, '--expected-nested-identity', rel + '=' + '0'.repeat(64)], 'verify', selection, owner.digest); assert.notEqual(r.status, 0); assert.match(r.stderr, /control identities/);
  writeFileSync(join(f.repo, 'README.md'), 'owner mutation\n');
  r = run(f.repo, verifiedFlags, 'verify', selection, owner.digest); assert.notEqual(r.status, 0); assert.match(r.stderr, /digest mismatch/);
});

test('comparison CLI freshly verifies retained owner and linked provenance and compares dirty state', () => {
  const f = fixture(), rel = '.agent-work/linked-worktrees/builder', tree = join(f.repo, rel), taskName = 'compare';
  const ownerFlags = ['--authorize-repository-control', '--authorize-coordination-artifacts', '--authorize-nested-linked-controls', '--nested-linked', rel + '=builder', '--coordination', taskName];
  const linkedFlags = ['--authorize-repository-control', '--authorize-coordination-artifacts', '--authorize-linked-control', '--linked-project-root', f.repo, '--coordination', taskName];
  const run = (project, flags, ...args) => spawnSync(process.execPath, [script, project, ...flags, ...args], { encoding: 'utf8' });
  const dirty = project => {
    writeFileSync(join(project, 'README.md'), 'staged content\n'); f.git(project, 'add', 'README.md'); writeFileSync(join(project, 'README.md'), 'unstaged content\n');
    chmodSync(join(project, 'PLAN.md'), 0o755);
    renameSync(join(project, 'docs/roles-library.md'), join(project, 'docs/roles-library.md.moved')); f.git(project, 'add', '-A', '--', 'docs/roles-library.md');
    writeFileSync(join(project, 'untracked'), 'fixture untracked\n'); symlinkSync('relative-target', join(project, 'fixture-link'));
  };
  dirty(f.repo); initCoordination(f.repo, taskName, coordAuth);
  let r = run(f.repo, ownerFlags, 'inventory'); assert.equal(r.status, 0, r.stderr);
  const ownerSelection = join(f.repo, '.agent-work/addy-coordination', taskName, 'selection.json');
  writeFileSync(ownerSelection, JSON.stringify({ include: JSON.parse(r.stdout).paths, exclude: [] }));
  r = run(f.repo, ownerFlags, 'capture', ownerSelection, '--write-manifest'); assert.equal(r.status, 0, r.stderr); const owner = JSON.parse(r.stdout);
  f.git(f.repo, 'worktree', 'add', '--detach', '--no-checkout', tree, f.initial); f.git(tree, 'read-tree', 'HEAD'); f.git(tree, 'checkout-index', '-a'); dirty(tree);
  const linkedOptions = { ...coordAuth, authorizeLinkedControl: true, linkedProjectRoot: f.repo };
  initCoordination(tree, taskName, linkedOptions);
  const selection = join(tree, '.agent-work/addy-coordination', taskName, 'selection.json');
  r = run(tree, linkedFlags, 'inventory'); assert.equal(r.status, 0, r.stderr); writeFileSync(selection, JSON.stringify({ include: JSON.parse(r.stdout).paths, exclude: [] }));
  const captureLinked = () => { const out = run(tree, linkedFlags, 'capture', selection, '--write-manifest'); assert.equal(out.status, 0, out.stderr); return JSON.parse(out.stdout); };
  const linked = captureLinked(); assert.notEqual(owner.digest, linked.digest, 'Schemas deliberately have different digests');
  r = run(f.repo, ownerFlags, 'inventory'); assert.equal(r.status, 0, r.stderr); const identity = JSON.parse(r.stdout).nestedLinkedBoundaries[0].identity;
  const flags = ['--authorize-owner-repository-control', '--authorize-owner-coordination-artifacts', '--authorize-owner-nested-linked-controls', '--authorize-linked-repository-control', '--authorize-linked-coordination-artifacts', '--authorize-linked-control'];
  const compare = (digest, token = identity) => spawnSync(process.execPath, [join(root, 'scripts/addy-compare.mjs'), f.repo, tree, taskName, rel, 'builder', token, owner.digest, digest, ...flags], { encoding: 'utf8' });
  let result = compare(linked.digest); assert.equal(result.status, 0, result.stderr); assert.equal(JSON.parse(result.stdout).equal, true);
  result = compare(linked.digest, '0'.repeat(64)); assert.notEqual(result.status, 0); assert.match(result.stderr, /control identities/);
  result = compare('0'.repeat(64)); assert.notEqual(result.status, 0); assert.match(result.stderr, /digest mismatch/);
  assert.throws(() => compareCandidates({ ownerProject: '/not-readable' }), /Explicit independent owner/);
  const cases = [
    ['staged', () => { writeFileSync(join(tree, 'README.md'), 'other stage\n'); f.git(tree, 'add', 'README.md'); writeFileSync(join(tree, 'README.md'), 'unstaged content\n'); }, () => { writeFileSync(join(tree, 'README.md'), 'staged content\n'); f.git(tree, 'add', 'README.md'); writeFileSync(join(tree, 'README.md'), 'unstaged content\n'); }],
    ['unstaged', () => writeFileSync(join(tree, 'README.md'), 'other worktree\n'), () => writeFileSync(join(tree, 'README.md'), 'unstaged content\n')],
    ['untracked', () => writeFileSync(join(tree, 'untracked'), 'different\n'), () => writeFileSync(join(tree, 'untracked'), 'fixture untracked\n')],
    ['deletion', () => renameSync(join(tree, 'PLAN.md'), join(f.parent, 'plan-retained')), () => renameSync(join(f.parent, 'plan-retained'), join(tree, 'PLAN.md'))],
    ['mode', () => chmodSync(join(tree, 'PLAN.md'), 0o644), () => chmodSync(join(tree, 'PLAN.md'), 0o755)],
    ['symlink', () => { renameSync(join(tree, 'fixture-link'), join(f.parent, 'link-original')); symlinkSync('different-target', join(tree, 'fixture-link')); }, () => { renameSync(join(tree, 'fixture-link'), join(f.parent, 'link-altered')); renameSync(join(f.parent, 'link-original'), join(tree, 'fixture-link')); }],
  ];
  for (const [label, change, restore] of cases) {
    change();
    if (label === 'staged') { result = compare(linked.digest); assert.notEqual(result.status, 0); assert.match(result.stderr, /digest mismatch/); }
    const changed = captureLinked(); result = compare(changed.digest);
    assert.notEqual(result.status, 0, label); assert.match(result.stderr, /Candidate contents differ/, label); restore();
  }
  writeFileSync(selection, JSON.stringify({ include: JSON.parse(r.stdout).paths.filter(p => p !== 'untracked'), exclude: ['untracked'] }));
  const partial = captureLinked(); result = compare(partial.digest); assert.notEqual(result.status, 0); assert.match(result.stderr, /coverage or exclusions are incompatible/);
});

function transferFixture(excludeSecret = false, specialMode = false) {
  const f = fixture(), taskName = 'transfer-failure', rel = '.agent-work/linked-worktrees/builder', boundary = join(f.repo, '.agent-work/addy-coordination', taskName);
  if (excludeSecret) { writeFileSync(join(f.repo, 'secret.fixture'), 'not-authorized'); chmodSync(join(f.repo, 'secret.fixture'), 0); }
  if (specialMode) chmodSync(join(f.repo, 'PLAN.md'), 0o4755);
  initCoordination(f.repo, taskName, coordAuth);
  const options = { ...coordAuth, coordination: taskName, authorizeNestedLinkedControls: true, nestedLinked: [{ path: rel, controlId: 'builder' }] };
  const inv = inventoryCandidate(f.repo, options), selection = { include: inv.paths.filter(p => p !== 'secret.fixture'), exclude: excludeSecret ? ['secret.fixture'] : [] };
  const selectionPath = join(boundary, 'selection.json'); writeFileSync(selectionPath, JSON.stringify(selection));
  const flags = ['--authorize-repository-control', '--authorize-coordination-artifacts', '--authorize-nested-linked-controls', '--nested-linked', rel + '=builder', '--coordination', taskName];
  const captured = spawnSync(process.execPath, [script, f.repo, ...flags, 'capture', selectionPath, '--write-manifest'], { encoding: 'utf8' }); assert.equal(captured.status, 0, captured.stderr);
  const ownerDigest = JSON.parse(captured.stdout).digest;
  executeGraph(f.repo, boundary, 'graph', 'init', { op: 'init', baseline: ownerDigest, baselineRef: join(boundary, 'manifests', ownerDigest + '.json'), slices: [{ id: 'builder', depends: [] }] });
  const authorization = { authorizeRepositoryControl: true, authorizeCoordinationArtifacts: true, authorizeNestedLinkedControls: true, authorizeSelectedSourceContent: true,
    authorizeWorktreeCreate: true, authorizeTargetWrite: true, authorizeTargetControl: true, authorizeTargetCoordinationArtifacts: true };
  const request = { ownerProject: f.repo, task: taskName, targetBoundary: rel, targetControlId: 'builder', ownerDigest, slice: 'builder', attempt: 'attempt-1', expectedRevision: 0,
    boundaries: [{ path: rel, controlId: 'builder', identity: null }], authorization };
  return { ...f, taskName, rel, boundary, request };
}

test('transfer API and CLI fail closed before reading or mutating paths', () => {
  assert.throws(() => transferCandidate({}), /Transfer disabled: safe directory-relative no-follow isolation is unavailable/);
  const f = transferFixture();
  assert.throws(() => transferCandidate(f.request), /Transfer disabled: safe directory-relative no-follow isolation is unavailable/);
  const flags = ['--authorize-repository-control', '--authorize-coordination-artifacts', '--authorize-nested-linked-controls', '--authorize-selected-source-content', '--authorize-worktree-create', '--authorize-target-write', '--authorize-target-control', '--authorize-target-coordination-artifacts'];
  const r = spawnSync(process.execPath, [join(root, 'scripts/addy-transfer.mjs'), f.repo, f.taskName, f.rel, 'builder', f.request.ownerDigest, 'builder', 'attempt-1', '0', '--boundary', f.rel + '=builder=absent', ...flags], { encoding: 'utf8' });
  assert.notEqual(r.status, 0); assert.match(r.stderr, /Transfer disabled: safe directory-relative no-follow isolation is unavailable/);
  for (const args of [[], ['--bad', 'malformed'], ['a', 'b', '--boundary', 'invalid']]) {
    const malformed = spawnSync(process.execPath, [join(root, 'scripts/addy-transfer.mjs'), ...args], { encoding: 'utf8' });
    assert.equal(malformed.status, r.status); assert.equal(malformed.stderr, r.stderr);
  }
  assert.equal(existsSync(join(f.repo, f.rel)), false);
  assert.equal(executeGraph(f.repo, f.boundary, 'graph', 'inspect').revision, 0);
});

test('candidate CLI runs through ordinary relative and absolute script paths', () => {
  const f = fixture();
  for (const path of ['scripts/addy-candidate.mjs', script]) {
    const result = spawnSync(process.execPath, [path, f.repo, '--authorize-repository-control', 'inventory'], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr); assert.ok(JSON.parse(result.stdout).paths.includes('README.md'));
  }
});

test('candidate CLI follows an explicit symlink and produces real inventory output', () => {
  const f = fixture(), link = join(f.parent, 'candidate-link.mjs'); symlinkSync(script, link);
  const result = spawnSync(process.execPath, [link, f.repo, '--authorize-repository-control', 'inventory'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr); assert.ok(JSON.parse(result.stdout).paths.includes('README.md'));
});

test('disabled transfer never inspects getters or proxies', () => {
  let accesses = 0;
  const proxy = new Proxy({}, { get() { accesses++; throw new Error('proxy accessed'); }, ownKeys() { accesses++; throw new Error('proxy enumerated'); } });
  const getter = { get authorization() { accesses++; throw new Error('getter accessed'); } };
  for (const request of [proxy, getter, null, undefined]) assert.throws(() => transferCandidate(request), /Transfer disabled: safe directory-relative no-follow isolation is unavailable/);
  assert.equal(accesses, 0);
});

for (const module of ['addy-graph.mjs', 'addy-candidate.mjs']) test(`importing ${module} does not inspect nonexistent argv or touch non-module filesystem paths`, () => {
  const code = `
    import fs from 'node:fs'; import child from 'node:child_process'; import {syncBuiltinESMExports} from 'node:module'; import {fileURLToPath} from 'node:url';
    const calls = [], originals = {}, allowed = new Set([fileURLToPath(process.argv[2]), ${JSON.stringify(join(root, 'scripts/addy-graph.mjs'))}]), moduleFds = new Set();
    for (const key of ['lstatSync','realpathSync','openSync','readFileSync','readSync','readlinkSync','readdirSync','fstatSync','mkdirSync','writeFileSync','symlinkSync','renameSync','fsyncSync','closeSync']) {
      originals[key] = fs[key]; fs[key] = (...args) => {
        if (key === 'openSync' && allowed.has(args[0] instanceof URL ? fileURLToPath(args[0]) : String(args[0]))) { const fd = originals[key](...args); moduleFds.add(fd); return fd; }
        if ((key === 'readSync' || key === 'closeSync') && moduleFds.has(args[0])) { const out = originals[key](...args); if (key === 'closeSync') moduleFds.delete(args[0]); return out; }
        calls.push(key + ':' + String(args[0])); return originals[key](...args);
      };
    }
    const spawn = child.spawnSync; child.spawnSync = (...args) => { calls.push('spawnSync'); return spawn(...args); }; syncBuiltinESMExports();
    await import(process.argv[2]);
    if (calls.length) { console.error('Import invoked unexpected filesystem or Git APIs:', calls.join(',')); process.exit(4); }
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', code, '/definitely-nonexistent-argv-path/entry', new URL('../scripts/' + module, import.meta.url).href], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});

for (const variant of ['source-parent', 'target-and-git-control-parents']) test(`disabled transfer makes no filesystem or Git calls during ${variant} swap`, () => {
  const f = transferFixture(), external = join(f.parent, 'outside-source-target'), externalControl = join(f.parent, 'outside-control');
  mkdirSync(external); mkdirSync(externalControl); writeFileSync(join(external, 'sentinel'), 'outside-data'); writeFileSync(join(externalControl, 'sentinel'), 'outside-control-data');
  const code = `
    import fs from 'node:fs'; import child from 'node:child_process'; import {syncBuiltinESMExports} from 'node:module';
    import {transferCandidate} from ${JSON.stringify(new URL('../scripts/addy-candidate.mjs', import.meta.url).href)};
    const req = JSON.parse(process.argv[2]), variant = process.argv[3], outside = process.argv[4], control = process.argv[5], saved = process.argv[6];
    const calls = [], orig = {};
    for (const key of ['lstatSync','realpathSync','openSync','readFileSync','readSync','readlinkSync','readdirSync','fstatSync','mkdirSync','writeFileSync','symlinkSync','renameSync','fsyncSync','closeSync']) {
      orig[key] = fs[key]; fs[key] = (...args) => { calls.push(key); return orig[key](...args); };
    }
    const spawn = child.spawnSync; child.spawnSync = (...args) => { calls.push('spawnSync'); return spawn(...args); }; syncBuiltinESMExports();
    if (variant === 'source-parent') { orig.renameSync(req.ownerProject + '/docs', saved); orig.symlinkSync(outside, req.ownerProject + '/docs'); }
    else { orig.symlinkSync(outside, req.ownerProject + '/.agent-work/linked-worktrees'); orig.symlinkSync(control, req.ownerProject + '/.git/worktrees'); }
    try { transferCandidate(req); process.exit(2); } catch (e) { if (!/Transfer disabled: safe directory-relative no-follow isolation is unavailable/.test(e.message)) { console.error(e); process.exit(3); } }
    if (calls.length) { console.error('Unexpected filesystem or Git calls:', calls.join(',')); process.exit(4); }
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', code, root, JSON.stringify(f.request), variant, external, externalControl, join(f.parent, 'source-retained')], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(readdirSync(external), ['sentinel']); assert.equal(readFileSync(join(external, 'sentinel'), 'utf8'), 'outside-data');
  assert.deepEqual(readdirSync(externalControl), ['sentinel']); assert.equal(readFileSync(join(externalControl, 'sentinel'), 'utf8'), 'outside-control-data');
  assert.equal(executeGraph(f.repo, f.boundary, 'graph', 'inspect').revision, 0, 'No graph start or Git creation side effects');
});

test.skip('transfer refuses unauthorized or excluded content before creating a worktree [transfer disabled]', () => {
  assert.throws(() => transferCandidate({ ownerProject: '/not-authorized' }), /Explicit transfer source/);
  const f = transferFixture(true);
  assert.throws(() => transferCandidate(f.request), /fully selected supported/);
  assert.equal(existsSync(join(f.repo, f.rel)), false); assert.equal(executeGraph(f.repo, f.boundary, 'graph', 'inspect').revision, 0);
  assert.equal(existsSync(join(f.repo, 'secret.fixture')), true);
  const unsupported = transferFixture(false, true);
  assert.throws(() => transferCandidate(unsupported.request), /fully selected supported/);
  assert.equal(existsSync(join(unsupported.repo, unsupported.rel)), false);
  const occupied = transferFixture(); mkdirSync(join(occupied.repo, occupied.rel), { recursive: true });
  writeFileSync(join(occupied.repo, occupied.rel, 'user-owned'), 'preserve');
  assert.throws(() => transferCandidate(occupied.request));
  assert.equal(readFileSync(join(occupied.repo, occupied.rel, 'user-owned'), 'utf8'), 'preserve');
  assert.equal(executeGraph(occupied.repo, occupied.boundary, 'graph', 'inspect').revision, 0);
});

test.skip('interrupted transfer stays quarantined and cannot be blindly replayed [transfer disabled]', () => {
  const early = transferFixture();
  assert.throws(() => transferCandidate({ ...early.request, afterStart: () => { throw new Error('simulated interruption'); } }), /simulated interruption/);
  let graph = executeGraph(early.repo, early.boundary, 'graph', 'inspect'); assert.equal(graph.attempts[0].status, 'running');
  assert.equal(existsSync(join(early.repo, early.rel)), false);
  assert.throws(() => transferCandidate({ ...early.request, expectedRevision: 1 }), /Attempt ID already used|unresolved running/);
  executeGraph(early.repo, early.boundary, 'graph', 'apply', { op: 'reconcile', expected: 1, attempt: 'attempt-1', outcome: 'abandoned', note: 'Inspected: creation never began' });
  assert.throws(() => transferCandidate({ ...early.request, expectedRevision: 2 }), /Attempt ID already used/);
  const resumed = transferCandidate({ ...early.request, attempt: 'attempt-2', expectedRevision: 2 }); assert.equal(resumed.graphRevision, 4);
  const partial = transferFixture();
  assert.throws(() => transferCandidate({ ...partial.request, afterEntry: () => { throw new Error('partial copy interruption'); } }), /partial copy interruption/);
  graph = executeGraph(partial.repo, partial.boundary, 'graph', 'inspect'); assert.equal(graph.attempts[0].status, 'running');
  assert.equal(existsSync(join(partial.repo, partial.rel, '.git')), true);
  assert.throws(() => transferCandidate({ ...partial.request, expectedRevision: 1 }), /control identities/);
  assert.equal(existsSync(join(partial.repo, partial.rel, '.git')), true, 'Partial target is preserved for reconciliation');
  executeGraph(partial.repo, partial.boundary, 'graph', 'apply', { op: 'reconcile', expected: 1, attempt: 'attempt-1', outcome: 'failed', note: 'Partial target retained' });
  assert.throws(() => transferCandidate({ ...partial.request, expectedRevision: 2, attempt: 'attempt-2' }), /control identities/);
});

test.skip('transfer does not publish success when its terminal graph record becomes stale [transfer disabled]', () => {
  const f = transferFixture(), reference = join(f.boundary, 'manifests', f.request.ownerDigest + '.json');
  assert.throws(() => transferCandidate({ ...f.request, beforeFinish: () => executeGraph(f.repo, f.boundary, 'graph', 'apply', {
    op: 'baseline', expected: 1, digest: f.request.ownerDigest, ref: reference,
  }) }), /Stale or missing expected revision/);
  const graph = executeGraph(f.repo, f.boundary, 'graph', 'inspect');
  assert.equal(graph.attempts[0].status, 'running'); assert.equal(graph.slices[0].valid, false);
  assert.equal(existsSync(join(f.repo, f.rel, '.git')), true);
});

test.skip('transfer quarantines source-selection and target-control drift [transfer disabled]', () => {
  const selection = transferFixture();
  assert.throws(() => transferCandidate({ ...selection.request, afterEntry: () => writeFileSync(join(selection.boundary, 'selection.json'), JSON.stringify({ include: [], exclude: [] })) }), /Authorized source selection changed/);
  assert.equal(executeGraph(selection.repo, selection.boundary, 'graph', 'inspect').attempts[0].status, 'running');
  const control = transferFixture();
  assert.throws(() => transferCandidate({ ...control.request, afterEntry: () => {
    const pointer = join(control.repo, control.rel, '.git'); writeFileSync(pointer, readFileSync(pointer, 'utf8'));
  } }), /ownership or index changed/);
  assert.equal(executeGraph(control.repo, control.boundary, 'graph', 'inspect').attempts[0].status, 'running');
});

test.skip('add-only transfer CLI creates three dirty linked worktrees with retained graph evidence [transfer disabled]', () => {
  const f = fixture(), taskName = 'transfer-three', names = ['build-a', 'build-b', 'build-c'];
  const rel = name => '.agent-work/linked-worktrees/' + name, boundary = join(f.repo, '.agent-work/addy-coordination', taskName);
  const ownerFlags = ['--authorize-repository-control', '--authorize-coordination-artifacts', '--authorize-nested-linked-controls', ...names.flatMap(name => ['--nested-linked', rel(name) + '=' + name]), '--coordination', taskName];
  const transferFlags = ['--authorize-repository-control', '--authorize-coordination-artifacts', '--authorize-nested-linked-controls', '--authorize-selected-source-content', '--authorize-worktree-create', '--authorize-target-write', '--authorize-target-control', '--authorize-target-coordination-artifacts'];
  writeFileSync(join(f.repo, 'README.md'), 'stage\n'); f.git(f.repo, 'add', 'README.md'); writeFileSync(join(f.repo, 'README.md'), 'unstaged\n');
  writeFileSync(join(f.repo, 'untracked'), 'untracked\n'); chmodSync(join(f.repo, 'PLAN.md'), 0o755);
  renameSync(join(f.repo, 'docs/roles-library.md'), join(f.repo, 'docs/roles-library.md.moved')); f.git(f.repo, 'add', '-A', '--', 'docs/roles-library.md');
  symlinkSync('fixture-target', join(f.repo, 'link-fixture')); initCoordination(f.repo, taskName, coordAuth);
  const runOwner = (...args) => spawnSync(process.execPath, [script, f.repo, ...ownerFlags, ...args], { encoding: 'utf8' });
  let r = runOwner('inventory'); assert.equal(r.status, 0, r.stderr);
  const selection = join(boundary, 'selection.json'); writeFileSync(selection, JSON.stringify({ include: JSON.parse(r.stdout).paths, exclude: [] }));
  r = runOwner('capture', selection, '--write-manifest'); assert.equal(r.status, 0, r.stderr); const owner = JSON.parse(r.stdout);
  executeGraph(f.repo, boundary, 'graph', 'init', { op: 'init', baseline: owner.digest, baselineRef: join(boundary, 'manifests', owner.digest + '.json'), slices: names.map(id => ({ id, depends: [] })) });
  const identities = new Map(), transferred = new Map(); let revision = 0;
  for (const name of names) {
    const inputs = names.flatMap(n => ['--boundary', `${rel(n)}=${n}=${identities.get(n) ?? 'absent'}`]);
    r = spawnSync(process.execPath, [join(root, 'scripts/addy-transfer.mjs'), f.repo, taskName, rel(name), name, owner.digest, name, 'attempt-' + name, String(revision), ...inputs, ...transferFlags], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr); const result = JSON.parse(r.stdout); identities.set(name, result.targetControlIdentity); transferred.set(name, result); revision += 2;
  }
  const graph = executeGraph(f.repo, boundary, 'graph', 'inspect'); assert.equal(graph.revision, 6); assert.ok(graph.attempts.every(a => a.status === 'completed'));
  const compareFlags = ['--authorize-owner-repository-control', '--authorize-owner-coordination-artifacts', '--authorize-owner-nested-linked-controls', '--authorize-linked-repository-control', '--authorize-linked-coordination-artifacts', '--authorize-linked-control'];
  for (const name of names) {
    const others = names.filter(n => n !== name).flatMap(n => ['--additional-owner-boundary', `${rel(n)}=${n}=${identities.get(n)}`]);
    r = spawnSync(process.execPath, [join(root, 'scripts/addy-compare.mjs'), f.repo, join(f.repo, rel(name)), taskName, rel(name), name, identities.get(name), owner.digest, transferred.get(name).linkedDigest, ...compareFlags, ...others], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr); assert.equal(JSON.parse(r.stdout).equal, true);
  }
});

test('three declared linked builders compare independently with the same retained owner baseline', () => {
  const f = fixture(), taskName = 'three-builders', names = ['builder-a', 'builder-b', 'builder-c'];
  const rel = name => '.agent-work/linked-worktrees/' + name, tree = name => join(f.repo, rel(name));
  const common = ['--authorize-repository-control', '--authorize-coordination-artifacts'];
  const nested = names.flatMap(name => ['--nested-linked', rel(name) + '=' + name]);
  const ownerFlags = [...common, '--authorize-nested-linked-controls', ...nested, '--coordination', taskName];
  const linkedFlags = [...common, '--authorize-linked-control', '--linked-project-root', f.repo, '--coordination', taskName];
  const flags = ['--authorize-owner-repository-control', '--authorize-owner-coordination-artifacts', '--authorize-owner-nested-linked-controls', '--authorize-linked-repository-control', '--authorize-linked-coordination-artifacts', '--authorize-linked-control'];
  const run = (project, options, ...args) => spawnSync(process.execPath, [script, project, ...options, ...args], { encoding: 'utf8' });
  const dirty = project => {
    writeFileSync(join(project, 'README.md'), 'stage\n'); f.git(project, 'add', 'README.md'); writeFileSync(join(project, 'README.md'), 'unstaged\n');
    writeFileSync(join(project, 'new-fixture'), 'untracked\n'); chmodSync(join(project, 'PLAN.md'), 0o755);
    renameSync(join(project, 'docs/roles-library.md'), join(project, 'docs/roles-library.md.moved')); f.git(project, 'add', '-A', '--', 'docs/roles-library.md');
    symlinkSync('fixture-target', join(project, 'fixture-link'));
  };
  dirty(f.repo); initCoordination(f.repo, taskName, coordAuth);
  let r = run(f.repo, ownerFlags, 'inventory'); assert.equal(r.status, 0, r.stderr);
  const ownerSelection = join(f.repo, '.agent-work/addy-coordination', taskName, 'selection.json');
  writeFileSync(ownerSelection, JSON.stringify({ include: JSON.parse(r.stdout).paths, exclude: [] }));
  r = run(f.repo, ownerFlags, 'capture', ownerSelection, '--write-manifest'); assert.equal(r.status, 0, r.stderr); const owner = JSON.parse(r.stdout);
  const results = new Map(), identities = new Map();
  const setup = name => {
    const worktree = tree(name); f.git(f.repo, 'worktree', 'add', '--detach', '--no-checkout', worktree, f.initial);
    f.git(worktree, 'read-tree', 'HEAD'); f.git(worktree, 'checkout-index', '-a'); dirty(worktree);
    initCoordination(worktree, taskName, { ...coordAuth, authorizeLinkedControl: true, linkedProjectRoot: f.repo });
    const selection = join(worktree, '.agent-work/addy-coordination', taskName, 'selection.json');
    let x = run(worktree, linkedFlags, 'inventory'); assert.equal(x.status, 0, x.stderr);
    writeFileSync(selection, JSON.stringify({ include: JSON.parse(x.stdout).paths, exclude: [] }));
    x = run(worktree, linkedFlags, 'capture', selection, '--write-manifest'); assert.equal(x.status, 0, x.stderr);
    results.set(name, { candidate: JSON.parse(x.stdout), selection });
  };
  const refreshIdentities = () => {
    const x = run(f.repo, ownerFlags, 'inventory'); assert.equal(x.status, 0, x.stderr);
    for (const entry of JSON.parse(x.stdout).nestedLinkedBoundaries) identities.set(entry.path, entry.identity);
  };
  const compare = (name, extraNames = names.filter(x => x !== name)) => {
    const extra = extraNames.flatMap(x => ['--additional-owner-boundary', `${rel(x)}=${x}=${identities.get(rel(x)) ?? '0'.repeat(64)}`]);
    return spawnSync(process.execPath, [join(root, 'scripts/addy-compare.mjs'), f.repo, tree(name), taskName, rel(name), name,
      identities.get(rel(name)) ?? '0'.repeat(64), owner.digest, results.get(name).candidate.digest, ...flags, ...extra], { encoding: 'utf8' });
  };
  setup(names[0]); refreshIdentities(); r = compare(names[0]); assert.notEqual(r.status, 0); assert.match(r.stderr, /control identities/);
  setup(names[1]); setup(names[2]); refreshIdentities();
  for (const name of names) {
    r = compare(name); assert.equal(r.status, 0, r.stderr); const evidence = JSON.parse(r.stdout);
    assert.equal(evidence.linkedBoundary, rel(name)); assert.equal(evidence.ownerBoundaries.length, 3); assert.equal(evidence.ownerDigest, owner.digest);
  }
  r = compare(names[0], [names[1]]); assert.notEqual(r.status, 0); assert.match(r.stderr, /Unknown nested repository|digest mismatch|incompatible/);
  r = compare(names[0], [names[1], names[1]]); assert.notEqual(r.status, 0); assert.match(r.stderr, /Overlapping nested/);
  writeFileSync(join(tree(names[1]), 'README.md'), 'builder mismatch\n');
  r = compare(names[1]); assert.notEqual(r.status, 0); assert.match(r.stderr, /digest mismatch/);
  r = run(tree(names[1]), linkedFlags, 'capture', results.get(names[1]).selection, '--write-manifest'); assert.equal(r.status, 0, r.stderr);
  results.get(names[1]).candidate = JSON.parse(r.stdout); r = compare(names[1]); assert.notEqual(r.status, 0); assert.match(r.stderr, /Candidate contents differ/);
  r = compare(names[2]); assert.equal(r.status, 0, r.stderr);
  const pointer = join(tree(names[2]), '.git'); writeFileSync(pointer, readFileSync(pointer, 'utf8'));
  r = compare(names[0]); assert.notEqual(r.status, 0); assert.match(r.stderr, /control identities/);
});

test('API verification checks repository authority before touching nested controls', t => {
  if (process.platform !== 'darwin' || !existsSync('/usr/bin/sandbox-exec')) { t.skip('macOS sandbox-exec unavailable'); return; }
  const f = fixture(), rel = '.agent-work/linked-worktrees/builder', tree = join(f.repo, rel);
  f.git(f.repo, 'worktree', 'add', '--detach', '--no-checkout', tree, f.initial);
  const dotgit = join(tree, '.git'), profile = `(version 1)(allow default)(deny file-read-data (literal ${JSON.stringify(dotgit)}))`;
  const options = { authorizeCoordinationArtifacts: true, authorizeNestedLinkedControls: true, coordination: 'task', nestedLinked: [{ path: rel, controlId: 'builder' }] };
  const code = `import {verifyCandidate} from ${JSON.stringify(new URL('../scripts/addy-candidate.mjs', import.meta.url).href)}; try {verifyCandidate(process.argv[1], {include:[],exclude:[]}, '0'.repeat(64), JSON.parse(process.argv[2])); process.exit(2)} catch(e) {if (!/Explicit repository-control read authorization required/.test(e.message)) {console.error(e.message);process.exit(3)}}`;
  const denied = spawnSync('/usr/bin/sandbox-exec', ['-p', profile, process.execPath, '-e', 'try {require("node:fs").readFileSync(process.argv[1]);process.exit(1)} catch(e) {if (!["EPERM","EACCES"].includes(e.code)) process.exit(2)}', dotgit], { encoding: 'utf8' });
  assert.equal(denied.status, 0, denied.stderr);
  const result = spawnSync('/usr/bin/sandbox-exec', ['-p', profile, process.execPath, '--input-type=module', '-e', code, f.repo, JSON.stringify(options)], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});

test('nested owner boundaries require exact authorization, paths and control identity and reject unknown repositories', () => {
  const f = fixture(), rel = '.agent-work/linked-worktrees/builder', tree = join(f.repo, rel);
  initCoordination(f.repo, 'task', coordAuth);
  const options = { ...coordAuth, coordination: 'task', authorizeNestedLinkedControls: true, nestedLinked: [{ path: rel, controlId: 'builder' }] };
  assert.throws(() => inventoryCandidate(f.repo, { ...options, authorizeNestedLinkedControls: false }), /explicit control authorization/);
  assert.throws(() => inventoryCandidate(f.repo, { ...options, nestedLinked: [{ path: '../outside', controlId: 'x' }] }), /unsafe Git path/);
  assert.throws(() => inventoryCandidate(f.repo, { ...options, nestedLinked: [{ path: rel, controlId: 'builder' }, { path: rel + '/child', controlId: 'child' }] }), /Overlapping/);
  const inv = inventoryCandidate(f.repo, options), selection = { include: inv.paths, exclude: [] };
  writeFileSync(join(f.repo, '.agent-work/addy-coordination/task/selection.json'), JSON.stringify(selection));
  const candidate = captureCandidate(f.repo, selection, options);
  f.git(f.repo, 'worktree', 'add', '--detach', '--no-checkout', tree, f.initial);
  assert.throws(() => inventoryCandidate(f.repo, { ...coordAuth, coordination: 'task' }), /Unknown nested repository/);
  assert.throws(() => verifyCandidate(f.repo, selection, candidate.digest, { ...coordAuth, coordination: 'task' }), /Unknown nested repository/);
  assert.throws(() => inventoryCandidate(f.repo, { ...options, nestedLinked: [{ path: rel, controlId: 'wrong' }] }), /control identity mismatch/);
  assert.throws(() => verifyCandidate(f.repo, selection, candidate.digest, { ...options, nestedLinked: [...options.nestedLinked, { path: '.agent-work/linked-worktrees/absent', controlId: 'absent' }] }), /control identities/);
  symlinkSync(f.parent, join(f.repo, '.agent-work/linked-worktrees/unsafe'));
  assert.throws(() => inventoryCandidate(f.repo, { ...options, nestedLinked: [...options.nestedLinked, { path: '.agent-work/linked-worktrees/unsafe', controlId: 'unsafe' }] }), /Unsafe nested linked-worktree path/);
  const current = inventoryCandidate(f.repo, options).nestedLinkedBoundaries[0];
  const expectedNestedIdentities = [{ path: rel, identity: current.identity }];
  assert.throws(() => verifyCandidate(f.repo, selection, candidate.digest, options), /control identities/);
  renameSync(tree, tree + '-retained');
  assert.throws(() => verifyCandidate(f.repo, selection, candidate.digest, { ...options, expectedNestedIdentities }), /control identities/);
  renameSync(tree + '-retained', tree);
  const pointer = join(tree, '.git'), old = readFileSync(pointer, 'utf8');
  writeFileSync(pointer, 'gitdir: ' + join(f.parent, 'outside') + '\n');
  assert.throws(() => inventoryCandidate(f.repo, options), /escapes the declared common/); writeFileSync(pointer, old);
  const changed = inventoryCandidate(f.repo, options).nestedLinkedBoundaries[0];
  assert.notEqual(changed.identity, current.identity, 'Control pointer replacement invalidates the retained identity');
  assert.throws(() => verifyCandidate(f.repo, selection, candidate.digest, { ...options, expectedNestedIdentities }), /control identities/);
  const extra = join(f.repo, '.agent-work/linked-worktrees/extra');
  f.git(f.repo, 'worktree', 'add', '--detach', '--no-checkout', extra, f.initial);
  assert.throws(() => inventoryCandidate(f.repo, options), /Unknown nested repository/);
});

test('nested boundary cannot hide a tracked but absent index path', () => {
  const f = fixture(), rel = '.agent-work/linked-worktrees/reserved', directory = join(f.repo, rel);
  mkdirSync(directory, { recursive: true }); writeFileSync(join(directory, 'tracked'), 'tracked'); f.git(f.repo, 'add', rel + '/tracked');
  renameSync(directory, join(f.repo, '.agent-work/linked-worktrees/retained'));
  initCoordination(f.repo, 'task', coordAuth);
  assert.throws(() => inventoryCandidate(f.repo, { ...coordAuth, coordination: 'task', authorizeNestedLinkedControls: true, nestedLinked: [{ path: rel, controlId: 'reserved' }] }), /Tracked candidate path overlaps/);
});

test('linked worktrees use separately authorized common and per-worktree controls with matching candidate identity', () => {
  const f = linkedFixture(), one = f.make('one'), two = f.make('two');
  const linkedOptions = { ...coordAuth, authorizeLinkedControl: true, linkedProjectRoot: f.repo, coordination: 'task' };
  assert.throws(() => inventoryCandidate(one, auth), /explicit linked-control authorization/);
  for (const tree of [one, two]) {
    writeFileSync(join(tree, 'README.md'), 'staged fixture\n'); f.git(tree, 'add', 'README.md');
    writeFileSync(join(tree, 'README.md'), 'unstaged fixture\n');
    writeFileSync(join(tree, 'new-file.txt'), 'untracked fixture\n');
  }
  const digests = [];
  for (const tree of [one, two]) {
    const run = (...args) => spawnSync(process.execPath, [script, tree, '--authorize-repository-control', '--authorize-linked-control', '--linked-project-root', f.repo, '--authorize-coordination-artifacts', ...args], { encoding: 'utf8' });
    let result = run('init-coordination', 'task'); assert.equal(result.status, 0, result.stderr);
    result = run('--coordination', 'task', 'inventory'); assert.equal(result.status, 0, result.stderr);
    const listing = JSON.parse(result.stdout), boundary = join(tree, '.agent-work/addy-coordination/task');
    const selection = join(boundary, 'selection.json'); writeFileSync(selection, JSON.stringify({ include: listing.paths, exclude: [] }));
    result = run('--coordination', 'task', 'capture', selection, '--write-manifest'); assert.equal(result.status, 0, result.stderr);
    const captured = JSON.parse(result.stdout); digests.push(captured.digest);
    assert.equal(captured.manifest.coverage, 'all-task-relevant');
    assert.equal(captured.manifest.index.find(x => x.path === 'README.md').sha256, sha('staged fixture\n'));
    assert.equal(captured.manifest.worktree.find(x => x.path === 'README.md').sha256, sha('unstaged fixture\n'));
    assert.equal(captured.manifest.worktree.find(x => x.path === 'new-file.txt').sha256, sha('untracked fixture\n'));
    executeGraph(tree, boundary, 'graph', 'init', { op: 'init', baseline: captured.digest, baselineRef: join(boundary, 'manifests', captured.digest + '.json'), slices: [{ id: 'slice', depends: [] }] });
    result = run('--coordination', 'task', 'verify', selection, captured.digest); assert.equal(result.status, 0, result.stderr);
    assert.equal(inventoryCandidate(tree, linkedOptions).coordinationBoundary, '.agent-work/addy-coordination/task');
  }
  assert.equal(digests[0], digests[1], 'Content identity is reproducible across linked worktrees');
});

test('linked control authorization, path escapes, backlink/config drift and pointer races fail closed', () => {
  const f = linkedFixture(), tree = f.make('one'), options = { ...auth, authorizeLinkedControl: true, linkedProjectRoot: f.repo };
  const dotgit = join(tree, '.git'), originalPointer = readFileSync(dotgit, 'utf8');
  const gitdir = originalPointer.trim().slice('gitdir: '.length), commonFile = join(gitdir, 'commondir'), backlinkFile = join(gitdir, 'gitdir');
  const originalCommon = readFileSync(commonFile, 'utf8'), originalBacklink = readFileSync(backlinkFile, 'utf8');
  const unrelated = fixture();
  assert.throws(() => inventoryCandidate(tree, { ...options, linkedProjectRoot: unrelated.repo }), /inside the owning project root/);
  const alias = join(f.parent, 'owner-alias'); symlinkSync(f.repo, alias);
  assert.throws(() => inventoryCandidate(tree, { ...options, linkedProjectRoot: alias }), /real path/);
  writeFileSync(dotgit, 'gitdir: ' + join(f.parent, 'outside-private-control') + '\n');
  assert.throws(() => inventoryCandidate(tree, options), /escapes the declared common/);
  writeFileSync(dotgit, originalPointer);
  writeFileSync(commonFile, '../../../outside-private\n');
  assert.throws(() => inventoryCandidate(tree, options), /common Git directory mismatch/);
  writeFileSync(commonFile, originalCommon);
  writeFileSync(backlinkFile, join(f.parent, 'other-worktree/.git') + '\n');
  assert.throws(() => inventoryCandidate(tree, options), /backlink mismatch/);
  writeFileSync(backlinkFile, originalBacklink);
  const paths = inventoryCandidate(tree, options).paths;
  assert.throws(() => captureCandidate(tree, { include: paths, exclude: [] }, { ...options, beforeSecondPass: () => writeFileSync(commonFile, '../../../outside-private\n') }), /common Git directory mismatch/);
  writeFileSync(commonFile, originalCommon);
  const config = join(f.repo, '.git/config'); writeFileSync(config, readFileSync(config, 'utf8') + '\n[include]\n path = ' + join(f.parent, 'outside-private') + '\n');
  assert.throws(() => inventoryCandidate(tree, options), /unsupported/i);
});

test('linked Git-directory symlinks are rejected before following their target', () => {
  const f = fixture(), fake = join(f.repo, '.agent-work/fake'); mkdirSync(fake, { recursive: true });
  const outside = join(f.parent, 'external-control'); mkdirSync(outside); mkdirSync(join(outside, 'fake'));
  symlinkSync(outside, join(f.repo, '.git/worktrees'));
  writeFileSync(join(fake, '.git'), 'gitdir: ' + join(f.repo, '.git/worktrees/fake') + '\n');
  assert.throws(() => inventoryCandidate(fake, { ...auth, authorizeLinkedControl: true, linkedProjectRoot: f.repo }), /Unsafe linked Git directory/);
});

test('hard-linked linked-worktree control pointers are rejected', () => {
  const f = linkedFixture(), original = f.make('one'), fake = join(f.repo, '.agent-work/linked/fake'); mkdirSync(fake);
  linkSync(join(original, '.git'), join(fake, '.git'));
  assert.throws(() => inventoryCandidate(fake, { ...auth, authorizeLinkedControl: true, linkedProjectRoot: f.repo }), /Unsafe Git control pointer/);
});

test('linked pointer contents are not read before separate authorization', t => {
  if (process.platform !== 'darwin' || !existsSync('/usr/bin/sandbox-exec')) { t.skip('macOS sandbox-exec unavailable'); return; }
  const f = linkedFixture(), tree = f.make('one'), dotgit = join(tree, '.git');
  const profile = `(version 1)(allow default)(deny file-read-data (literal ${JSON.stringify(dotgit)}))`;
  const run = args => spawnSync('/usr/bin/sandbox-exec', ['-p', profile, process.execPath, ...args], { encoding: 'utf8' });
  const denied = run(['-e', 'try {require("node:fs").readFileSync(process.argv[1]); process.exit(1)} catch(e) {if (!["EPERM","EACCES"].includes(e.code)) process.exit(2)}', dotgit]);
  assert.equal(denied.status, 0, denied.stderr);
  const result = run([script, tree, '--authorize-repository-control', 'inventory']);
  assert.notEqual(result.status, 0); assert.match(result.stderr, /explicit linked-control authorization/);
});

test('linked worktree gitdir indirection is rejected without following it', () => {
  const { parent } = fixture(), linked = join(parent, 'linked'); mkdirSync(linked);
  writeFileSync(join(linked, '.git'), 'gitdir: ' + join(parent, 'outside-private-control') + '\n');
  assert.throws(() => inventory(linked), /explicit linked-control authorization/);
});

test('OS-enforced read denial confirms inventory and capture do not require excluded worktree contents', t => {
  if (process.platform !== 'darwin' || !existsSync('/usr/bin/sandbox-exec')) { t.skip('macOS sandbox-exec unavailable'); return; }
  const { parent, repo } = fixture(), ignore = join(repo, '.gitignore'), secret = join(repo, 'private.ignored-secret');
  writeFileSync(ignore, '*.ignored-secret\n'); writeFileSync(secret, 'private bytes');
  const profile = `(version 1)(allow default)(deny file-read-data (literal ${JSON.stringify(ignore)}))(deny file-read-data (literal ${JSON.stringify(secret)}))`;
  const sandbox = args => spawnSync('/usr/bin/sandbox-exec', ['-p', profile, process.execPath, ...args], { encoding: 'utf8' });
  for (const file of [ignore, secret]) {
    const denied = sandbox(['-e', 'try {require("node:fs").readFileSync(process.argv[1]); process.exit(1)} catch(e) {if (!["EPERM","EACCES"].includes(e.code)) process.exit(2)}', file]);
    assert.equal(denied.status, 0, denied.stderr);
  }
  const listing = sandbox([script, repo, '--authorize-repository-control', 'inventory']);
  assert.equal(listing.status, 0, listing.stderr);
  const paths = JSON.parse(listing.stdout).paths;
  assert.ok(paths.includes('private.ignored-secret'), 'ignore rules are not evaluated');
  const selection = { include: paths.filter(path => !['.gitignore', 'private.ignored-secret'].includes(path)), exclude: ['.gitignore', 'private.ignored-secret'] };
  const file = join(parent, 'selection.json'); writeFileSync(file, JSON.stringify(selection));
  const result = sandbox([script, repo, '--authorize-repository-control', 'capture', file]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).manifest.coverage, 'partial');
});

test('unreadable untracked directory cannot masquerade as a complete inventory', t => {
  if (process.getuid?.() === 0) { t.skip('Requires a non-root test user'); return; }
  const { repo } = fixture(), dir = join(repo, 'unreadable'); mkdirSync(dir); writeFileSync(join(dir, 'private'), 'fixture'); chmodSync(dir, 0);
  const raw = spawnSync('git', ['-C', repo, 'ls-files', '--others', '-z'], { encoding: 'utf8' });
  assert.equal(raw.status, 0, 'Git itself can return success after omitting an unreadable directory');
  assert.match(raw.stderr, /unreadable|Permission denied|could not open/i);
  assert.throws(() => inventory(repo), /diagnostics.*completeness/);
});

test('coordination artifacts require separate explicit read scope before boundary content access', t => {
  if (process.platform !== 'darwin' || !existsSync('/usr/bin/sandbox-exec')) { t.skip('macOS sandbox-exec unavailable'); return; }
  const { repo } = fixture();
  assert.throws(() => initCoordination(repo, 'not-authorized', auth), /coordination-artifact authorization/);
  assert.equal(existsSync(join(repo, '.agent-work/addy-coordination/not-authorized')), false);
  initCoordination(repo, 'task', coordAuth);
  const boundary = join(repo, '.agent-work/addy-coordination/task');
  const profile = `(version 1)(allow default)(deny file-read-data (subpath ${JSON.stringify(boundary)}))`;
  const run = args => spawnSync('/usr/bin/sandbox-exec', ['-p', profile, process.execPath, ...args], { encoding: 'utf8' });
  const denied = run(['-e', 'try {require("node:fs").readFileSync(process.argv[1]); process.exit(1)} catch(e) {if (!["EPERM","EACCES"].includes(e.code)) process.exit(2)}', join(boundary, 'coordination.json')]);
  assert.equal(denied.status, 0, denied.stderr);
  const result = run([script, repo, '--authorize-repository-control', '--coordination', 'task', 'inventory']);
  assert.notEqual(result.status, 0); assert.match(result.stderr, /Explicit coordination-artifact authorization required/);
  assert.throws(() => inventoryCandidate(repo, { ...auth, coordination: 'task' }), /coordination-artifact authorization/);
});

test('project-local coordination artifacts survive the complete documented CLI and graph flow', () => {
  const { repo } = fixture(), opts = { ...coordAuth, coordination: 'task-one' };
  const run = (...args) => spawnSync(process.execPath, [script, repo, '--authorize-repository-control', '--authorize-coordination-artifacts', ...args], { encoding: 'utf8' });
  let r = run('init-coordination', 'task-one'); assert.equal(r.status, 0, r.stderr);
  const boundary = join(repo, '.agent-work/addy-coordination/task-one');
  r = run('--coordination', 'task-one', 'inventory'); assert.equal(r.status, 0, r.stderr);
  const first = JSON.parse(r.stdout); assert.equal(first.coordinationBoundary, '.agent-work/addy-coordination/task-one');
  assert.ok(!first.paths.some(path => path.startsWith(first.coordinationBoundary + '/')));
  const selection = join(boundary, 'selection.json'); writeFileSync(selection, JSON.stringify({ include: first.paths, exclude: [] }));
  r = run('--coordination', 'task-one', 'capture', selection, '--write-manifest'); assert.equal(r.status, 0, r.stderr);
  const captured = JSON.parse(r.stdout); assert.equal(captured.manifest.coverage, 'all-task-relevant');
  assert.ok(captured.manifest.exclusions.includes('coordination boundary artifacts'));
  assert.equal(captured.manifest.coordinationBoundary, '.agent-work/addy-coordination/task-one');
  const graph = executeGraph(repo, boundary, 'graph', 'init', { op: 'init', baseline: captured.digest, baselineRef: join(boundary, 'manifests', captured.digest + '.json'), slices: [{ id: 'slice', depends: [] }] });
  assert.equal(graph.baseline.digest, captured.digest);
  executeGraph(repo, boundary, 'graph', 'apply', { op: 'start', expected: 0, slice: 'slice', attempt: 'attempt-1', worker: 'fixture', workspace: repo, taskRef: 'no worker' });
  executeGraph(repo, boundary, 'graph', 'apply', { op: 'reconcile', expected: 1, attempt: 'attempt-1', outcome: 'abandoned', note: 'No worker was started' });
  r = run('--coordination', 'task-one', 'verify', selection, captured.digest); assert.equal(r.status, 0, r.stderr);
  const manifestA = join(boundary, 'manifests', captured.digest + '.json'), oldEvidence = readFileSync(manifestA, 'utf8');
  writeFileSync(join(repo, 'README.md'), 'outside boundary changed\n');
  r = run('--coordination', 'task-one', 'verify', selection, captured.digest); assert.notEqual(r.status, 0); assert.match(r.stderr, /digest mismatch/);
  r = run('--coordination', 'task-one', 'capture', selection); assert.equal(r.status, 0, r.stderr);
  const candidateB = JSON.parse(r.stdout); assert.notEqual(candidateB.digest, captured.digest);
  r = run('--coordination', 'task-one', 'verify', selection, candidateB.digest); assert.notEqual(r.status, 0); assert.match(r.stderr, /Matching retained coordination manifest and identity required/);
  r = run('--coordination', 'task-one', 'capture', selection, '--write-manifest'); assert.equal(r.status, 0, r.stderr); assert.equal(JSON.parse(r.stdout).digest, candidateB.digest);
  assert.equal(readFileSync(manifestA, 'utf8'), oldEvidence, 'Candidate A evidence is never overwritten');
  const manifestB = join(boundary, 'manifests', candidateB.digest + '.json');
  const baselineB = executeGraph(repo, boundary, 'graph', 'apply', { op: 'baseline', expected: 2, digest: candidateB.digest, ref: manifestB });
  assert.equal(baselineB.baseline.digest, candidateB.digest); assert.equal(baselineB.baseline.ref, manifestB);
  r = run('--coordination', 'task-one', 'verify', selection, candidateB.digest); assert.equal(r.status, 0, r.stderr);
  r = run('--coordination', 'task-one', 'capture', selection, '--write-manifest'); assert.notEqual(r.status, 0); assert.match(r.stderr, /EEXIST/);
  writeFileSync(join(boundary, 'source.js'), 'must never be hidden');
  assert.throws(() => inventoryCandidate(repo, opts), /Unexpected file inside coordination boundary/);
});

test('replacing a coordination boundary between capture and verify fails closed', () => {
  const { repo } = fixture(), opts = { ...coordAuth, coordination: 'task' }; initCoordination(repo, 'task', coordAuth);
  const boundary = join(repo, '.agent-work/addy-coordination/task'), inv = inventoryCandidate(repo, opts);
  const selection = { include: inv.paths, exclude: [] }; writeFileSync(join(boundary, 'selection.json'), JSON.stringify(selection));
  const result = captureCandidate(repo, selection, opts); writeFileSync(join(boundary, 'manifest.json'), JSON.stringify(result));
  assert.equal(verifyCandidate(repo, selection, result.digest, opts).digest, result.digest);
  renameSync(boundary, boundary + '-moved'); mkdirSync(boundary);
  writeFileSync(join(boundary, 'coordination.json'), JSON.stringify({ version: 1, kind: 'addy-coordination', task: 'task', nonce: 'b'.repeat(32) }));
  writeFileSync(join(boundary, 'selection.json'), JSON.stringify(selection)); writeFileSync(join(boundary, 'manifest.json'), JSON.stringify(result));
  assert.throws(() => verifyCandidate(repo, selection, result.digest, opts), /Invalid coordination manifest/);
});

test('coordination boundary refuses preexisting, staged, symlinked and racing candidate material', () => {
  const one = fixture(), parent = join(one.repo, '.agent-work/addy-coordination'); mkdirSync(parent, { recursive: true });
  mkdirSync(join(parent, 'owned')); writeFileSync(join(parent, 'owned/source.js'), 'existing');
  assert.throws(() => initCoordination(one.repo, 'owned', coordAuth), /EEXIST/);
  mkdirSync(join(parent, 'incomplete'));
  assert.throws(() => initCoordination(one.repo, 'incomplete', coordAuth), /EEXIST/);
  assert.throws(() => inventoryCandidate(one.repo, { ...coordAuth, coordination: 'incomplete' }), /ENOENT/);
  const two = fixture(); initCoordination(two.repo, 'task', coordAuth);
  const boundary = join(two.repo, '.agent-work/addy-coordination/task');
  writeFileSync(join(boundary, 'selection.json'), JSON.stringify({ include: [], exclude: [] }));
  two.git(two.repo, 'add', '-f', '--', '.agent-work/addy-coordination/task/selection.json');
  assert.throws(() => inventoryCandidate(two.repo, { ...coordAuth, coordination: 'task' }), /Tracked candidate path inside coordination boundary/);
  const three = fixture(); initCoordination(three.repo, 'task', coordAuth);
  const path = join(three.repo, '.agent-work/addy-coordination/task');
  symlinkSync(join(three.parent, 'outside'), join(path, 'selection.json'));
  assert.throws(() => inventoryCandidate(three.repo, { ...coordAuth, coordination: 'task' }), /Unsafe coordination artifact/);
  const four = fixture(); initCoordination(four.repo, 'task', coordAuth);
  const opts = { ...coordAuth, coordination: 'task' }, inv = inventoryCandidate(four.repo, opts);
  assert.throws(() => captureCandidate(four.repo, { include: inv.paths, exclude: [] }, { ...opts, beforeSecondPass: () => {
    writeFileSync(join(four.repo, '.agent-work/addy-coordination/task/unknown-source'), 'do not hide');
  } }), /Unexpected file inside coordination boundary/);
  const five = fixture(); initCoordination(five.repo, 'task', coordAuth);
  const fivePath = join(five.repo, '.agent-work/addy-coordination/task');
  linkSync(join(five.repo, 'README.md'), join(fivePath, 'selection.json'));
  assert.throws(() => inventoryCandidate(five.repo, { ...coordAuth, coordination: 'task' }), /Unsafe coordination artifact/);
  const six = fixture(); initCoordination(six.repo, 'task', coordAuth);
  const sixPath = join(six.repo, '.agent-work/addy-coordination/task'), sixOpts = { ...coordAuth, coordination: 'task' };
  const sixPaths = inventoryCandidate(six.repo, sixOpts).paths;
  assert.throws(() => captureCandidate(six.repo, { include: sixPaths, exclude: [] }, { ...sixOpts, beforeSecondPass: () => {
    renameSync(sixPath, sixPath + '-moved'); mkdirSync(sixPath);
    writeFileSync(join(sixPath, 'coordination.json'), JSON.stringify({ version: 1, kind: 'addy-coordination', task: 'task', nonce: 'a'.repeat(32) }));
  } }), /changed during observation/);
});

test('normal CLI capture and verification link actual observed identity to graph provenance', () => {
  const { parent, repo } = fixture();
  writeFileSync(join(repo, 'README.md'), 'candidate fixture\n');
  const listing = spawnSync(process.execPath, [script, repo, '--authorize-repository-control', 'inventory'], { encoding: 'utf8' });
  assert.equal(listing.status, 0, listing.stderr);
  const paths = JSON.parse(listing.stdout).paths, list = join(parent, 'allowlist.json'); writeFileSync(list, JSON.stringify({ include: paths, exclude: [] }));
  const captured = spawnSync(process.execPath, [script, repo, '--authorize-repository-control', 'capture', list], { encoding: 'utf8' });
  assert.equal(captured.status, 0, captured.stderr);
  const result = JSON.parse(captured.stdout), manifest = join(parent, 'manifest.json'); writeFileSync(manifest, captured.stdout);
  const verified = spawnSync(process.execPath, [script, repo, '--authorize-repository-control', 'verify', list, result.digest], { encoding: 'utf8' });
  assert.equal(verified.status, 0, verified.stderr);
  const graph = executeGraph(root, parent, 'graph', 'init', { op: 'init', baseline: result.digest, baselineRef: manifest, slices: [{ id: 'fixture', depends: [] }] });
  assert.equal(graph.baseline.digest, result.digest); assert.equal(graph.baseline.ref, manifest);
  writeFileSync(join(repo, 'README.md'), 'changed\n');
  const mismatch = spawnSync(process.execPath, [script, repo, '--authorize-repository-control', 'verify', list, result.digest], { encoding: 'utf8' });
  assert.notEqual(mismatch.status, 0); assert.match(mismatch.stderr, /digest mismatch/);
});
