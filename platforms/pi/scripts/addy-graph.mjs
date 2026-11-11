#!/usr/bin/env node
// Explicit, local coordination journal. This is not an execution service,
// authority check, source snapshot, workspace lock, or automatic scheduler.
import { createHash } from 'node:crypto';
import { closeSync, constants, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';

const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(value);
const sha = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const text = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 4096 && !value.includes('\0');
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(k => Object.hasOwn(value, k));
const hash = data => createHash('sha256').update(data).digest('hex');
const MAX_ENTRY_BYTES = 1024 * 1024;
// Normalize exported API input to the exact JSON representation replay will see.
function normalize(command) {
  const raw = JSON.stringify(command);
  if (typeof raw !== 'string') fail('Command must be JSON-serializable');
  return JSON.parse(raw);
}
function encode(seq, prev, command) {
  const payload = { version: 2, seq, prev, command };
  const bytes = JSON.stringify({ ...payload, checksum: hash(JSON.stringify(payload)) }) + '\n';
  if (Buffer.byteLength(bytes, 'utf8') > MAX_ENTRY_BYTES) fail('Journal entry exceeds 1 MiB serialized byte limit');
  return bytes;
}
const fail = message => { throw new Error(message); };
const digestInput = (candidate, evidence) => { if (!sha(candidate) || !sha(evidence)) fail('Candidate and evidence must be lowercase SHA-256 digests'); };

/** Pure budget check for a future command, not state/readiness validation.
 * Use the actual JSON representation, the same reference/encoding limits as
 * execution, and the longest supported sequence/previous-hash envelope. */
export function preflightGraphCommand(command) {
  const normalized = normalize(command);
  for (const key of ['baselineRef', 'ref', 'worker', 'workspace', 'taskRef', 'resultRef', 'note'])
    if (Object.hasOwn(normalized, key) && !text(normalized[key])) fail('Graph preflight: ' + key + ' exceeds reference constraints (4096 characters, nonempty, no NUL)');
  if (Object.hasOwn(normalized, 'expected') && (!Number.isSafeInteger(normalized.expected) || normalized.expected < 0)) fail('Graph preflight: invalid expected revision');
  encode(Number.MAX_SAFE_INTEGER, '0'.repeat(64), normalized);
}

function validatePlan(slices) {
  if (!Array.isArray(slices) || !slices.length || slices.length > 256) fail('Plan requires 1–256 slices');
  const map = new Map();
  for (const s of slices) {
    if (!exact(s, ['id', 'depends']) || !id(s.id) || !Array.isArray(s.depends) || !s.depends.every(id) || new Set(s.depends).size !== s.depends.length) fail('Invalid slice or duplicate dependency');
    if (map.has(s.id)) fail('Duplicate slice ID: ' + s.id);
    map.set(s.id, [...s.depends]);
  }
  for (const [name, deps] of map) for (const dep of deps) if (!map.has(dep)) fail(`Missing dependency ${dep} of ${name}`);
  const visiting = new Set(), visited = new Set();
  function walk(name) {
    if (visiting.has(name)) fail('Dependency cycle at ' + name);
    if (visited.has(name)) return;
    visiting.add(name); for (const dep of map.get(name)) walk(dep); visiting.delete(name); visited.add(name);
  }
  for (const name of map.keys()) walk(name);
  return map;
}

function initial(command) {
  if (!exact(command, ['op', 'baseline', 'baselineRef', 'slices']) || command.op !== 'init' || !sha(command.baseline) || !text(command.baselineRef)) fail('Invalid init: baseline digest, reference and slices required');
  return { plan: validatePlan(command.slices), baseline: { version: 0, digest: command.baseline, ref: command.baselineRef }, attempts: new Map(), latest: new Map(), revision: 0 };
}
function valid(state, slice, cache = new Map()) {
  if (cache.has(slice)) return cache.get(slice);
  const attempt = state.attempts.get(state.latest.get(slice));
  if (!attempt || attempt.status !== 'completed' || attempt.baseline.version !== state.baseline.version) { cache.set(slice, false); return false; }
  const ok = attempt.inputs.every(input => {
    const current = state.attempts.get(state.latest.get(input.slice));
    return current && current.id === input.attempt && current.candidate === input.candidate && current.evidence === input.evidence && valid(state, input.slice, cache);
  });
  cache.set(slice, !!ok); return !!ok;
}
function apply(state, cmd) {
  if (!cmd || cmd.expected !== state.revision || !Number.isSafeInteger(cmd.expected)) fail('Stale or missing expected revision; inspect before deciding whether to continue');
  if (cmd.op === 'baseline') {
    if (!exact(cmd, ['op', 'expected', 'digest', 'ref']) || !sha(cmd.digest) || !text(cmd.ref)) fail('Invalid baseline record');
    state.baseline = { version: state.revision + 1, digest: cmd.digest, ref: cmd.ref };
  } else if (cmd.op === 'start') {
    if (!exact(cmd, ['op', 'expected', 'slice', 'attempt', 'worker', 'workspace', 'taskRef']) || !id(cmd.slice) || !id(cmd.attempt) || !text(cmd.worker) || !text(cmd.workspace) || !text(cmd.taskRef)) fail('Invalid attempt workbook');
    if (!state.plan.has(cmd.slice)) fail('Unknown slice: ' + cmd.slice);
    if (state.attempts.has(cmd.attempt)) fail('Attempt ID already used; never replay an attempt');
    const previous = state.attempts.get(state.latest.get(cmd.slice));
    if (previous?.status === 'running') fail('Slice has an unresolved running attempt; reconcile first');
    const inputs = state.plan.get(cmd.slice).map(slice => {
      if (!valid(state, slice)) fail('Dependency not ready: ' + slice);
      const dep = state.attempts.get(state.latest.get(slice));
      return { slice, attempt: dep.id, candidate: dep.candidate, evidence: dep.evidence };
    });
    state.attempts.set(cmd.attempt, { id: cmd.attempt, slice: cmd.slice, status: 'running', worker: cmd.worker, workspace: cmd.workspace, taskRef: cmd.taskRef, baseline: { ...state.baseline }, inputs });
    state.latest.set(cmd.slice, cmd.attempt);
  } else if (cmd.op === 'checkpoint') {
    if (!exact(cmd, ['op', 'expected', 'attempt', 'identity', 'ref']) || !id(cmd.attempt) || !sha(cmd.identity) || !text(cmd.ref)) fail('Invalid checkpoint record');
    const a = state.attempts.get(cmd.attempt);
    if (!a || a.status !== 'running' || state.latest.get(a.slice) !== a.id) fail('Attempt is not running');
    if (a.baseline.version !== state.baseline.version || a.inputs.some(input => {
      const current = state.attempts.get(state.latest.get(input.slice));
      return !valid(state, input.slice) || !current || current.id !== input.attempt || current.candidate !== input.candidate || current.evidence !== input.evidence;
    })) fail('Attempt input is stale; reconcile it rather than recording a checkpoint');
    if (a.checkpoint || a.prepared) fail('Attempt already checkpointed or prepared');
    a.checkpoint = { identity: cmd.identity, ref: cmd.ref };
  } else if (cmd.op === 'prepare' || cmd.op === 'finish') {
    if (!exact(cmd, ['op', 'expected', 'attempt', 'candidate', 'evidence', 'resultRef']) || !id(cmd.attempt) || !text(cmd.resultRef)) fail('Invalid ' + cmd.op + ' record');
    digestInput(cmd.candidate, cmd.evidence);
    const a = state.attempts.get(cmd.attempt);
    if (!a || a.status !== 'running' || state.latest.get(a.slice) !== a.id) fail('Attempt is not running');
    if (a.baseline.version !== state.baseline.version || a.inputs.some(input => {
      const current = state.attempts.get(state.latest.get(input.slice));
      return !valid(state, input.slice) || !current || current.id !== input.attempt || current.candidate !== input.candidate || current.evidence !== input.evidence;
    })) fail('Attempt input is stale; reconcile it rather than publishing completion');
    if (cmd.op === 'prepare') {
      if (a.prepared) fail('Attempt already has prepared evidence');
      a.prepared = { candidate: cmd.candidate, evidence: cmd.evidence, resultRef: cmd.resultRef };
    } else {
      if (a.prepared && (a.prepared.candidate !== cmd.candidate || a.prepared.evidence !== cmd.evidence || a.prepared.resultRef !== cmd.resultRef)) fail('Finish must match prepared evidence');
      Object.assign(a, { status: 'completed', candidate: cmd.candidate, evidence: cmd.evidence, resultRef: cmd.resultRef });
    }
  } else if (cmd.op === 'reconcile') {
    if (!exact(cmd, ['op', 'expected', 'attempt', 'outcome', 'note']) || !id(cmd.attempt) || !['failed', 'abandoned'].includes(cmd.outcome) || !text(cmd.note)) fail('Invalid reconciliation');
    const a = state.attempts.get(cmd.attempt);
    if (!a || a.status !== 'running') fail('Attempt is not running');
    Object.assign(a, { status: cmd.outcome, reconciliation: cmd.note });
  } else fail('Unknown graph operation');
  state.revision++;
}
function snapshot(state) {
  return { revision: state.revision, baseline: state.baseline,
    slices: [...state.plan].map(([slice, deps]) => ({ id: slice, depends: deps, latest: state.latest.get(slice) ?? null,
      valid: valid(state, slice), ready: state.attempts.get(state.latest.get(slice))?.status !== 'running' && deps.every(dep => valid(state, dep)) })),
    attempts: [...state.attempts.values()] };
}

function graphPath(project, workspace, name, create) {
  if (!id(name)) fail('Invalid graph name');
  const root = realpathSync(resolve(project)), parent = realpathSync(resolve(workspace));
  const rel = relative(root, parent);
  if (rel === '' || rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel)) fail('Workspace must be an existing directory strictly inside the project');
  if (!lstatSync(parent).isDirectory()) fail('Workspace is not a directory');
  const path = join(parent, name);
  if (create) {
    mkdirSync(path, { mode: 0o700 });
    const dir = openSync(parent, constants.O_RDONLY); try { fsyncSync(dir); } finally { closeSync(dir); }
  }
  const stat = lstatSync(path);
  if (!stat.isDirectory() || stat.isSymbolicLink() || realpathSync(path) !== path) fail('Graph must be a real project-local directory');
  return path;
}
function load(path) {
  const names = readdirSync(path).sort();
  if (!names.length) fail('Incomplete graph journal; reconciliation required');
  let state, prev = null, legacy = false;
  for (let i = 0; i < names.length; i++) {
    if (names[i] !== String(i).padStart(8, '0') + '.json') fail('Unexpected, missing or out-of-order journal entry');
    const file = join(path, names[i]);
    const info = lstatSync(file);
    if (!info.isFile() || info.isSymbolicLink() || info.size > MAX_ENTRY_BYTES) fail('Invalid journal entry');
    const raw = readFileSync(file, 'utf8');
    let entry; try { entry = JSON.parse(raw); } catch { fail('Incomplete or corrupt journal entry; reconciliation required'); }
    if (entry?.version === 1) {
      if (!exact(entry, ['version', 'seq', 'prev', 'command'])) fail('Invalid legacy journal entry');
      legacy = true;
    } else if (entry?.version === 2) {
      if (!exact(entry, ['version', 'seq', 'prev', 'command', 'checksum']) || !sha(entry.checksum) ||
          hash(JSON.stringify({ version: entry.version, seq: entry.seq, prev: entry.prev, command: entry.command })) !== entry.checksum)
        fail('Journal entry checksum mismatch');
    } else fail('Unsupported journal version');
    if (entry.seq !== i || entry.prev !== prev) fail('Journal chain mismatch');
    if (i === 0) state = initial(entry.command); else apply(state, entry.command);
    prev = hash(raw);
  }
  return { state, prev, seq: names.length, legacy };
}
function append(path, seq, bytes) {
  const file = join(path, String(seq).padStart(8, '0') + '.json');
  const fd = openSync(file, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), 0o600);
  try { writeFileSync(fd, bytes); fsyncSync(fd); } finally { closeSync(fd); }
  const dir = openSync(path, constants.O_RDONLY); try { fsyncSync(dir); } finally { closeSync(dir); }
}

export function executeGraph(project, workspace, name, action, command) {
  if (action === 'init') {
    const normalized = normalize(command);
    const state = initial(normalized);
    const bytes = encode(0, null, normalized); // Size check before creating any directory.
    const path = graphPath(project, workspace, name, true);
    append(path, 0, bytes);
    return { ...snapshot(state), journalIntegrity: 'checksummed-v2' };
  }
  const path = graphPath(project, workspace, name, false);
  const { state, prev, seq, legacy } = load(path);
  if (action === 'inspect') {
    if (command !== undefined) fail('Inspect takes no command');
    return { ...snapshot(state), journalIntegrity: legacy ? 'legacy-v1-unsealed-read-only' : 'checksummed-v2' };
  }
  if (action !== 'apply') fail('Use init, inspect or apply');
  if (legacy) fail('Legacy v1 journal is unsealed and read-only; no implicit migration');
  const normalized = normalize(command);
  apply(state, normalized); // Validate before claiming the next immutable event name.
  const bytes = encode(seq, prev, normalized);
  append(path, seq, bytes);
  return { ...snapshot(state), journalIntegrity: 'checksummed-v2' };
}

if (typeof import.meta.main !== 'boolean') throw new Error('Node.js with import.meta.main support is required');
if (import.meta.main) {
  try {
    const [project, workspace, name, action, raw, ...extra] = process.argv.slice(2);
    if (!project || !workspace || !name || !action || extra.length || (action === 'inspect' ? raw !== undefined : raw === undefined))
      fail('Usage: node addy-graph.mjs PROJECT WORKSPACE GRAPH init|inspect|apply [JSON]');
    const command = raw === undefined ? undefined : JSON.parse(raw);
    console.log(JSON.stringify(executeGraph(project, workspace, name, action, command), null, 2));
  } catch (error) { console.error('addy-graph:', error.message); process.exitCode = 1; }
}
