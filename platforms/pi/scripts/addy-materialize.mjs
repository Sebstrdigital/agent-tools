#!/usr/bin/env node
// Fresh, task-owned worktree preparation; trusted local processes, not a sandbox.
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { closeSync, constants, fchmodSync, fstatSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareCandidates, initCoordination, inventoryCandidate, verifyCandidate } from './addy-candidate.mjs';
import { executeGraph } from './addy-graph.mjs';

const fail = message => { throw new Error(message); };
const sha = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(value);
const hash = value => createHash('sha256').update(value).digest('hex');
const modeFlags = constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0);
const candidateScript = fileURLToPath(new URL('./addy-candidate.mjs', import.meta.url));
const grants = ['sourceContent', 'repositoryControl', 'coordinationArtifacts', 'journalWrite', 'nestedControls', 'linkedControl', 'worktreeCreate', 'targetContent', 'targetWrite', 'targetCoordination', 'metadataExclusionsAccepted'];
function readSelection(path) {
  const st = lstatSync(path, { bigint: true });
  if (!st.isFile() || st.isSymbolicLink() || st.nlink !== 1n || st.size > 16n * 1024n * 1024n) fail('Unsafe source selection');
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const opened = fstatSync(fd, { bigint: true });
    if (st.dev !== opened.dev || st.ino !== opened.ino || st.size !== opened.size || st.mtimeNs !== opened.mtimeNs || st.ctimeNs !== opened.ctimeNs) fail('Source selection changed before read');
    const raw = readFileSync(fd), after = fstatSync(fd, { bigint: true });
    if (opened.dev !== after.dev || opened.ino !== after.ino || opened.size !== after.size || opened.mtimeNs !== after.mtimeNs || opened.ctimeNs !== after.ctimeNs) fail('Source selection changed during read');
    return JSON.parse(raw.toString('utf8'));
  } finally { closeSync(fd); }
}
function syncDir(path) { const fd = openSync(path, constants.O_RDONLY); try { fsyncSync(fd); } finally { closeSync(fd); } }
function syncRegular(path) {
  const before = lstatSync(path, { bigint: true });
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1n) fail('Unsafe created Git control file');
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try { const current = fstatSync(fd, { bigint: true }); if (before.dev !== current.dev || before.ino !== current.ino) fail('Created Git control changed'); fsyncSync(fd); }
  finally { closeSync(fd); }
}
function freshFile(path, bytes, mode = 0o600) {
  const fd = openSync(path, modeFlags, 0o600);
  try { writeFileSync(fd, bytes); fchmodSync(fd, mode); fsyncSync(fd); } finally { closeSync(fd); }
}
function mkdirOwned(path) {
  try { mkdirSync(path, { mode: 0o700 }); } catch (error) { if (error.code !== 'EEXIST') throw error; }
  const st = lstatSync(path);
  if (!st.isDirectory() || st.isSymbolicLink() || realpathSync(path) !== path) fail('Unsafe worktree parent directory');
}
function freshDirectory(path, parent, owned) {
  if (!owned.has(path)) { mkdirSync(path, { mode: 0o700 }); syncDir(parent); owned.add(path); }
  const st = lstatSync(path);
  if (!st.isDirectory() || st.isSymbolicLink() || realpathSync(path) !== path) fail('Unsafe target directory');
}
export function readObservedFile(root, entry) {
  const parts = entry.path.split('/'); let parent = root;
  for (const part of parts.slice(0, -1)) {
    parent = join(parent, part); const s = lstatSync(parent);
    if (!s.isDirectory() || s.isSymbolicLink()) fail('Unsafe source parent');
  }
  const path = join(root, ...parts), before = lstatSync(path, { bigint: true });
  if (!before.isFile() || before.isSymbolicLink() || Number(before.mode & 0o7777n) !== entry.mode || before.size !== BigInt(entry.size)) fail('Source file drift');
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const st = fstatSync(fd, { bigint: true });
    if (st.dev !== before.dev || st.ino !== before.ino || st.size !== before.size || st.mtimeNs !== before.mtimeNs || st.ctimeNs !== before.ctimeNs) fail('Source file drift');
    const bytes = readFileSync(fd), after = fstatSync(fd, { bigint: true });
    if (after.dev !== st.dev || after.ino !== st.ino || after.size !== st.size || after.mtimeNs !== st.mtimeNs || after.ctimeNs !== st.ctimeNs || hash(bytes) !== entry.sha256) fail('Source file drift');
    return bytes;
  } finally { closeSync(fd); }
}
function gitEnv() {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
  return { ...env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_TERMINAL_PROMPT: '0', GIT_NO_LAZY_FETCH: '1', GIT_NO_REPLACE_OBJECTS: '1', GIT_ATTR_NOSYSTEM: '1', LC_ALL: 'C' };
}
function git(root, args, input) {
  const r = spawnSync('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false', '-C', root, ...args], { env: gitEnv(), input, timeout: 30000, maxBuffer: 32 * 1024 * 1024 });
  if (r.error || r.status !== 0) fail('Git worktree/index operation failed; inspect retained attempt');
}
function captureLinkedCli(root, owner, task, selectionPath, prefixes) {
  const flags = ['--authorize-repository-control', '--authorize-coordination-artifacts', '--authorize-linked-control', '--linked-project-root', owner];
  if (prefixes.length) flags.push('--authorize-excluded-prefixes', ...prefixes.flatMap(p => ['--exclude-prefix', p]));
  flags.push('--coordination', task, 'capture', selectionPath, '--write-manifest');
  const r = spawnSync(process.execPath, [candidateScript, root, ...flags], { env: gitEnv(), encoding: 'utf8', timeout: 120000, maxBuffer: 32 * 1024 * 1024 });
  if (r.error || r.status !== 0) fail('Linked candidate capture failed; inspect retained attempt');
  return JSON.parse(r.stdout);
}
function assertAbsent(path, label) {
  try { lstatSync(path); } catch (e) { if (e.code === 'ENOENT') return; throw e; }
  fail(label + ' already exists; never adopt or overwrite');
}
/** Trusted-local composition primitive. Caller validates the projection and journals
 * intent first. Only fresh worktrees are created; never resume a partial target. */
export function createProjectedWorktree(root, controlId, projection, readEntry, hooks = {}) {
  if (!id(controlId)) fail('Invalid projected worktree control ID');
  if (process.platform !== 'darwin') fail('Unsupported materialization runtime: requires tested Darwin and Apple Git');
  const version = spawnSync('git', ['--version'], { env: gitEnv(), encoding: 'utf8', timeout: 30000 });
  if (version.error || version.status !== 0 || version.stdout.trim() !== 'git version 2.54.0 (Apple Git-157)') fail('Unsupported materialization runtime: requires tested Darwin and Apple Git');
  const target = join(root, '.agent-work/linked-worktrees', controlId), control = join(root, '.git/worktrees', controlId);
  assertAbsent(target, 'Target worktree'); assertAbsent(control, 'Target Git control');
  mkdirOwned(join(root, '.agent-work', 'linked-worktrees'));
  git(root, ['worktree', 'add', '--detach', '--no-checkout', target, projection.head]);
  hooks.afterWorktree?.();
  assertAbsent(join(control, 'index'), 'Target Git index');
  const index = Buffer.concat(projection.index.map(item => Buffer.from(`${item.mode} ${item.oid}\t${item.path}\0`)));
  if (index.length) git(target, ['update-index', '-z', '--index-info'], index);
  else git(target, ['read-tree', '--empty']);
  for (const path of [join(target, '.git'), ...['HEAD', 'gitdir', 'commondir', 'index'].map(name => join(control, name))]) syncRegular(path);
  for (const path of [target, join(root, '.agent-work/linked-worktrees'), join(root, '.agent-work'), control, join(root, '.git/worktrees'), join(root, '.git')]) syncDir(path);
  hooks.afterIndex?.();
  const owned = new Set([target]); let files = 0;
  for (const entry of projection.worktree) {
    if (entry.kind === 'missing') continue;
    const bytes = readEntry(entry);
    if (bytes.length !== entry.size || hash(bytes) !== entry.sha256) fail('Projected source bytes differ');
    const parts = entry.path.split('/'); let directory = target;
    for (const part of parts.slice(0, -1)) { const parent = directory; directory = join(directory, part); freshDirectory(directory, parent, owned); }
    freshFile(join(directory, parts.at(-1)), bytes, entry.mode); syncDir(directory);
    if (++files === 1) hooks.afterFirstFile?.();
  }
  return target;
}

/** Internal hooks are dependency injection for synthetic tests; CLI exposes none. */
export function materializeCandidate(request, hooks = {}) {
  if (!request || !request.grants || !grants.every(name => request.grants[name] === true)) fail('Explicit source, control, creation, target and coordination grants required');
  const { project, task, attempt, controlId, expectedDigest, graphRevision } = request;
  if (typeof project !== 'string' || !isAbsolute(project) || !id(task) || !id(attempt) || !id(controlId) || !sha(expectedDigest) || !Number.isSafeInteger(graphRevision) || graphRevision < 0) fail('Invalid materialization request');
  const prefixes = request.excludedPrefixes ?? [];
  if (!Array.isArray(prefixes) || (prefixes.length && request.grants.excludedPrefixes !== true)) fail('Explicit excluded-prefix grant required');
  const additional = request.additionalBoundaries ?? [];
  if (!Array.isArray(additional) || additional.length > 31 || additional.some(x => !x || typeof x !== 'object' || Object.keys(x).sort().join(',') !== 'controlId,identity,path' || !id(x.controlId) || !sha(x.identity) || x.controlId === controlId || x.path !== '.agent-work/linked-worktrees/' + x.controlId) || new Set(additional.map(x => x.controlId.toLowerCase())).size !== additional.length || additional.some(x => x.controlId.toLowerCase() === controlId.toLowerCase())) fail('Invalid additional linked boundary declarations');
  if (process.platform !== 'darwin') fail('Unsupported materialization runtime: requires tested Darwin and Apple Git');
  const version = spawnSync('git', ['--version'], { env: gitEnv(), encoding: 'utf8', timeout: 30000 });
  if (version.error || version.status !== 0 || version.stdout.trim() !== 'git version 2.54.0 (Apple Git-157)') fail('Unsupported materialization runtime: requires tested Darwin and Apple Git');
  const root = realpathSync(resolve(project)); if (root !== resolve(project)) fail('Project root must be a real absolute path');
  const rel = '.agent-work/linked-worktrees/' + controlId, target = join(root, ...rel.split('/'));
  const boundary = join(root, '.agent-work/addy-coordination', task), selectionPath = join(boundary, 'selection.json');
  const prefixOptions = prefixes.length ? { authorizeExcludedPrefixes: true, excludedPrefixes: prefixes } : {};
  const source = { authorizeRepositoryControl: true, authorizeCoordinationArtifacts: true, authorizeNestedLinkedControls: true, coordination: task,
    nestedLinked: [{ path: rel, controlId }, ...additional.map(({ path, controlId }) => ({ path, controlId }))], ...prefixOptions };
  const expectedNested = targetIdentity => [{ path: rel, identity: targetIdentity }, ...additional.map(({ path, identity }) => ({ path, identity }))];
  const checkNested = (inv, targetIdentity) => {
    const actual = inv.nestedLinkedBoundaries ?? [], expected = expectedNested(targetIdentity);
    if (actual.length !== expected.length || expected.some(e => !actual.some(a => a.path === e.path && (e.identity === null ? !a.present : a.present && a.identity === e.identity)))) fail('Target boundary or additional linked boundary absent or identity mismatch');
  };
  // Inventory validates scope and authority before the coordination selection is opened.
  const inv = inventoryCandidate(root, source);
  checkNested(inv, null);
  const selection = readSelection(selectionPath);
  if (!selection || !Array.isArray(selection.include) || !Array.isArray(selection.exclude) || selection.exclude.length || inv.tracked.some(p => !selection.include.includes(p))) fail('All tracked and inventoried non-prefix paths must be selected');
  const base = verifyCandidate(root, selection, expectedDigest, { ...source, expectedNestedIdentities: expectedNested(null) });
  for (const item of [...base.manifest.tree, ...base.manifest.index]) if (!['100644', '100755'].includes(item.mode)) fail('Symlinks and unsupported Git entries are not supported');
  for (const item of base.manifest.worktree) if (item.kind !== 'missing' && (item.kind !== 'file' || (item.mode & ~0o777) !== 0)) fail('Symlinks, special files and special modes are not supported');
  assertAbsent(target, 'Target worktree'); assertAbsent(join(root, '.git/worktrees', controlId), 'Target Git control');
  const graph = executeGraph(root, boundary, 'graph', 'inspect');
  if (graph.revision !== graphRevision || graph.baseline.digest !== expectedDigest || !graph.slices.some(s => s.id === 'materialize' && s.ready)) fail('Materialization graph is stale or not ready');
  const taskRef = additional.length ? JSON.stringify({ selectionPath, additionalBoundaries: additional }) : selectionPath;
  if (taskRef.length > 4096) fail('Materialization intent exceeds graph reference limit');
  executeGraph(root, boundary, 'graph', 'apply', { op: 'start', expected: graphRevision, slice: 'materialize', attempt, worker: 'local-materializer', workspace: target, taskRef });
  hooks.afterIntent?.();
  mkdirOwned(join(root, '.agent-work', 'linked-worktrees'));
  git(root, ['worktree', 'add', '--detach', '--no-checkout', target, base.manifest.head]);
  const createdInventory = inventoryCandidate(root, source);
  const created = createdInventory.nestedLinkedBoundaries?.find(x => x.path === rel)?.identity;
  if (!sha(created)) fail('Created linked worktree control identity unavailable');
  checkNested(createdInventory, created);
  assertAbsent(join(root, '.git/worktrees', controlId, 'index'), 'Target Git index');
  hooks.afterWorktree?.();
  const index = Buffer.concat(base.manifest.index.map(item => Buffer.from(`${item.mode} ${item.oid}\t${item.path}\0`)));
  if (index.length) git(target, ['update-index', '-z', '--index-info'], index);
  else git(target, ['read-tree', '--empty']);
  const control = join(root, '.git/worktrees', controlId);
  for (const path of [join(target, '.git'), ...['HEAD', 'gitdir', 'commondir', 'index'].map(name => join(control, name))]) syncRegular(path);
  for (const path of [target, join(root, '.agent-work/linked-worktrees'), join(root, '.agent-work'), control, join(root, '.git/worktrees'), join(root, '.git')]) syncDir(path);
  hooks.afterIndex?.();
  let files = 0; const ownedDirectories = new Set([target]);
  for (const entry of base.manifest.worktree) {
    if (entry.kind === 'missing') continue;
    const bytes = readObservedFile(root, entry), parts = entry.path.split('/'); let directory = target;
    for (const part of parts.slice(0, -1)) { const parent = directory; directory = join(directory, part); freshDirectory(directory, parent, ownedDirectories); }
    freshFile(join(directory, parts.at(-1)), bytes, entry.mode); syncDir(directory);
    if (++files === 1) hooks.afterFirstFile?.();
  }
  hooks.beforeVerification?.();
  const after = inventoryCandidate(root, source), identity = after.nestedLinkedBoundaries?.find(x => x.path === rel)?.identity;
  if (!sha(identity) || identity !== created) fail('Linked worktree control identity changed');
  checkNested(after, identity);
  verifyCandidate(root, selection, expectedDigest, { ...source, expectedNestedIdentities: expectedNested(identity) });
  const linked = { authorizeRepositoryControl: true, authorizeCoordinationArtifacts: true, authorizeLinkedControl: true, linkedProjectRoot: root, ...prefixOptions };
  initCoordination(target, task, { authorizeRepositoryControl: true, authorizeCoordinationArtifacts: true, authorizeLinkedControl: true, linkedProjectRoot: root });
  const linkedSelection = join(target, '.agent-work/addy-coordination', task, 'selection.json');
  freshFile(linkedSelection, Buffer.from(JSON.stringify(selection) + '\n')); syncDir(join(target, '.agent-work/addy-coordination', task));
  const result = captureLinkedCli(target, root, task, linkedSelection, prefixes);
  syncDir(join(target, '.agent-work')); syncDir(target);
  const requestCompare = { ownerProject: root, linkedProject: target, task, boundary: rel, controlId, expectedControlIdentity: identity,
    ownerDigest: expectedDigest, linkedDigest: result.digest, ownerAuthorization: source, linkedAuthorization: linked, additionalBoundaries: additional };
  const checked = compareCandidates(requestCompare);
  hooks.beforeFinish?.();
  compareCandidates(requestCompare); // Re-observe immediately before the terminal record.
  const evidence = { version: 1, target, ownerDigest: expectedDigest, linkedDigest: result.digest, identity, scope: checked.scope, ...(additional.length ? { additionalBoundaries: additional } : {}) };
  const evidenceText = JSON.stringify(evidence);
  const evidenceDigest = hash(evidenceText);
  // Prepared evidence remains running: even a failed fsync after a visible event
  // cannot make the slice ready. Explicit human reconciliation must finish it.
  executeGraph(root, boundary, 'graph', 'apply', { op: 'prepare', expected: graphRevision + 1, attempt, candidate: result.digest, evidence: evidenceDigest, resultRef: evidenceText });
  return { ...evidence, attempt, evidenceDigest, resultRef: evidenceText, graphRevision: graphRevision + 2, status: 'verified-awaiting-acceptance', excludes: base.manifest.exclusions };
}

if (typeof import.meta.main !== 'boolean') throw new Error('Node.js with import.meta.main support is required');
if (import.meta.main) {
  try {
    const [project, task, attempt, controlId, expectedDigest, revision, ...args] = process.argv.slice(2);
    const required = ['--authorize-source-content', '--authorize-repository-control', '--authorize-coordination-artifacts', '--authorize-journal-write', '--authorize-nested-controls', '--authorize-linked-control', '--authorize-worktree-create', '--authorize-target-content', '--authorize-target-write', '--authorize-target-coordination', '--accept-metadata-exclusions'];
    const flags = [], prefixes = [], additional = []; let prefixGrant = false;
    while (args.length) {
      const arg = args.shift();
      if (arg === '--authorize-excluded-prefixes' && !prefixGrant) { prefixGrant = true; continue; }
      if (arg === '--exclude-prefix' && args[0]) { prefixes.push(args.shift()); continue; }
      if (arg === '--existing-linked' && args[0]) {
        const value = args.shift(), split = value.indexOf('=');
        if (split < 1) fail('Existing linked boundary requires CONTROL_ID=IDENTITY');
        const controlId = value.slice(0, split); additional.push({ path: '.agent-work/linked-worktrees/' + controlId, controlId, identity: value.slice(split + 1) }); continue;
      }
      flags.push(arg);
    }
    if (flags.length !== required.length || new Set(flags).size !== required.length || !required.every(x => flags.includes(x))) fail('Explicit source, control, creation, target and coordination grants required');
    if (prefixGrant !== (prefixes.length > 0)) fail('Explicit excluded-prefix grant and prefixes required together');
    if (!/^\d+$/.test(revision ?? '')) fail('Expected graph revision required');
    const grantMap = Object.fromEntries(grants.map(name => [name, true])); if (prefixGrant) grantMap.excludedPrefixes = true;
    console.log(JSON.stringify(materializeCandidate({ project, task, attempt, controlId, expectedDigest, graphRevision: Number(revision), excludedPrefixes: prefixes, additionalBoundaries: additional, grants: grantMap }), null, 2));
  } catch (error) { console.error('addy-materialize:', error.message); process.exitCode = 1; }
}
