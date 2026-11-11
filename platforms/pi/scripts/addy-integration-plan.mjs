// Pure projection planner. The caller must independently authorize and freshly
// verify every input; this module does not read files, verify provenance, reserve
// resources, publish evidence or perform integration.
import { posix } from 'node:path';

const fail = message => { throw new Error(message); };
const sha = value => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(value);
const pathOK = path => typeof path === 'string' && path.length > 0 && !path.includes('\0') && !path.startsWith('/') && !path.includes('\\') && path.split('/').every(p => p && p !== '.' && p !== '..' && p.toLowerCase() !== '.git') && posix.normalize(path) === path;
const key = path => path.toLowerCase();
const overlaps = (a, b) => a === b || a.startsWith(b + '/') || b.startsWith(a + '/');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function mapEntries(entries, label, index = false) {
  if (!Array.isArray(entries)) fail('Invalid ' + label);
  const result = new Map();
  for (const entry of entries) {
    if (!entry || !pathOK(entry.path) || result.has(entry.path)) fail('Invalid or duplicate ' + label + ' path');
    if (index) {
      if (!['100644', '100755'].includes(entry.mode) || !/^[a-f0-9]{40}([a-f0-9]{24})?$/.test(entry.oid) || !sha(entry.sha256) || !Number.isSafeInteger(entry.size) || entry.size < 0) fail('Unsupported ' + label + ' entry');
      result.set(entry.path, { path: entry.path, mode: entry.mode, oid: entry.oid, size: entry.size, sha256: entry.sha256 });
    } else {
      if (entry.kind === 'missing') result.set(entry.path, null);
      else if (entry.kind === 'file' && Number.isSafeInteger(entry.mode) && entry.mode >= 0 && (entry.mode & ~0o777) === 0 && Number.isSafeInteger(entry.size) && entry.size >= 0 && sha(entry.sha256))
        result.set(entry.path, { path: entry.path, kind: 'file', mode: entry.mode, size: entry.size, sha256: entry.sha256 });
      else fail('Unsupported ' + label + ' entry');
    }
  }
  return result;
}
function projection(manifest) {
  if (!manifest || typeof manifest !== 'object' || !/^[a-f0-9]{40}([a-f0-9]{24})?$/.test(manifest.head) || !Array.isArray(manifest.excludedPaths) || manifest.excludedPaths.length || !Array.isArray(manifest.tree)) fail('Invalid candidate projection');
  const tree = mapEntries(manifest.tree, 'tree', true), index = mapEntries(manifest.index, 'index', true), worktree = mapEntries(manifest.worktree, 'worktree');
  const prefixes = manifest.excludedPrefixes ?? [];
  if (!Array.isArray(prefixes) || prefixes.some(p => !pathOK(p)) || new Set(prefixes.map(key)).size !== prefixes.length) fail('Invalid excluded prefixes');
  const all = new Set([...tree.keys(), ...index.keys(), ...worktree.keys()]);
  for (const path of all) if (prefixes.some(prefix => overlaps(key(path), key(prefix)))) fail('Selected path overlaps excluded prefix');
  for (const path of new Set([...tree.keys(), ...index.keys()])) if (!worktree.has(path)) fail('Tracked path missing from worktree observation');
  return { head: manifest.head, tree, index, worktree, prefixes };
}
function orderedMap(map) { return [...map.values()].sort((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path))); }
function workValue(p, path) { return p.worktree.get(path) ?? null; }
function indexValue(p, path) { return p.index.get(path) ?? null; }

/** Validated content-only view; missing worktree entries normalize to absence. */
export function integrationProjection(manifest) {
  const p = projection(manifest);
  const paths = [...new Set([...p.tree.keys(), ...p.index.keys(), ...p.worktree.keys()])];
  for (let i = 0; i < paths.length; i++) for (let j = 0; j < i; j++)
    if (overlaps(key(paths[i]), key(paths[j]))) fail('Projection contains aliased or overlapping paths');
  return { head: p.head, excludedPrefixes: p.prefixes, tree: orderedMap(p.tree), index: orderedMap(p.index),
    worktree: orderedMap(new Map([...p.worktree].filter(([, value]) => value))) };
}

/**
 * Plan disjoint outputs for independent builders sharing one projected baseline.
 * `builders` must contain explicit empty dependencies: dependent-builder
 * integration is intentionally unsupported. `paths` is the exact authorized
 * changed-path set, not an inferred permission. All supplied digests are
 * recorded identities, not authenticated provenance.
 */
export function planDisjointIntegration(baseManifest, builders) {
  const base = projection(baseManifest);
  if (!Array.isArray(builders) || !builders.length || builders.length > 32) fail('One to 32 builders required');
  const names = new Set(), claims = [], changes = [], indexes = new Map(base.index), worktrees = new Map(base.worktree);
  for (const builder of builders) {
    if (!builder || !id(builder.id) || names.has(builder.id) || !sha(builder.preparedDigest) || !sha(builder.outputDigest) || !Array.isArray(builder.dependencies) || builder.dependencies.length || !Array.isArray(builder.paths) || !builder.paths.every(pathOK) || new Set(builder.paths).size !== builder.paths.length) fail('Invalid builder identities, dependencies or authorized paths');
    names.add(builder.id);
    const prepared = projection(builder.prepared), output = projection(builder.output);
    if (base.head !== prepared.head || prepared.head !== output.head || !same(orderedMap(base.tree), orderedMap(prepared.tree)) || !same(orderedMap(prepared.tree), orderedMap(output.tree)) || !same(base.prefixes, prepared.prefixes) || !same(prepared.prefixes, output.prefixes)) fail('Incompatible HEAD, tree or exclusions');
    const basePaths = new Set([...base.index.keys(), ...base.worktree.keys(), ...prepared.index.keys(), ...prepared.worktree.keys()]);
    for (const path of basePaths) if (!same(indexValue(base, path), indexValue(prepared, path)) || !same(workValue(base, path), workValue(prepared, path))) fail('Prepared baseline differs from common baseline');
    const paths = new Set([...prepared.index.keys(), ...prepared.worktree.keys(), ...output.index.keys(), ...output.worktree.keys()]);
    const changed = [...paths].filter(path => !same(indexValue(prepared, path), indexValue(output, path)) || !same(workValue(prepared, path), workValue(output, path)));
    if (!same([...changed].sort(), [...builder.paths].sort())) fail('Undeclared or unchanged builder output path');
    for (const path of changed) {
      if (claims.some(claim => overlaps(key(claim.path), key(path)))) fail('Overlapping builder output paths');
      claims.push({ path, builder: builder.id });
      const index = indexValue(output, path), worktree = workValue(output, path);
      if (index) indexes.set(path, index); else indexes.delete(path);
      if (worktree) worktrees.set(path, worktree); else worktrees.delete(path);
      changes.push({ path, builder: builder.id, preparedDigest: builder.preparedDigest, outputDigest: builder.outputDigest, index, worktree });
    }
  }
  // No case-fold aliases or file/descendant collisions in the final projection.
  const finalPaths = [...new Set([...base.tree.keys(), ...indexes.keys(), ...worktrees.keys()])];
  for (let i = 0; i < finalPaths.length; i++) for (let j = 0; j < i; j++) {
    if (overlaps(key(finalPaths[i]), key(finalPaths[j]))) fail('Final projection contains aliased or overlapping paths');
  }
  changes.sort((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path)));
  return { head: base.head, excludedPrefixes: base.prefixes, tree: orderedMap(base.tree), index: orderedMap(indexes), worktree: orderedMap(new Map([...worktrees].filter(([, value]) => value))), changes };
}
