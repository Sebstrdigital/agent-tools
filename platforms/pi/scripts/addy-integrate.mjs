#!/usr/bin/env node
// Manual-quiescence integration for trusted local processes. Not a sandbox,
// writer lock, authenticated approval service, merge engine or commit service.
import { createHash } from 'node:crypto';
import { constants, closeSync, fsyncSync, lstatSync, openSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { captureCandidate, captureRetainedCandidate, initCoordination, inventoryCandidate, readRetainedCandidateEvidence, retainCandidateSelection, verifyCandidate } from './addy-candidate.mjs';
import { executeGraph, preflightGraphCommand } from './addy-graph.mjs';
import { integrationProjection, planDisjointIntegration } from './addy-integration-plan.mjs';
import { createProjectedWorktree, readObservedFile } from './addy-materialize.mjs';

const fail = message => { throw Error(message); };
const hash = value => createHash('sha256').update(value).digest('hex');
const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(value);
const sha = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && same(Object.keys(value).sort(), [...keys].sort());
const authorization = { authorizeRepositoryControl: true, authorizeCoordinationArtifacts: true };
const rel = control => '.agent-work/linked-worktrees/' + control;
const boundary = (root, task) => join(root, '.agent-work/addy-coordination', task);
const pendingDigest = '0'.repeat(64); // Actual SHA-256 fields have this exact JSON width.
const quiescence = 'caller-declared-not-verified';
const preparationRecord = (ownerDigest, builders) => ({ version: 1, ownerDigest, builders, quiescence });
const integrationEvidence = (target, identity, ownerDigest, candidate, selectionDigest, request, exclusions) =>
  ({ version: 1, target, identity, ownerDigest, candidate, selectionDigest, request, quiescence, exclusions });
function grant(options) {
  if (options?.authorizeLocalIntegration !== true) fail('Explicit --authorize-local-integration required; see documented read/write scope');
  if (options?.inputsQuiescent !== true) fail('Explicit --declare-inputs-quiescent required; the caller must stop/reconcile all input writers');
}
function rootPath(project, task) {
  if (typeof project !== 'string' || !isAbsolute(project) || !id(task) || realpathSync(project) !== resolve(project)) fail('Real absolute project root and task ID required');
  return resolve(project);
}
function configuration(task, value) {
  if (!exact(value, ['builders', 'target', 'excludedPrefixes', 'selection']) || !Array.isArray(value.builders) || value.builders.length !== 3 || !value.builders.every(id) || !id(value.target) ||
      new Set([...value.builders, value.target].map(x => x.toLowerCase())).size !== 4 || [...value.builders, value.target].some(x => !id(task + '-' + x)) ||
      !Array.isArray(value.excludedPrefixes) || !exact(value.selection, ['include', 'exclude']) || !Array.isArray(value.selection.include) || !Array.isArray(value.selection.exclude) || value.selection.exclude.length) fail('Exactly three distinct independent builders, a fresh target, explicit prefixes and full selection required');
  return value;
}
function contexts(root, task, config) {
  const controls = [...config.builders, config.target].map(name => task + '-' + name);
  const prefix = config.excludedPrefixes.length ? { authorizeExcludedPrefixes: true, excludedPrefixes: config.excludedPrefixes } : {};
  return {
    controls,
    owner: { ...authorization, coordination: task, authorizeNestedLinkedControls: true, nestedLinked: controls.map(controlId => ({ path: rel(controlId), controlId })), ...prefix },
    linked: { ...authorization, coordination: task, authorizeLinkedControl: true, linkedProjectRoot: root, ...prefix },
  };
}
function graph(root, task, action = 'inspect', command) { return executeGraph(root, boundary(root, task), 'graph', action, command); }
function absent(path) {
  try { lstatSync(path); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
  fail('Target already exists; never adopt, overwrite or replay: ' + path);
}
function syncDirectory(path) {
  const fd = openSync(path, constants.O_RDONLY); try { fsyncSync(fd); } finally { closeSync(fd); }
}
function freshJSON(path, value) {
  const fd = openSync(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), 0o600);
  try { writeFileSync(fd, JSON.stringify(value) + '\n'); fsyncSync(fd); } finally { closeSync(fd); }
  syncDirectory(dirname(path));
}
function ensureAllSelected(selection) {
  if (!exact(selection, ['include', 'exclude']) || !Array.isArray(selection.include) || !Array.isArray(selection.exclude) || selection.exclude.length) fail('Explicit full candidate selection required; path exclusions unsupported');
}
function identity(inv, control) {
  const found = inv.nestedLinkedBoundaries.find(x => x.controlId === control);
  if (!found?.present || !sha(found.identity)) fail('Missing linked boundary: ' + control);
  return found.identity;
}
function checkBoundaries(inv, controls, expected) {
  if (inv.nestedLinkedBoundaries.length !== controls.length) fail('Boundary declaration mismatch');
  for (const control of controls) {
    const found = inv.nestedLinkedBoundaries.find(x => x.controlId === control);
    if (!found || (expected[control] === null ? found.present : !found.present || found.identity !== expected[control])) fail('Stale or unexpected linked boundary: ' + control);
  }
}
function verifyOwner(root, task, config, digest, expected) {
  const { owner, controls } = contexts(root, task, config);
  checkBoundaries(inventoryCandidate(root, owner), controls, expected);
  return verifyCandidate(root, config.selection, digest, { ...owner, expectedNestedIdentities: controls.map(control => ({ path: rel(control), identity: expected[control] })) });
}
function retainSelection(target, task, selection, linked) {
  const digest = hash(JSON.stringify(selection)), path = join(boundary(target, task), 'selections', digest + '.json');
  let present = false;
  try { lstatSync(path); present = true; } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (present) {
    if (!same(readRetainedCandidateEvidence(target, 'selection', digest, linked), selection)) fail('Retained selection mismatch');
    return { digest };
  }
  return retainCandidateSelection(target, selection, linked);
}
function retainLinked(root, target, task, selection, linked) {
  initCoordination(target, task, { ...authorization, authorizeLinkedControl: true, linkedProjectRoot: root });
  freshJSON(join(boundary(target, task), 'selection.json'), selection);
  const retainedSelection = retainCandidateSelection(target, selection, linked);
  const captured = captureRetainedCandidate(target, selection, linked);
  syncDirectory(join(target, '.agent-work')); syncDirectory(target);
  return { digest: captured.digest, selectionDigest: retainedSelection.digest, manifest: captured.manifest };
}
function load(root, task) {
  const state = graph(root, task), config = configuration(task, JSON.parse(state.baseline.ref));
  const prepared = state.attempts.find(a => a.id === 'prepare');
  if (state.journalIntegrity !== 'checksummed-v2' || !prepared || prepared.status !== 'completed' || !state.slices.find(s => s.id === 'prepare')?.valid) fail('Preparation is unresolved or stale; inspect and reconcile, never replay');
  const record = JSON.parse(prepared.resultRef);
  if (hash(prepared.resultRef) !== prepared.evidence || record.ownerDigest !== state.baseline.digest || !Array.isArray(record.builders) || record.builders.length !== 3) fail('Prepared evidence mismatch');
  return { state, config, record, ...contexts(root, task, config) };
}

/** Prepare exactly three independent workspaces from an explicitly selected dirty baseline. */
export function prepareIntegration(project, task, raw, options, hooks = {}) {
  grant(options); const root = rootPath(project, task), config = configuration(task, raw), { owner, linked, controls } = contexts(root, task, config);
  for (const control of controls) { absent(join(root, rel(control))); absent(join(root, '.git/worktrees', control)); }
  // Budget every eventual record before creating even the coordination boundary.
  // Only fixed-width ASCII digests are unknown; names, paths, selection and all
  // JSON escaping are already exact. Reuse the actual evidence constructor.
  const pendingBuilders = config.builders.map(name => ({ id: name, control: task + '-' + name, identity: pendingDigest, preparedDigest: pendingDigest, preparedSelectionDigest: pendingDigest }));
  preflightGraphCommand({ op: 'init', baseline: pendingDigest, baselineRef: JSON.stringify(config), slices: [{ id: 'prepare', depends: [] }, { id: 'integrate', depends: ['prepare'] }] });
  preflightGraphCommand({ op: 'start', expected: 0, slice: 'prepare', attempt: 'prepare', worker: 'manual-local-preparer', workspace: root, taskRef: JSON.stringify({ task, controls, quiescence }) });
  preflightGraphCommand({ op: 'finish', expected: 1, attempt: 'prepare', candidate: pendingDigest, evidence: pendingDigest, resultRef: JSON.stringify(preparationRecord(pendingDigest, pendingBuilders)) });
  initCoordination(root, task, authorization);
  // A failure before intent can leave an incomplete, task-owned coordination
  // directory. It is retained, never adopted; use a fresh authorized workspace.
  freshJSON(join(boundary(root, task), 'selection.json'), config.selection);
  const inv = inventoryCandidate(root, owner), expected = Object.fromEntries(controls.map(control => [control, null]));
  checkBoundaries(inv, controls, expected);
  const base = captureRetainedCandidate(root, config.selection, owner), projection = integrationProjection(base.manifest);
  verifyOwner(root, task, config, base.digest, expected);
  syncDirectory(join(root, '.agent-work')); syncDirectory(root);
  graph(root, task, 'init', { op: 'init', baseline: base.digest, baselineRef: JSON.stringify(config), slices: [{ id: 'prepare', depends: [] }, { id: 'integrate', depends: ['prepare'] }] });
  graph(root, task, 'apply', { op: 'start', expected: 0, slice: 'prepare', attempt: 'prepare', worker: 'manual-local-preparer', workspace: root, taskRef: JSON.stringify({ task, controls, quiescence: 'caller-declared-not-verified' }) });
  hooks.afterIntent?.();
  const builders = [];
  for (const name of config.builders) {
    const control = task + '-' + name;
    const target = createProjectedWorktree(root, control, projection, entry => readObservedFile(root, entry), hooks);
    const current = inventoryCandidate(root, owner); expected[control] = identity(current, control);
    verifyOwner(root, task, config, base.digest, expected);
    const captured = retainLinked(root, target, task, config.selection, linked);
    if (!same(integrationProjection(captured.manifest), projection)) fail('Prepared candidate differs from source baseline');
    verifyCandidate(target, config.selection, captured.digest, linked);
    builders.push({ id: name, control, identity: expected[control], preparedDigest: captured.digest, preparedSelectionDigest: captured.selectionDigest });
  }
  for (const builder of builders) verifyCandidate(join(root, rel(builder.control)), config.selection, builder.preparedDigest, linked);
  verifyOwner(root, task, config, base.digest, expected);
  const record = preparationRecord(base.digest, builders), resultRef = JSON.stringify(record);
  graph(root, task, 'apply', { op: 'finish', expected: 1, attempt: 'prepare', candidate: base.digest, evidence: hash(resultRef), resultRef });
  return { status: 'prepared', task, project: root, ...record, workspaces: builders.map(b => ({ id: b.id, path: join(root, rel(b.control)) })) };
}

/** Explicit caller-selected output, separate from immutable prepared evidence. */
export function captureBuilderOutput(project, task, request, options) {
  grant(options); const root = rootPath(project, task), context = load(root, task);
  if (!exact(request, ['builder', 'selection'])) fail('Builder and explicit selection required');
  ensureAllSelected(request.selection);
  const builder = context.record.builders.find(b => b.id === request.builder);
  if (!builder) fail('Unknown builder');
  const expected = Object.fromEntries(context.record.builders.map(b => [b.control, b.identity])); expected[task + '-' + context.config.target] = null;
  verifyOwner(root, task, context.config, context.record.ownerDigest, expected);
  const target = join(root, rel(builder.control));
  const observed = captureCandidate(target, request.selection, context.linked);
  const selection = retainSelection(target, task, request.selection, context.linked);
  let retained = false;
  try { lstatSync(join(boundary(target, task), 'manifests', observed.digest + '.json')); retained = true; } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const candidate = retained ? readRetainedCandidateEvidence(target, 'manifest', observed.digest, context.linked) : captureRetainedCandidate(target, request.selection, context.linked);
  verifyCandidate(target, request.selection, candidate.digest, context.linked);
  return { id: builder.id, preparedDigest: builder.preparedDigest, outputDigest: candidate.digest, selectionDigest: selection.digest, dependencies: [] };
}

function verifiedPlan(root, task, request, targetIdentity = null) {
  const context = load(root, task), { config, record, owner, linked, controls } = context;
  if (!exact(request, ['attempt', 'builders']) || !id(request.attempt) || !Array.isArray(request.builders) || request.builders.length !== 3) fail('Attempt and exactly three explicit builder outputs required');
  const expected = Object.fromEntries(record.builders.map(b => [b.control, b.identity])); expected[task + '-' + config.target] = targetIdentity;
  const base = verifyOwner(root, task, config, record.ownerDigest, expected);
  const canonical = integrationProjection(base.manifest), builders = [];
  const seen = new Set();
  for (const selected of request.builders) {
    if (!exact(selected, ['id', 'preparedDigest', 'outputDigest', 'selectionDigest', 'paths', 'dependencies']) || seen.has(selected.id) || !sha(selected.outputDigest) || !sha(selected.selectionDigest)) fail('Invalid or duplicate builder output declaration');
    seen.add(selected.id);
    const retained = record.builders.find(b => b.id === selected.id);
    if (!retained || selected.preparedDigest !== retained.preparedDigest) fail('Prepared builder identity mismatch');
    const path = join(root, rel(retained.control));
    const prepared = readRetainedCandidateEvidence(path, 'manifest', retained.preparedDigest, linked);
    const preparedSelection = readRetainedCandidateEvidence(path, 'selection', retained.preparedSelectionDigest, linked);
    ensureAllSelected(preparedSelection);
    if (!same(preparedSelection, config.selection) || !same(integrationProjection(prepared.manifest), canonical)) fail('Retained prepared baseline differs from freshly verified source');
    // Historical prepared worktrees have changed. Verify retained digest/marker,
    // exact selection, and content against the freshly reverified common source;
    // do not pretend the historical candidate equals the current builder output.
    const selection = readRetainedCandidateEvidence(path, 'selection', selected.selectionDigest, linked);
    ensureAllSelected(selection);
    const output = verifyCandidate(path, selection, selected.outputDigest, linked);
    // Reject unsupported/aliased output even if its changed paths are disjoint.
    integrationProjection(output.manifest);
    builders.push({ ...selected, prepared: prepared.manifest, output: output.manifest });
  }
  const projection = planDisjointIntegration(base.manifest, builders);
  checkBoundaries(inventoryCandidate(root, owner), controls, expected);
  return { ...context, projection, expected, request, base, targetExclusions: builders[0].output.exclusions };
}
function publicationBudget(root, task, context) {
  const { config, state, record, projection, request, targetExclusions } = context;
  const control = task + '-' + config.target, target = join(root, rel(control));
  const selection = { include: [...new Set([...projection.tree, ...projection.index, ...projection.worktree].map(e => e.path))].sort(), exclude: [] };
  const selectionDigest = hash(JSON.stringify(selection));
  const start = { op: 'start', expected: state.revision, slice: 'integrate', attempt: request.attempt, worker: 'manual-local-integrator', workspace: target, taskRef: JSON.stringify({ request, quiescence }) };
  // Target exclusions are exactly those of the freshly verified linked outputs:
  // same task/options, no nested controls. All remaining unknowns are 64 ASCII
  // hex characters. Double JSON escaping in the journal is checked by graph.
  const preview = integrationEvidence(target, pendingDigest, record.ownerDigest, pendingDigest, selectionDigest, request, targetExclusions);
  preflightGraphCommand(start);
  preflightGraphCommand({ op: 'prepare', expected: state.revision + 1, attempt: request.attempt, candidate: pendingDigest, evidence: pendingDigest, resultRef: JSON.stringify(preview) });
  return { control, target, selection, selectionDigest, start, preview };
}
export function planIntegration(project, task, request, options) {
  grant(options); const root = rootPath(project, task), context = verifiedPlan(root, task, request);
  publicationBudget(root, task, context);
  return { status: 'planned', ownerDigest: context.record.ownerDigest, quiescence: 'caller-declared-not-verified', ...context.projection };
}
function observeTarget(root, task, context, target, expectedDigest) {
  const observed = verifiedPlan(root, task, context.request, context.expected[task + '-' + context.config.target]);
  const selection = readRetainedCandidateEvidence(target, 'selection', context.targetSelectionDigest, context.linked);
  const current = verifyCandidate(target, selection, expectedDigest, context.linked);
  if (!same(integrationProjection(current.manifest), (({ changes, ...projection }) => projection)(observed.projection))) fail('Materialized target differs from planned projection');
  return current;
}
export function integrateBuilders(project, task, request, options, hooks = {}) {
  grant(options); const root = rootPath(project, task), context = verifiedPlan(root, task, request);
  const { state, record, projection, linked } = context;
  const { control, target, selection, selectionDigest, start, preview } = publicationBudget(root, task, context);
  absent(target); absent(join(root, '.git/worktrees', control));
  graph(root, task, 'apply', start);
  hooks.afterIntent?.();
  const changes = new Map(projection.changes.map(change => [change.path, change]));
  createProjectedWorktree(root, control, projection, entry => {
    const change = changes.get(entry.path), builder = record.builders.find(b => b.id === change?.builder);
    return readObservedFile(builder ? join(root, rel(builder.control)) : root, entry);
  }, hooks);
  context.expected[control] = identity(inventoryCandidate(root, context.owner), control);
  const captured = retainLinked(root, target, task, selection, linked); context.targetSelectionDigest = captured.selectionDigest;
  if (captured.selectionDigest !== selectionDigest || !same(captured.manifest.exclusions, preview.exclusions)) fail('Publication budget invariant changed');
  hooks.beforeVerification?.();
  observeTarget(root, task, context, target, captured.digest);
  hooks.beforePublication?.();
  observeTarget(root, task, context, target, captured.digest);
  const evidence = integrationEvidence(target, context.expected[control], record.ownerDigest, captured.digest, captured.selectionDigest, request, captured.manifest.exclusions);
  const resultRef = JSON.stringify(evidence), evidenceDigest = hash(resultRef);
  graph(root, task, 'apply', { op: 'prepare', expected: state.revision + 1, attempt: request.attempt, candidate: captured.digest, evidence: evidenceDigest, resultRef });
  return { status: 'verified-awaiting-acceptance', ...evidence, evidenceDigest, graphRevision: state.revision + 2 };
}
export function observeIntegration(project, task, options) {
  grant(options); const root = rootPath(project, task), state = graph(root, task), attempt = state.attempts.find(a => a.id === state.slices.find(s => s.id === 'integrate')?.latest);
  if (attempt?.status !== 'running' || !attempt.prepared) fail('No prepared integration to observe; inspect and reconcile interrupted attempts');
  const evidence = JSON.parse(attempt.prepared.resultRef);
  if (hash(attempt.prepared.resultRef) !== attempt.prepared.evidence || evidence.candidate !== attempt.prepared.candidate) fail('Prepared integration evidence mismatch');
  const context = verifiedPlan(root, task, evidence.request, evidence.identity);
  if (evidence.target !== join(root, rel(task + '-' + context.config.target))) fail('Prepared target path mismatch');
  context.targetSelectionDigest = evidence.selectionDigest;
  observeTarget(root, task, context, evidence.target, evidence.candidate);
  return { status: 'verified-awaiting-acceptance', ...evidence, evidenceDigest: attempt.prepared.evidence, graphRevision: state.revision };
}
export function inspectIntegration(project, task, options) {
  grant(options); return graph(rootPath(project, task), task);
}
export function reconcileIntegration(project, task, request, options) {
  grant(options); const root = rootPath(project, task);
  if (!exact(request, ['attempt', 'expectedRevision', 'outcome', 'note'])) fail('Explicit attempt, expectedRevision, failed|abandoned outcome and inspection note required');
  return graph(root, task, 'apply', { op: 'reconcile', expected: request.expectedRevision, attempt: request.attempt, outcome: request.outcome, note: request.note });
}

if (typeof import.meta.main !== 'boolean') throw Error('Node.js with import.meta.main support required');
if (import.meta.main) {
  try {
    const [project, action, task, ...args] = process.argv.slice(2), options = {};
    const values = [];
    for (const arg of args) {
      if (arg === '--authorize-local-integration' && !options.authorizeLocalIntegration) options.authorizeLocalIntegration = true;
      else if (arg === '--declare-inputs-quiescent' && !options.inputsQuiescent) options.inputsQuiescent = true;
      else values.push(arg);
    }
    grant(options);
    const noValue = ['inspect', 'observe'].includes(action);
    if (values.length !== (noValue ? 0 : 1)) fail('Usage: addy-integrate.mjs PROJECT prepare|output|plan|integrate|inspect|observe|reconcile TASK [JSON] --authorize-local-integration --declare-inputs-quiescent');
    const request = noValue ? undefined : JSON.parse(values[0]);
    const operations = { prepare: prepareIntegration, output: captureBuilderOutput, plan: planIntegration, integrate: integrateBuilders, reconcile: reconcileIntegration };
    const result = action === 'inspect' ? inspectIntegration(project, task, options) : action === 'observe' ? observeIntegration(project, task, options) :
      operations[action] ? operations[action](project, task, request, options) : fail('Unknown integration operation');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) { console.error('addy-integrate:', error.message); process.exitCode = 1; }
}
