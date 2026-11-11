#!/usr/bin/env node
// Explicit-allowlist, read-only candidate observation. No transfer, Git writes,
// authority validation or guarantee against transient external mutation.
import { createHash, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { closeSync, constants, fstatSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, readSync, readlinkSync, realpathSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, parse, relative, resolve, sep } from 'node:path';
import { executeGraph } from './addy-graph.mjs';

const MAX_FILE = 16 * 1024 * 1024, MAX_TOTAL = 128 * 1024 * 1024;
const EXCLUSIONS = ['explicitly excluded paths', 'Git control metadata beyond HEAD/tree/index', 'external resources', 'submodule contents',
  'extended attributes and ACLs', 'hard-link topology', 'directory modes and empty directories',
  'ownership and timestamps', 'Git index stat cache'];
const hash = value => createHash('sha256').update(value).digest('hex');
const fail = message => { throw new Error(message); };
const sorted = values => [...values].sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
const sha = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const coordName = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(value);
const sameKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
function coordDirectory(root, name) {
  if (!coordName(name)) fail('Invalid coordination task name');
  const parts = ['.agent-work', 'addy-coordination', name]; let path = root;
  for (const part of parts) {
    path = join(path, part); const stat = lstatSync(path);
    if (!stat.isDirectory() || stat.isSymbolicLink() || realpathSync(path) !== path) fail('Unsafe coordination directory');
  }
  return path;
}
export function initCoordination(project, name, options = {}) {
  if (options.excludedPrefixes?.length) fail('Initialize coordination before declaring excluded prefixes');
  if (options.authorizeRepositoryControl !== true) fail('Explicit repository-control read authorization required');
  if (options.authorizeCoordinationArtifacts !== true) fail('Explicit coordination-artifact authorization required');
  if (!coordName(name)) fail('Invalid coordination task name');
  validateScopeOptions({ ...options, coordination: name });
  const root = realpathSync(resolve(project));
  // Check the authorized Git control boundary and both tracked views before
  // any project mutation, including tracked paths currently deleted on disk.
  authorizeControl(root, options);
  const prefix = '.agent-work/addy-coordination/' + name;
  const tracked = [...records(git(root, options, 'ls-tree', '-r', '--name-only', '-z', 'HEAD')),
    ...records(git(root, options, 'ls-files', '--cached', '-z'))].map(pathText);
  if (tracked.some(path => path === prefix || path.startsWith(prefix + '/') || prefix.startsWith(path + '/'))) fail('Coordination location overlaps tracked candidate content');
  let parent = root;
  for (const part of ['.agent-work', 'addy-coordination']) {
    parent = join(parent, part);
    try { mkdirSync(parent, { mode: 0o700 }); } catch (error) { if (error.code !== 'EEXIST') throw error; }
    const stat = lstatSync(parent);
    if (!stat.isDirectory() || stat.isSymbolicLink() || realpathSync(parent) !== parent) fail('Unsafe coordination parent');
  }
  const directory = join(parent, name);
  mkdirSync(directory, { mode: 0o700 }); // Fresh ownership only; never adopt existing contents.
  mkdirSync(join(directory, 'manifests'), { mode: 0o700 });
  const marker = JSON.stringify({ version: 1, kind: 'addy-coordination', task: name, nonce: randomBytes(16).toString('hex') }) + '\n';
  const fd = openSync(join(directory, 'coordination.json'), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), 0o600);
  try { writeFileSync(fd, marker); fsyncSync(fd); } finally { closeSync(fd); }
  for (const path of [join(directory, 'manifests'), directory, parent]) { const d = openSync(path, constants.O_RDONLY); try { fsyncSync(d); } finally { closeSync(d); } }
  return { path: relative(root, directory).split(sep).join('/'), marker: 'coordination.json' };
}
function coordinationObservation(root, name, options) {
  if (options.authorizeCoordinationArtifacts !== true) fail('Explicit coordination-artifact authorization required');
  const directory = coordDirectory(root, name), relativePath = relative(root, directory).split(sep).join('/');
  const entries = [], retainedDigests = new Set(), permitted = new Set(['coordination.json', 'selection.json', 'selections', 'manifest.json', 'manifests', 'graph']);
  const readFile = file => {
    const before = lstatSync(file, { bigint: true });
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1n || before.size > 16n * 1024n * 1024n) fail('Unsafe coordination artifact');
    const fd = openSync(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0)); let data;
    try {
      if (stableStat(before) !== stableStat(fstatSync(fd, { bigint: true }))) fail('Coordination artifact changed before read');
      data = readFileSync(fd);
      if (stableStat(before) !== stableStat(fstatSync(fd, { bigint: true }))) fail('Coordination artifact changed during read');
    } finally { closeSync(fd); }
    if (stableStat(before) !== stableStat(lstatSync(file, { bigint: true }))) fail('Coordination artifact changed after read');
    entries.push([relative(directory, file), stableStat(before), hash(data)]);
    try { return JSON.parse(data.toString('utf8')); } catch { fail('Incomplete or invalid coordination artifact'); }
  };
  const rootStamp = stableStat(lstatSync(directory, { bigint: true }));
  const ancestors = [join(root, '.agent-work'), join(root, '.agent-work', 'addy-coordination')].map(path => stableStat(lstatSync(path, { bigint: true })));
  const items = readdirSync(directory).sort();
  for (const item of items) if (!permitted.has(item)) fail('Unexpected file inside coordination boundary: ' + item);
  const marker = readFile(join(directory, 'coordination.json'));
  if (!sameKeys(marker, ['version', 'kind', 'task', 'nonce']) || marker.version !== 1 || marker.kind !== 'addy-coordination' || marker.task !== name ||
      typeof marker.nonce !== 'string' || !/^[a-f0-9]{32}$/.test(marker.nonce)) fail('Invalid coordination marker');
  const validateSelection = selection => {
    if (!sameKeys(selection, ['include', 'exclude']) || ![selection.include, selection.exclude].every(a => Array.isArray(a) && a.every(x => typeof x === 'string' && pathText(Buffer.from(x)) === x)) ||
        new Set([...selection.include, ...selection.exclude]).size !== selection.include.length + selection.exclude.length) fail('Invalid coordination selection');
  };
  if (items.includes('selection.json')) validateSelection(readFile(join(directory, 'selection.json')));
  if (items.includes('selections')) {
    const selections = join(directory, 'selections'), st = lstatSync(selections, { bigint: true });
    if (!st.isDirectory() || st.isSymbolicLink() || realpathSync(selections) !== selections) fail('Unsafe coordination selections directory');
    entries.push(['selections', stableStat(st)]);
    for (const item of readdirSync(selections).sort()) {
      if (!/^[a-f0-9]{64}\.json$/.test(item)) fail('Unexpected coordination selection artifact');
      const selection = readFile(join(selections, item)); validateSelection(selection);
      if (hash(JSON.stringify(selection)) !== item.slice(0, -5)) fail('Coordination selection digest mismatch');
    }
    if (stableStat(lstatSync(selections, { bigint: true })) !== stableStat(st)) fail('Coordination selections changed during observation');
  }
  const validateManifest = (file, expectedName) => {
    const result = readFile(file);
    const m = result?.manifest;
    const path = x => typeof x === 'string' && pathText(Buffer.from(x)) === x;
    const oid = x => typeof x === 'string' && /^[a-f0-9]{40}([a-f0-9]{24})?$/.test(x);
    const blob = x => sameKeys(x, ['path', 'mode', 'oid', 'size', 'sha256']) && path(x.path) &&
      ['100644', '100755', '120000'].includes(x.mode) && oid(x.oid) && Number.isSafeInteger(x.size) && x.size >= 0 && sha(x.sha256);
    const work = x => (sameKeys(x, ['path', 'kind']) && x.kind === 'missing' && path(x.path)) ||
      (sameKeys(x, ['path', 'kind', 'mode', 'size', 'sha256']) && x.kind === 'file' && path(x.path) && Number.isSafeInteger(x.mode) && Number.isSafeInteger(x.size) && x.size >= 0 && sha(x.sha256)) ||
      (sameKeys(x, ['path', 'kind', 'mode', 'targetBase64']) && x.kind === 'symlink' && path(x.path) && Number.isSafeInteger(x.mode) && typeof x.targetBase64 === 'string' && /^[A-Za-z0-9+/]*={0,2}$/.test(x.targetBase64));
    const nested = [4, 6].includes(m?.version), prefixed = [5, 6].includes(m?.version);
    if (!sameKeys(result, ['digest', 'manifest', 'coordinationId']) || result.coordinationId !== marker.nonce || !sha(result.digest) || !m || ![3, 4, 5, 6].includes(m.version) ||
        m.coordinationBoundary !== relativePath || hash(JSON.stringify(m)) !== result.digest || !oid(m.head) ||
        !sameKeys(m, ['version', 'head', 'tree', 'index', 'worktree', 'excludedPaths', 'coverage', 'exclusions', 'coordinationBoundary', ...(nested ? ['nestedLinkedBoundaries'] : []), ...(prefixed ? ['excludedPrefixes'] : [])]) ||
        ![m.tree, m.index].every(a => Array.isArray(a) && a.every(blob)) || !Array.isArray(m.worktree) || !m.worktree.every(work) ||
        !Array.isArray(m.excludedPaths) || !m.excludedPaths.every(path) || !['partial', 'all-task-relevant'].includes(m.coverage) ||
        (nested && (!Array.isArray(m.nestedLinkedBoundaries) || !m.nestedLinkedBoundaries.length || !m.nestedLinkedBoundaries.every(x => sameKeys(x, ['path', 'controlId']) && path(x.path) && x.path.startsWith('.agent-work/linked-worktrees/') && typeof x.controlId === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(x.controlId)))) ||
        (prefixed && (!Array.isArray(m.excludedPrefixes) || !m.excludedPrefixes.length || m.excludedPrefixes.length > 32 || !m.excludedPrefixes.every(p => path(p) && p.length <= 512 && /^[\x20-\x7e]+$/.test(p)) || JSON.stringify(sorted(new Set(m.excludedPrefixes))) !== JSON.stringify(m.excludedPrefixes))) ||
        ((m.coverage === 'all-task-relevant') !== (!nested && !prefixed && m.excludedPaths.length === 0)) ||
        JSON.stringify(m.exclusions) !== JSON.stringify([...EXCLUSIONS, 'coordination boundary artifacts', ...(nested ? ['nested linked-worktree contents'] : []), ...(prefixed ? ['excluded directory prefixes (unobserved)'] : [])]) ||
        (expectedName !== undefined && result.digest !== expectedName)) fail('Invalid coordination manifest');
    retainedDigests.add(result.digest);
  };
  if (items.includes('manifest.json')) validateManifest(join(directory, 'manifest.json')); // Legacy singleton, never rewritten.
  if (items.includes('manifests')) {
    const manifests = join(directory, 'manifests'), st = lstatSync(manifests, { bigint: true });
    if (!st.isDirectory() || st.isSymbolicLink() || realpathSync(manifests) !== manifests) fail('Unsafe coordination manifests directory');
    entries.push(['manifests', stableStat(st)]);
    for (const item of readdirSync(manifests).sort()) {
      if (!/^[a-f0-9]{64}\.json$/.test(item)) fail('Unexpected coordination manifest artifact');
      validateManifest(join(manifests, item), item.slice(0, -5));
    }
    if (stableStat(lstatSync(manifests, { bigint: true })) !== stableStat(st)) fail('Coordination manifests changed during observation');
  }
  if (items.includes('graph')) {
    const graph = join(directory, 'graph'), st = lstatSync(graph, { bigint: true });
    if (!st.isDirectory() || st.isSymbolicLink() || realpathSync(graph) !== graph) fail('Unsafe coordination graph');
    entries.push(['graph', stableStat(st)]);
    for (const item of readdirSync(graph).sort()) {
      if (!/^[0-9]{8}\.json$/.test(item)) fail('Unexpected coordination graph artifact');
      readFile(join(graph, item));
    }
    if (executeGraph(root, directory, 'graph', 'inspect').journalIntegrity !== 'checksummed-v2') fail('Unsealed coordination graph');
  }
  if (stableStat(lstatSync(directory, { bigint: true })) !== rootStamp) fail('Coordination boundary changed during observation');
  return { relativePath, directory, id: marker.nonce, retainedDigests: [...retainedDigests].sort(), stamp: hash(JSON.stringify([ancestors, rootStamp, entries])) };
}
function pathText(raw) {
  const name = raw.toString('utf8');
  if (!Buffer.from(name, 'utf8').equals(raw) || !name || name.includes('\0') || isAbsolute(name) ||
      name.split('/').some(part => !part || part === '.' || part === '..' || part.toLowerCase() === '.git') || name.includes('\\'))
    fail('Unsupported or unsafe Git path');
  return name;
}
function records(buffer) {
  if (buffer.length && buffer.at(-1) !== 0) fail('Malformed Git output');
  const out = []; let start = 0;
  for (let i = 0; i < buffer.length; i++) if (buffer[i] === 0) { out.push(buffer.subarray(start, i)); start = i + 1; }
  return out;
}
function readControlConfig(gitdir) {
  const file = join(gitdir, 'config'), stat = lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 32768) fail('Repository config must be a small regular file');
  const fd = openSync(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  let bytes;
  try {
    const opened = fstatSync(fd);
    if (!opened.isFile() || opened.dev !== stat.dev || opened.ino !== stat.ino || opened.size !== stat.size) fail('Repository config changed before read');
    bytes = readFileSync(fd);
    const after = fstatSync(fd);
    if (after.dev !== opened.dev || after.ino !== opened.ino || after.size !== opened.size || after.mtimeMs !== opened.mtimeMs || after.ctimeMs !== opened.ctimeMs) fail('Repository config changed during read');
  } finally { closeSync(fd); }
  const value = bytes.toString('utf8');
  if (!Buffer.from(value).equals(bytes)) fail('Unsupported repository config encoding');
  const keys = new Set(); let section = false;
  for (const line of value.split(/\r?\n/)) {
    if (!line.trim() || /^\s*[#;]/.test(line)) continue;
    if (/^\s*\[core\]\s*$/i.test(line) && !section) { section = true; continue; }
    const match = /^\s*([a-z][a-z0-9]*)\s*=\s*([a-z0-9]+)\s*$/i.exec(line);
    if (!section || !match) fail('Repository config contains unsupported sections or syntax');
    const key = match[1].toLowerCase(), setting = match[2].toLowerCase();
    if (keys.has(key) || !['repositoryformatversion', 'filemode', 'bare', 'logallrefupdates', 'ignorecase', 'precomposeunicode', 'symlinks'].includes(key) ||
        (key === 'repositoryformatversion' ? setting !== '0' : !['true', 'false'].includes(setting)) || (key === 'bare' && setting !== 'false'))
      fail('Repository config contains unsupported key or value: ' + key);
    keys.add(key);
  }
  if (!section || !keys.has('repositoryformatversion') || !keys.has('bare')) fail('Incomplete repository config');
  return hash(bytes);
}
function readControlPointer(file) {
  const before = lstatSync(file, { bigint: true });
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1n || before.size > 4096n) fail('Unsafe Git control pointer');
  const fd = openSync(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0)); let bytes;
  try {
    if (stableStat(before) !== stableStat(fstatSync(fd, { bigint: true }))) fail('Git control pointer changed before read');
    bytes = readFileSync(fd);
    if (stableStat(before) !== stableStat(fstatSync(fd, { bigint: true }))) fail('Git control pointer changed during read');
  } finally { closeSync(fd); }
  if (stableStat(before) !== stableStat(lstatSync(file, { bigint: true }))) fail('Git control pointer changed after read');
  const value = bytes.toString('utf8');
  if (!Buffer.from(value).equals(bytes) || value.includes('\0')) fail('Invalid Git control pointer encoding');
  return value.replace(/\r?\n$/, '');
}
function controlLocation(root, options) {
  if (options.authorizeRepositoryControl !== true) fail('Explicit repository-control read authorization required');
  const dotgit = join(root, '.git'), stat = lstatSync(dotgit);
  if (stat.isSymbolicLink()) fail('Unsafe Git control path');
  if (stat.isDirectory()) {
    if (realpathSync(dotgit) !== dotgit) fail('Unsafe Git control path');
    if (options.authorizeLinkedControl || options.linkedProjectRoot) fail('Linked control options require a linked worktree');
    return { gitdir: dotgit, identity: 'local' };
  }
  // A linked .git pointer is not opened until the caller separately authorizes
  // the named owning project's shared Git-control/object boundary.
  if (!stat.isFile() || options.authorizeLinkedControl !== true || typeof options.linkedProjectRoot !== 'string' || !isAbsolute(options.linkedProjectRoot))
    fail('Linked worktree requires explicit linked-control authorization and absolute owning project root');
  const owner = realpathSync(resolve(options.linkedProjectRoot));
  if (owner !== resolve(options.linkedProjectRoot)) fail('Owning project root must be a real path');
  const rel = relative(owner, root);
  if (!rel || rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel)) fail('Linked worktree must be inside the owning project root');
  const common = join(owner, '.git'), commonStat = lstatSync(common);
  if (!commonStat.isDirectory() || commonStat.isSymbolicLink() || realpathSync(common) !== common) fail('Unsafe common Git control directory');
  const pointer = readControlPointer(dotgit), match = /^gitdir: ([^\r\n]+)$/.exec(pointer);
  if (!match) fail('Malformed linked worktree pointer');
  const worktreeGitdir = resolve(root, match[1]), controlRel = relative(common, worktreeGitdir), parts = controlRel.split(sep);
  if (parts.length !== 2 || parts[0] !== 'worktrees' || !parts[1] || parts[1] === '.' || parts[1] === '..')
    fail('Linked Git directory escapes the declared common control boundary');
  // Check each component before resolving it; never deliberately follow a
  // repository-controlled symlink outside the declared common directory.
  for (const path of [join(common, 'worktrees'), worktreeGitdir]) {
    const item = lstatSync(path);
    if (!item.isDirectory() || item.isSymbolicLink()) fail('Unsafe linked Git directory');
  }
  if (realpathSync(worktreeGitdir) !== worktreeGitdir) fail('Unsafe linked Git directory');
  const commonPointer = readControlPointer(join(worktreeGitdir, 'commondir'));
  if (commonPointer !== '../..' || resolve(worktreeGitdir, commonPointer) !== common) fail('Linked common Git directory mismatch');
  const backlink = readControlPointer(join(worktreeGitdir, 'gitdir'));
  if (!isAbsolute(backlink) || resolve(backlink) !== dotgit) fail('Linked Git directory backlink mismatch');
  return { gitdir: common, worktreeGitdir, identity: JSON.stringify({ owner, dotgit, pointer, commonPointer, backlink }) };
}
function authorizeControl(root, options) {
  const location = controlLocation(root, options), gitdir = location.gitdir;
  // Refuse repository-controlled links and alternate/promisor object stores.
  // All paths under this directory are part of the explicit control boundary.
  const walk = directory => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name), relativePath = relative(gitdir, path);
      const info = lstatSync(path);
      if (info.isSymbolicLink()) fail('Symlink in repository-control directory: ' + relativePath);
      if (relativePath === 'objects/info/alternates' || relativePath === 'objects/info/http-alternates' || relativePath.endsWith('config.worktree') ||
          (relativePath === 'commondir' || (relativePath.endsWith('/commondir') && !/^worktrees\/[^/]+\/commondir$/.test(relativePath))) ||
          (relativePath.startsWith('objects/pack/') && relativePath.endsWith('.promisor'))) fail('External or alternate repository control is unsupported');
      if (info.isDirectory()) walk(path);
      else if (!info.isFile() || info.nlink !== 1) fail('Unsupported or hard-linked repository-control object: ' + relativePath);
    }
  };
  walk(gitdir);
  return JSON.stringify({ config: readControlConfig(gitdir), location: location.identity });
}
function git(root, options, ...args) {
  readControlConfig(controlLocation(root, options).gitdir); // Never invoke Git with unchecked repository config/pointers.
  // Do not let inherited Git environment redirect the index, object database or
  // configuration to a different candidate or private location.
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
  Object.assign(env, { GIT_OPTIONAL_LOCKS: '0', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_TERMINAL_PROMPT: '0', GIT_NO_LAZY_FETCH: '1', GIT_NO_REPLACE_OBJECTS: '1', GIT_ATTR_NOSYSTEM: '1', LC_ALL: 'C' });
  const result = spawnSync('git', ['--no-optional-locks', '-c', 'core.fsmonitor=false', '-C', root, ...args], {
    timeout: 15000, maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'], env,
  });
  // Git can exit zero after skipping an unreadable directory. Any diagnostic
  // means completeness is unproven; do not interpret an empty result as clean.
  if (result.error || result.status !== 0 || !result.stderr || result.stderr.length) fail('Git observation failed or emitted diagnostics; candidate completeness is unproven');
  return result.stdout;
}
function nestedBoundaries(root, options) {
  const declarations = options.nestedLinked ?? [];
  if (!Array.isArray(declarations)) fail('Invalid nested linked-worktree declarations');
  if (declarations.length && (options.authorizeNestedLinkedControls !== true || options.coordination === undefined)) fail('Nested linked worktrees require explicit control authorization and coordination');
  const seen = [];
  for (const entry of declarations) {
    if (!sameKeys(entry, ['path', 'controlId']) || typeof entry.path !== 'string' || pathText(Buffer.from(entry.path)) !== entry.path ||
        !entry.path.startsWith('.agent-work/linked-worktrees/') || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(entry.controlId)) fail('Invalid nested linked-worktree declaration');
    if (seen.some(x => x.path === entry.path || x.path.startsWith(entry.path + '/') || entry.path.startsWith(x.path + '/') || x.controlId === entry.controlId)) fail('Overlapping nested linked-worktree declarations');
    seen.push({ path: entry.path, controlId: entry.controlId });
  }
  seen.sort((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path)));
  return seen.map(entry => {
    let current = root, present = true;
    for (const part of entry.path.split('/')) {
      current = join(current, part);
      let stat; try { stat = lstatSync(current); } catch (error) { if (error.code === 'ENOENT') { present = false; break; } throw error; }
      if (!stat.isDirectory() || stat.isSymbolicLink()) fail('Unsafe nested linked-worktree path');
    }
    if (!present) return { ...entry, present: false, identity: null };
    const linked = controlLocation(current, { authorizeRepositoryControl: options.authorizeRepositoryControl, authorizeLinkedControl: true, linkedProjectRoot: root });
    if (linked.worktreeGitdir !== join(root, '.git', 'worktrees', entry.controlId)) fail('Nested linked-worktree control identity mismatch');
    const identityStat = path => { const s = lstatSync(path, { bigint: true }); return [s.dev, s.ino, s.mode].map(String); };
    const identity = hash(JSON.stringify([entry, linked.identity, identityStat(current), stableStat(lstatSync(join(current, '.git'), { bigint: true })), identityStat(linked.worktreeGitdir), identityStat(linked.gitdir),
      stableStat(lstatSync(join(linked.worktreeGitdir, 'gitdir'), { bigint: true })), stableStat(lstatSync(join(linked.worktreeGitdir, 'commondir'), { bigint: true }))]));
    return { ...entry, present: true, identity };
  });
}
// Validate every declared scope before any filesystem observation of a boundary.
function validateScopeOptions(options) {
  if (options.authorizeRepositoryControl !== true) fail('Explicit repository-control read authorization required');
  if (options.coordination !== undefined && options.authorizeCoordinationArtifacts !== true) fail('Explicit coordination-artifact authorization required');
  if (options.coordination !== undefined && !coordName(options.coordination)) fail('Invalid coordination task name');
  if (!!options.authorizeLinkedControl !== !!options.linkedProjectRoot || (options.linkedProjectRoot !== undefined && (typeof options.linkedProjectRoot !== 'string' || !isAbsolute(options.linkedProjectRoot)))) fail('Linked control requires explicit authorization and absolute owning project root');
  const nested = options.nestedLinked ?? [];
  if (!Array.isArray(nested)) fail('Invalid nested linked-worktree declarations');
  if (nested.length && (options.authorizeNestedLinkedControls !== true || options.coordination === undefined || options.authorizeLinkedControl)) fail('Nested linked worktrees require explicit control authorization and owner coordination');
  const seen = [];
  for (const entry of nested) {
    if (!sameKeys(entry, ['path', 'controlId']) || typeof entry.path !== 'string' || pathText(Buffer.from(entry.path)) !== entry.path ||
        !entry.path.startsWith('.agent-work/linked-worktrees/') || typeof entry.controlId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(entry.controlId)) fail('Invalid nested linked-worktree declaration');
    if (seen.some(x => x.path === entry.path || x.path.startsWith(entry.path + '/') || entry.path.startsWith(x.path + '/') || x.controlId === entry.controlId)) fail('Overlapping nested linked-worktree declarations');
    seen.push(entry);
  }
  const input = options.excludedPrefixes ?? [];
  if (!Array.isArray(input) || input.length > 32 || (input.length && options.authorizeExcludedPrefixes !== true)) fail('Explicit excluded-prefix authorization required');
  for (const prefix of input) if (typeof prefix !== 'string' || prefix.length > 512 || !/^[\x20-\x7e]+$/.test(prefix) || pathText(Buffer.from(prefix)) !== prefix) fail('Unsupported excluded prefix');
  const prefixes = sorted(input);
  const fold = x => x.toLowerCase();
  const overlaps = (a, b) => a === b || a.startsWith(b + '/') || b.startsWith(a + '/');
  for (const [i, prefix] of prefixes.entries()) {
    if (prefixes.slice(0, i).some(previous => overlaps(fold(prefix), fold(previous)))) fail('Overlapping excluded prefixes');
    const control = options.coordination === undefined ? null : '.agent-work/addy-coordination/' + options.coordination;
    if (control && overlaps(fold(prefix), fold(control))) fail('Excluded prefix overlaps coordination boundary');
    if (nested.some(n => overlaps(fold(prefix), fold(n.path)))) fail('Excluded prefix overlaps nested worktree boundary');
  }
  return prefixes;
}
function excludedPrefixesFor(root, options) {
  const prefixes = validateScopeOptions(options);
  for (const prefix of prefixes) {
    let parent = root;
    for (const part of prefix.split('/')) {
      const next = join(parent, part); let st;
      try { st = lstatSync(next); } catch (e) { if (e.code === 'ENOENT') break; throw e; }
      if (!st.isDirectory() || st.isSymbolicLink()) fail('Excluded prefix must have real directory components');
      // A case/normalization alias cannot silently select a different directory.
      if (!readdirSync(parent, { encoding: 'buffer' }).some(name => name.equals(Buffer.from(part)))) fail('Excluded prefix spelling does not match directory');
      parent = next;
    }
  }
  return prefixes;
}
function excludedPrefixStates(root, prefixes) {
  return prefixes.map(path => {
    try { const s = lstatSync(join(root, ...path.split('/')), { bigint: true }); return [path, String(s.dev), String(s.ino), String(s.mode)]; }
    catch (e) { if (e.code === 'ENOENT') return [path, null]; throw e; }
  });
}
function snapshotInventory(project, options) {
  validateScopeOptions(options);
  const root = realpathSync(resolve(project));
  const config = authorizeControl(root, options);
  const prefixes = excludedPrefixesFor(root, options), prefixStates = excludedPrefixStates(root, prefixes);
  if (prefixes.length && (process.platform !== 'darwin' || git(root, options, '--version').toString('utf8').trim() !== 'git version 2.54.0 (Apple Git-157)'))
    fail('Unsupported Git runtime for excluded-prefix pruning');
  const coordination = options.coordination === undefined ? undefined : coordinationObservation(root, options.coordination, options);
  const nested = nestedBoundaries(root, options);
  if (nested.length && options.authorizeLinkedControl) fail('Nested boundaries are supported only for the owning worktree');
  if (realpathSync(git(root, options, 'rev-parse', '--show-toplevel').toString('utf8').trim()) !== root) fail('Project must be the Git worktree root');
  const head = git(root, options, 'rev-parse', '--verify', 'HEAD^{commit}').toString('utf8').trim();
  if (!/^[a-f0-9]{40}([a-f0-9]{24})?$/.test(head)) fail('Invalid HEAD');
  const names = new Set(), tracked = new Set(), untracked = new Set();
  const tree = records(git(root, options, 'ls-tree', '-r', '-z', '--full-tree', 'HEAD')).map(record => {
    const tab = record.indexOf(9); if (tab < 0) fail('Malformed HEAD tree');
    const header = record.subarray(0, tab).toString('ascii');
    const match = /^(100644|100755|120000) blob ([a-f0-9]{40}(?:[a-f0-9]{24})?)$/.exec(header);
    if (!match) fail('Submodules or unsupported HEAD entries require separate handling');
    const path = pathText(record.subarray(tab + 1));
    if (coordination && (path === coordination.relativePath || path.startsWith(coordination.relativePath + '/'))) fail('Tracked candidate path inside coordination boundary');
    if (nested.some(n => path === n.path || path.startsWith(n.path + '/') || n.path.startsWith(path + '/'))) fail('Tracked candidate path overlaps nested linked-worktree boundary');
    names.add(path); tracked.add(path);
    return { path, mode: match[1], oid: match[2] };
  });
  const index = records(git(root, options, 'ls-files', '--stage', '-z')).map(record => {
    const tab = record.indexOf(9); if (tab < 0) fail('Malformed index');
    const header = record.subarray(0, tab).toString('ascii');
    const match = /^(100644|100755|120000) ([a-f0-9]{40}(?:[a-f0-9]{24})?) 0$/.exec(header);
    if (!match) fail('Unmerged, submodule or unsupported index entries require separate handling');
    const path = pathText(record.subarray(tab + 1));
    if (coordination && (path === coordination.relativePath || path.startsWith(coordination.relativePath + '/'))) fail('Tracked candidate path inside coordination boundary');
    if (nested.some(n => path === n.path || path.startsWith(n.path + '/') || n.path.startsWith(path + '/'))) fail('Tracked candidate path overlaps nested linked-worktree boundary');
    names.add(path); tracked.add(path);
    return { path, mode: match[1], oid: match[2] };
  });
  for (const record of records(git(root, options, 'ls-files', '-v', '-z'))) if (!record.subarray(0, 2).equals(Buffer.from('H '))) fail('Skip-worktree or assume-unchanged index flags cannot be verified');
  // --stage and -v alone hide intent-to-add and other extended index flags.
  // Reject every nonzero flag rather than conflate two different indexes.
  const debug = git(root, options, 'ls-files', '--debug', '-z');
  let offset = 0, count = 0;
  while (offset < debug.length) {
    const nul = debug.indexOf(0, offset); if (nul < 0) fail('Malformed index debug output');
    pathText(debug.subarray(offset, nul));
    const detail = debug.subarray(nul + 1, Math.min(debug.length, nul + 1025)).toString('ascii');
    const match = /^  ctime: [^\n]*\n  mtime: [^\n]*\n  dev: [^\n]*\n  uid: [^\n]*\n  size: [^\n]*\tflags: ([0-9a-f]+)\n/.exec(detail);
    if (!match) fail('Malformed index debug flags');
    if (!/^0+$/.test(match[1])) fail('Unsupported index flags, including intent-to-add');
    offset = nul + 1 + Buffer.byteLength(match[0], 'ascii'); count++;
  }
  if (count !== index.length) fail('Index debug entry count mismatch');
  if (prefixes.length && [...tracked].some(path => !/^[\x20-\x7e]+$/.test(path))) fail('Excluded prefixes require ASCII tracked paths');
  if (prefixes.some(prefix => [...tracked].some(path => {
    const p = prefix.toLowerCase(), t = path.toLowerCase(); return p === t || p.startsWith(t + '/') || t.startsWith(p + '/');
  }))) fail('Excluded prefix overlaps tracked HEAD or index path');
  // Literal exclusion pathspecs prune prefixes before Git enumerates their contents.
  // Deliberately do not evaluate .gitignore, info/exclude or external excludes.
  const otherArgs = prefixes.length ? ['--', '.', ...prefixes.map(prefix => ':(exclude,literal)' + prefix)] : [];
  for (const record of records(git(root, options, 'ls-files', '--others', '-z', ...otherArgs))) {
    const directoryRecord = record.at(-1) === 47;
    const path = pathText(directoryRecord ? record.subarray(0, -1) : record);
    if (prefixes.some(prefix => path.toLowerCase() === prefix.toLowerCase() || path.toLowerCase().startsWith(prefix.toLowerCase() + '/'))) fail('Git returned an excluded prefix path');
    if (nested.some(n => n.present && (path === n.path || path.startsWith(n.path + '/')))) continue;
    if (directoryRecord) fail('Unknown nested repository or directory record: ' + path);
    if (coordination && path.startsWith(coordination.relativePath + '/')) continue;
    names.add(path); untracked.add(path);
  }
  const order = (a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path));
  tree.sort(order); index.sort(order);
  if (authorizeControl(root, options) !== config) fail('Repository control changed during observation');
  if (coordination && coordinationObservation(root, options.coordination, options).stamp !== coordination.stamp) fail('Coordination boundary changed during observation');
  if (JSON.stringify(nestedBoundaries(root, options)) !== JSON.stringify(nested)) fail('Nested linked-worktree boundary changed during observation');
  if (JSON.stringify(excludedPrefixesFor(root, options)) !== JSON.stringify(prefixes) || JSON.stringify(excludedPrefixStates(root, prefixes)) !== JSON.stringify(prefixStates)) fail('Excluded prefixes changed during observation');
  return { root, head, tree, index, paths: sorted(names), tracked: sorted(tracked), untracked: sorted(untracked), coordination, nested, prefixes, prefixStates };
}
/** Reads authorized local Git control metadata and reveals worktree path names. */
export function inventoryCandidate(project, options = {}) {
  const inv = snapshotInventory(project, options);
  return { head: inv.head, paths: inv.paths, tracked: inv.tracked, untracked: inv.untracked,
    coordinationBoundary: inv.coordination?.relativePath ?? null, ...(inv.nested.length ? { nestedLinkedBoundaries: inv.nested } : {}),
    ...(inv.prefixes.length ? { excludedPrefixes: inv.prefixes } : {}),
    exclusions: [...EXCLUSIONS, ...(inv.coordination ? ['coordination boundary artifacts'] : []), ...(inv.nested.length ? ['nested linked-worktree contents'] : []), ...(inv.prefixes.length ? ['excluded directory prefixes (unobserved)'] : [])] };
}
const stableStat = s => [s.dev, s.ino, s.mode, s.size, s.mtimeNs, s.ctimeNs].map(String).join(':');
function scanFile(root, path, untracked, limits, budget) {
  const parts = path.split('/'); let parent = root;
  for (const part of parts.slice(0, -1)) {
    parent = join(parent, part);
    let stat; try { stat = lstatSync(parent, { bigint: true }); } catch (e) { if (e.code === 'ENOENT') { if (untracked) fail('Untracked file disappeared: ' + path); return { path, kind: 'missing' }; } throw e; }
    if (!stat.isDirectory() || stat.isSymbolicLink()) fail('Unsafe or non-directory parent: ' + path);
  }
  const file = join(root, ...parts);
  const rel = relative(root, file);
  if (rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel)) fail('Path escaped project');
  let before;
  try { before = lstatSync(file, { bigint: true }); }
  catch (e) { if (e.code === 'ENOENT') { if (untracked) fail('Untracked file disappeared: ' + path); return { path, kind: 'missing' }; } throw e; }
  const mode = Number(before.mode & 0o7777n);
  if (before.isSymbolicLink()) {
    const target = readlinkSync(file, { encoding: 'buffer' });
    if (target.length > limits.maxFileBytes) fail('Symlink target exceeds size limit: ' + path);
    budget.total += target.length; if (budget.total > limits.maxTotalBytes) fail('Candidate exceeds total size limit');
    const after = lstatSync(file, { bigint: true });
    if (stableStat(before) !== stableStat(after)) fail('Path changed during observation: ' + path);
    return { path, kind: 'symlink', mode, targetBase64: target.toString('base64') };
  }
  if (!before.isFile()) fail('Unsupported worktree object: ' + path);
  if (!(mode & 0o444)) fail('File has no read permission: ' + path);
  if (before.size > BigInt(limits.maxFileBytes)) fail('File exceeds size limit: ' + path);
  budget.total += Number(before.size); if (budget.total > limits.maxTotalBytes) fail('Candidate exceeds total size limit');
  const fd = openSync(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  let digest;
  try {
    const opened = fstatSync(fd, { bigint: true });
    if (!opened.isFile() || stableStat(before) !== stableStat(opened)) fail('Path changed before read: ' + path);
    const h = createHash('sha256'), buffer = Buffer.alloc(65536); let n, count = 0;
    while ((n = readSync(fd, buffer, 0, buffer.length, null)) > 0) {
      count += n; if (count > limits.maxFileBytes) fail('File grew beyond size limit: ' + path);
      h.update(buffer.subarray(0, n));
    }
    if (BigInt(count) !== before.size || stableStat(before) !== stableStat(fstatSync(fd, { bigint: true }))) fail('File changed during read: ' + path);
    digest = h.digest('hex');
  } finally { closeSync(fd); }
  if (stableStat(before) !== stableStat(lstatSync(file, { bigint: true }))) fail('Path changed after read: ' + path);
  return { path, kind: 'file', mode, size: Number(before.size), sha256: digest };
}
function limitsFor(options) {
  const maxFileBytes = options.maxFileBytes ?? MAX_FILE, maxTotalBytes = options.maxTotalBytes ?? MAX_TOTAL;
  if (!Number.isSafeInteger(maxFileBytes) || maxFileBytes < 0 || maxFileBytes > MAX_FILE ||
      !Number.isSafeInteger(maxTotalBytes) || maxTotalBytes < 0 || maxTotalBytes > MAX_TOTAL) fail('Invalid size limits');
  return { maxFileBytes, maxTotalBytes };
}
/** Every inventoried path must be explicitly included or excluded. */
export function captureCandidate(project, selection, options = {}) {
  if (options.authorizeRepositoryControl !== true) fail('Explicit repository-control read authorization required');
  const limits = limitsFor(options);
  if (!selection || typeof selection !== 'object' || Array.isArray(selection) || Object.keys(selection).sort().join(',') !== 'exclude,include' ||
      ![selection.include, selection.exclude].every(paths => Array.isArray(paths) && paths.every(path => typeof path === 'string' && pathText(Buffer.from(path)) === path))) fail('Selection requires include and exclude path arrays');
  const all = [...selection.include, ...selection.exclude];
  const first = snapshotInventory(project, options);
  if (new Set(all).size !== all.length || JSON.stringify(sorted(all)) !== JSON.stringify(first.paths)) fail('Selection must explicitly include or exclude exactly all inventoried paths');
  const included = new Set(selection.include), excluded = sorted(selection.exclude);
  const observe = inv => {
    const untracked = new Set(inv.untracked), budget = { total: 0 };
    // HEAD and index blobs are explicitly authorized by the same path
    // allowlist. Hash actual bytes in addition to Git object IDs and modes.
    const blobs = (entries, kind) => entries.map(entry => {
      const rawSize = git(inv.root, options, 'cat-file', '-s', entry.oid).toString('ascii').trim();
      if (!/^(0|[1-9][0-9]*)$/.test(rawSize)) fail('Invalid ' + kind + ' blob size: ' + entry.path);
      const size = Number(rawSize);
      if (!Number.isSafeInteger(size) || size > limits.maxFileBytes) fail(kind + ' blob exceeds size limit: ' + entry.path);
      budget.total += size; if (budget.total > limits.maxTotalBytes) fail('Candidate exceeds total size limit');
      const bytes = git(inv.root, options, 'cat-file', 'blob', entry.oid);
      if (bytes.length !== size) fail(kind + ' blob changed during observation: ' + entry.path);
      return { ...entry, size, sha256: hash(bytes) };
    });
    const tree = blobs(inv.tree.filter(entry => included.has(entry.path)), 'HEAD'), index = blobs(inv.index.filter(entry => included.has(entry.path)), 'staged');
    const worktree = inv.paths.filter(path => included.has(path)).map(path => scanFile(inv.root, path, untracked.has(path), limits, budget));
    return { tree, index, worktree };
  };
  const firstFiles = observe(first);
  if (options.beforeSecondPass) options.beforeSecondPass(); // Dependency injection for deterministic race tests; not exposed by CLI.
  const second = snapshotInventory(project, options);
  const view = inv => ({ head: inv.head, tree: inv.tree, index: inv.index, paths: inv.paths, untracked: inv.untracked, nested: inv.nested, prefixes: inv.prefixes, prefixStates: inv.prefixStates,
    coordination: inv.coordination ? { path: inv.coordination.relativePath, stamp: inv.coordination.stamp } : null });
  // Never open a newly appeared path that was not in the explicit allowlist.
  if (JSON.stringify(view(first)) !== JSON.stringify(view(second))) fail('Candidate changed during observation');
  const secondFiles = observe(second);
  if (JSON.stringify(firstFiles) !== JSON.stringify(secondFiles)) fail('Candidate changed during observation');
  if (options.afterSecondPass) options.afterSecondPass(); // Test-only boundary injection; not exposed by CLI.
  const final = snapshotInventory(project, options);
  if (JSON.stringify(view(first)) !== JSON.stringify(view(final))) fail('Candidate changed during observation');
  const manifest = { version: first.prefixes.length ? (first.nested.length ? 6 : first.coordination ? 5 : 7) : first.nested.length ? 4 : first.coordination ? 3 : 2, head: first.head, tree: firstFiles.tree, index: firstFiles.index, worktree: firstFiles.worktree,
    excludedPaths: excluded, coverage: excluded.length || first.nested.length || first.prefixes.length ? 'partial' : first.coordination ? 'all-task-relevant' : 'all-inventoried',
    exclusions: [...EXCLUSIONS, ...(first.coordination ? ['coordination boundary artifacts'] : []), ...(first.nested.length ? ['nested linked-worktree contents'] : []), ...(first.prefixes.length ? ['excluded directory prefixes (unobserved)'] : [])],
    ...(first.coordination ? { coordinationBoundary: first.coordination.relativePath } : {}),
    ...(first.nested.length ? { nestedLinkedBoundaries: first.nested.map(({ path, controlId }) => ({ path, controlId })) } : {}),
    ...(first.prefixes.length ? { excludedPrefixes: first.prefixes } : {}) };
  return { digest: hash(JSON.stringify(manifest)), manifest, ...(first.coordination ? { coordinationId: first.coordination.id } : {}) };
}
function retainManifest(root, name, options, result) {
  const boundary = coordinationObservation(root, name, options), manifests = join(boundary.directory, 'manifests');
  try { mkdirSync(manifests, { mode: 0o700 }); } catch (error) { if (error.code !== 'EEXIST') throw error; }
  const stat = lstatSync(manifests);
  if (!stat.isDirectory() || stat.isSymbolicLink() || realpathSync(manifests) !== manifests) fail('Unsafe coordination manifests directory');
  const fd = openSync(join(manifests, result.digest + '.json'), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), 0o600);
  try { writeFileSync(fd, JSON.stringify(result, null, 2) + '\n'); fsyncSync(fd); } finally { closeSync(fd); }
  for (const path of [manifests, boundary.directory]) { const dir = openSync(path, constants.O_RDONLY); try { fsyncSync(dir); } finally { closeSync(dir); } }
}
/** Retain a new, explicitly supplied selection without rewriting earlier evidence. */
export function retainCandidateSelection(project, selection, options = {}) {
  if (options.authorizeRepositoryControl !== true || options.authorizeCoordinationArtifacts !== true) fail('Explicit repository-control and coordination-artifact authorization required');
  const prefixes = validateScopeOptions(options);
  if (!options.coordination || !sameKeys(selection, ['include', 'exclude']) || ![selection.include, selection.exclude].every(a => Array.isArray(a) && a.every(x => typeof x === 'string' && pathText(Buffer.from(x)) === x)) || new Set([...selection.include, ...selection.exclude]).size !== selection.include.length + selection.exclude.length) fail('Invalid coordination selection');
  const paths = [...selection.include, ...selection.exclude];
  if (paths.some(path => prefixes.some(prefix => path.toLowerCase() === prefix.toLowerCase() || path.toLowerCase().startsWith(prefix.toLowerCase() + '/')))) fail('Selection overlaps excluded prefix');
  const root = realpathSync(resolve(project)); authorizeControl(root, options);
  if (JSON.stringify(sorted(paths)) !== JSON.stringify(inventoryCandidate(root, options).paths)) fail('Selection must explicitly include or exclude exactly all inventoried paths');
  const boundary = coordinationObservation(root, options.coordination, options), selections = join(boundary.directory, 'selections');
  try { mkdirSync(selections, { mode: 0o700 }); } catch (error) { if (error.code !== 'EEXIST') throw error; }
  const stat = lstatSync(selections);
  if (!stat.isDirectory() || stat.isSymbolicLink() || realpathSync(selections) !== selections) fail('Unsafe coordination selections directory');
  const digest = hash(JSON.stringify(selection));
  const fd = openSync(join(selections, digest + '.json'), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), 0o600);
  try { writeFileSync(fd, JSON.stringify(selection) + '\n'); fsyncSync(fd); } finally { closeSync(fd); }
  for (const path of [selections, boundary.directory]) { const dir = openSync(path, constants.O_RDONLY); try { fsyncSync(dir); } finally { closeSync(dir); } }
  return { digest, path: 'selections/' + digest + '.json', coordinationId: boundary.id };
}
/** Read retained evidence without pretending it still describes the current worktree. */
export function readRetainedCandidateEvidence(project, kind, digest, options = {}) {
  if (options.authorizeRepositoryControl !== true || options.authorizeCoordinationArtifacts !== true || !options.coordination) fail('Explicit repository-control and coordination-artifact authorization required');
  validateScopeOptions(options);
  if (!['selection', 'manifest'].includes(kind) || !sha(digest)) fail('Invalid retained evidence identity');
  const root = realpathSync(resolve(project)); authorizeControl(root, options);
  const before = coordinationObservation(root, options.coordination, options);
  const value = readSelectionFile(join(before.directory, kind === 'selection' ? 'selections' : 'manifests', digest + '.json'));
  const after = coordinationObservation(root, options.coordination, options);
  if (before.stamp !== after.stamp || before.id !== after.id) fail('Retained evidence changed during read');
  if (kind === 'selection' ? hash(JSON.stringify(value)) !== digest : value.digest !== digest || value.coordinationId !== before.id || hash(JSON.stringify(value.manifest)) !== digest) fail('Retained evidence digest mismatch');
  return value;
}
/** Capture and retain a separately authorized observation; never overwrite an existing manifest. */
export function captureRetainedCandidate(project, selection, options = {}) {
  if (options.authorizeRepositoryControl !== true || options.authorizeCoordinationArtifacts !== true || !options.coordination) fail('Explicit repository-control and coordination-artifact authorization required');
  validateScopeOptions(options);
  const result = captureCandidate(project, selection, options);
  if (!result.coordinationId) fail('Coordination boundary required for retained capture');
  retainManifest(realpathSync(resolve(project)), options.coordination, options, result);
  return result;
}
function assertSelectionOutsidePrefixes(project, selectionFile, options) {
  const prefixes = validateScopeOptions(options);
  if (!prefixes.length) return;
  const root = realpathSync(resolve(project)), file = resolve(selectionFile);
  if (!/^[\x20-\x7e]+$/.test(file)) fail('Prefixed CLI selection path must use printable ASCII');
  const protectedPaths = prefixes.map(prefix => join(root, ...prefix.split('/')).toLowerCase());
  let current = parse(file).root;
  for (const part of file.slice(current.length).split(sep)) {
    if (!part) continue;
    current = join(current, part);
    const folded = current.toLowerCase();
    if (protectedPaths.some(path => folded === path || folded.startsWith(path + sep))) fail('Selection path overlaps excluded prefix');
    if (lstatSync(current).isSymbolicLink()) fail('Prefixed CLI selection path cannot traverse symlinks');
  }
}
function readSelectionFile(path) {
  const before = lstatSync(path, { bigint: true });
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1n || before.size > 16n * 1024n * 1024n) fail('Unsafe selection file');
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0)); let data;
  try {
    if (stableStat(before) !== stableStat(fstatSync(fd, { bigint: true }))) fail('Selection changed before read');
    data = readFileSync(fd);
    if (stableStat(before) !== stableStat(fstatSync(fd, { bigint: true }))) fail('Selection changed during read');
  } finally { closeSync(fd); }
  if (stableStat(before) !== stableStat(lstatSync(path, { bigint: true }))) fail('Selection changed after read');
  return JSON.parse(data.toString('utf8'));
}
export function verifyCandidate(project, allowedPaths, expected, options = {}) {
  if (options.authorizeRepositoryControl !== true) fail('Explicit repository-control read authorization required');
  if (!sha(expected)) fail('Expected digest must be lowercase SHA-256');
  validateScopeOptions(options);
  authorizeControl(realpathSync(resolve(project)), options);
  const checkNested = () => {
    const nested = nestedBoundaries(realpathSync(resolve(project)), options);
    if (!nested.length) { if (options.expectedNestedIdentities?.length) fail('Unexpected nested control identity'); return nested; }
    const expectedIdentities = options.expectedNestedIdentities;
    if (!Array.isArray(expectedIdentities) || expectedIdentities.length !== nested.length ||
        nested.some(n => !expectedIdentities.some(e => sameKeys(e, ['path', 'identity']) && e.path === n.path &&
          (n.present ? sha(e.identity) && e.identity === n.identity : e.identity === null))))
      fail('Matching present nested linked-worktree control identities or explicit absent expectations required');
    return nested;
  };
  const nestedVerification = checkNested();
  const result = captureCandidate(project, allowedPaths, options);
  if (JSON.stringify(checkNested()) !== JSON.stringify(nestedVerification)) fail('Nested linked-worktree identity changed during verification');
  if (result.digest !== expected) fail('Candidate digest mismatch');
  if (options.coordination !== undefined) {
    const retained = coordinationObservation(realpathSync(resolve(project)), options.coordination, options);
    if (retained.id !== result.coordinationId || !retained.retainedDigests.includes(expected)) fail('Matching retained coordination manifest and identity required for verification');
  }
  return nestedVerification.length ? { ...result, nestedVerification } : result;
}
/** Transfer is disabled until directory-relative isolation is available. */
export function transferCandidate() {
  fail('Transfer disabled: safe directory-relative no-follow isolation is unavailable');
}
/** Compare freshly reverified retained candidates; this does not transfer data or create a snapshot. */
export function compareCandidates(request) {
  const { ownerProject, linkedProject, task, boundary, controlId, expectedControlIdentity, ownerDigest, linkedDigest, ownerAuthorization, linkedAuthorization, additionalBoundaries = [] } = request ?? {};
  if (ownerAuthorization?.authorizeRepositoryControl !== true || ownerAuthorization?.authorizeCoordinationArtifacts !== true || ownerAuthorization?.authorizeNestedLinkedControls !== true ||
      linkedAuthorization?.authorizeRepositoryControl !== true || linkedAuthorization?.authorizeCoordinationArtifacts !== true || linkedAuthorization?.authorizeLinkedControl !== true)
    fail('Explicit independent owner and linked control/coordination authorizations required');
  if (typeof ownerProject !== 'string' || typeof linkedProject !== 'string' || !coordName(task) || typeof boundary !== 'string' ||
      pathText(Buffer.from(boundary)) !== boundary || !boundary.startsWith('.agent-work/linked-worktrees/') || typeof controlId !== 'string' ||
      !sha(expectedControlIdentity) || !sha(ownerDigest) || !sha(linkedDigest) || !Array.isArray(additionalBoundaries) ||
      !additionalBoundaries.every(x => sameKeys(x, ['path', 'controlId', 'identity']) && typeof x.path === 'string' && typeof x.controlId === 'string' && sha(x.identity))) fail('Invalid comparison request');
  const boundaries = [{ path: boundary, controlId, identity: expectedControlIdentity }, ...additionalBoundaries];
  const declarations = boundaries.map(({ path, controlId }) => ({ path, controlId })).sort((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path)));
  // Validate both scopes before reading either side's coordination or nested controls.
  const ownerPreflight = { ...ownerAuthorization, coordination: task, nestedLinked: declarations };
  const linkedPreflight = { ...linkedAuthorization, coordination: task };
  validateScopeOptions(ownerPreflight);
  // The owning root is supplied below, after its path is resolved.
  validateScopeOptions({ ...linkedPreflight, linkedProjectRoot: linkedPreflight.linkedProjectRoot ?? resolve(ownerProject) });
  const owner = realpathSync(resolve(ownerProject)), linked = resolve(linkedProject);
  if (linked !== join(owner, ...boundary.split('/'))) fail('Linked candidate is not the declared owner boundary');
  const ownerOptions = { ...ownerAuthorization, coordination: task, nestedLinked: declarations, expectedNestedIdentities: boundaries.map(({ path, identity }) => ({ path, identity })) };
  const linkedOptions = { ...linkedAuthorization, linkedProjectRoot: owner, coordination: task };
  validateScopeOptions(ownerOptions); validateScopeOptions(linkedOptions);
  authorizeControl(owner, ownerOptions);
  // Verify the owner boundary before inspecting any linked selection contents.
  const ownerSelection = readSelectionFile(join(coordDirectory(owner, task), 'selection.json'));
  const firstOwner = verifyCandidate(owner, ownerSelection, ownerDigest, ownerOptions);
  const linkedSelection = readSelectionFile(join(coordDirectory(linked, task), 'selection.json'));
  const firstLinked = verifyCandidate(linked, linkedSelection, linkedDigest, linkedOptions);
  const secondOwner = verifyCandidate(owner, readSelectionFile(join(coordDirectory(owner, task), 'selection.json')), ownerDigest, ownerOptions);
  const secondLinked = verifyCandidate(linked, readSelectionFile(join(coordDirectory(linked, task), 'selection.json')), linkedDigest, linkedOptions);
  if (JSON.stringify(firstOwner) !== JSON.stringify(secondOwner) || JSON.stringify(firstLinked) !== JSON.stringify(secondLinked)) fail('Candidate evidence changed during comparison');
  const a = firstOwner.manifest, b = firstLinked.manifest;
  const scoped = a.version === 6 && b.version === 5;
  if (!(a.version === 4 && b.version === 3 || scoped) || a.coverage !== 'partial' || b.coverage !== (scoped ? 'partial' : 'all-task-relevant') ||
      (scoped && JSON.stringify(a.excludedPrefixes) !== JSON.stringify(b.excludedPrefixes)) ||
      a.excludedPaths.length !== 0 || b.excludedPaths.length !== 0 || a.coordinationBoundary !== b.coordinationBoundary ||
      JSON.stringify(a.nestedLinkedBoundaries) !== JSON.stringify(declarations))
    fail('Candidate coverage or exclusions are incompatible for comparison');
  const comparable = m => ({ head: m.head, tree: m.tree, index: m.index, worktree: m.worktree });
  if (JSON.stringify(comparable(a)) !== JSON.stringify(comparable(b))) fail('Candidate contents differ');
  return { equal: true, scope: scoped ? 'partial: selected HEAD, index and worktree contents only; excluded directory prefixes are unobserved' : 'selected HEAD, index and worktree contents; stated manifest exclusions apply', ...(scoped ? { excludedPrefixes: a.excludedPrefixes } : {}), task, linkedBoundary: boundary, ownerDigest, linkedDigest,
    ownerCoordinationId: firstOwner.coordinationId, linkedCoordinationId: firstLinked.coordinationId, nestedControlIdentity: expectedControlIdentity,
    ownerBoundaries: firstOwner.nestedVerification };
}
if (typeof import.meta.main !== 'boolean') throw new Error('Node.js with import.meta.main support is required');
if (import.meta.main) {
  try {
    const [project, authorization, ...args] = process.argv.slice(2);
    if (!project || authorization !== '--authorize-repository-control') fail('Explicit repository-control read authorization required');
    const options = { authorizeRepositoryControl: true };
    while (args[0]?.startsWith('--')) {
      const flag = args.shift();
      if (flag === '--authorize-coordination-artifacts' && !options.authorizeCoordinationArtifacts) options.authorizeCoordinationArtifacts = true;
      else if (flag === '--authorize-excluded-prefixes' && !options.authorizeExcludedPrefixes) options.authorizeExcludedPrefixes = true;
      else if (flag === '--exclude-prefix' && args[0]) (options.excludedPrefixes ??= []).push(args.shift());
      else if (flag === '--authorize-nested-linked-controls' && !options.authorizeNestedLinkedControls) options.authorizeNestedLinkedControls = true;
      else if (flag === '--expect-nested-absent' && args[0]) (options.expectedNestedIdentities ??= []).push({ path: args.shift(), identity: null });
      else if ((flag === '--nested-linked' || flag === '--expected-nested-identity') && args[0]?.includes('=')) {
        const value = args.shift(), split = value.lastIndexOf('=');
        if (split < 1 || split === value.length - 1) fail('Invalid nested linked-worktree option');
        if (flag === '--nested-linked') (options.nestedLinked ??= []).push({ path: value.slice(0, split), controlId: value.slice(split + 1) });
        else (options.expectedNestedIdentities ??= []).push({ path: value.slice(0, split), identity: value.slice(split + 1) });
      }
      else if (flag === '--authorize-linked-control' && !options.authorizeLinkedControl) options.authorizeLinkedControl = true;
      else if (flag === '--linked-project-root' && !options.linkedProjectRoot && args[0]) options.linkedProjectRoot = args.shift();
      else if (flag === '--coordination' && !options.coordination && coordName(args[0])) options.coordination = args.shift();
      else fail('Unknown, duplicate or incomplete candidate option');
    }
    if (!!options.authorizeLinkedControl !== !!options.linkedProjectRoot) fail('Linked control requires both authorization and owning project root');
    validateScopeOptions(options);
    if (args[0] === 'init-coordination') {
      if (args.length !== 2) fail('Use init-coordination TASK');
      console.log(JSON.stringify(initCoordination(project, args[1], options), null, 2));
    } else {
      const [action, list, extra, ...rest] = args;
      if (!['inventory', 'capture', 'verify'].includes(action) || rest.length ||
          (action === 'inventory' ? list !== undefined : !list) ||
          (action === 'verify' ? !sha(extra) : action === 'capture' ? (extra !== undefined && extra !== '--write-manifest') : extra !== undefined) ||
          (extra === '--write-manifest' && !options.coordination))
        fail('Usage: node addy-candidate.mjs PROJECT --authorize-repository-control [--authorize-linked-control --linked-project-root ROOT] [--authorize-coordination-artifacts --coordination TASK] inventory | capture SELECTION.json [--write-manifest] | verify SELECTION.json SHA256');
      if (action !== 'inventory') {
        const root = realpathSync(resolve(project));
        authorizeControl(root, options);
        assertSelectionOutsidePrefixes(root, list, options);
        if (options.coordination) {
          const boundary = coordinationObservation(root, options.coordination, options);
          if (resolve(list) !== join(boundary.directory, 'selection.json')) fail('Coordination selection must be the boundary selection.json');
        }
      }
      const result = action === 'inventory' ? inventoryCandidate(project, options) :
        action === 'capture' ? captureCandidate(project, readSelectionFile(list), options) : verifyCandidate(project, readSelectionFile(list), extra, options);
      if (extra === '--write-manifest') retainManifest(realpathSync(resolve(project)), options.coordination, options, result);
      console.log(JSON.stringify(result, null, 2));
    }
  } catch (error) { console.error('addy-candidate:', error.message); process.exitCode = 1; }
}
