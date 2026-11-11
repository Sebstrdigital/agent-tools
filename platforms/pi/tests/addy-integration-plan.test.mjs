import assert from 'node:assert/strict';
import { test } from 'node:test';
import { planDisjointIntegration } from '../scripts/addy-integration-plan.mjs';

const digest = letter => letter.repeat(64);
const oid = letter => letter.repeat(40);
const index = (path, marker, mode = '100644') => ({ path, mode, oid: oid(marker), size: 1, sha256: digest(marker) });
const file = (path, marker, mode = 0o644) => ({ path, kind: 'file', mode, size: 1, sha256: digest(marker) });
const manifest = (indexEntries, worktree) => ({ head: oid('a'), tree: [index('tracked', 'a')], index: indexEntries, worktree, excludedPaths: [], excludedPrefixes: ['excluded'] });
const base = () => manifest([index('tracked', 'b')], [file('tracked', 'c'), file('baseline-untracked', 'd')]);
const builder = (id, paths, output) => ({ id, paths, dependencies: [], preparedDigest: digest('e'), outputDigest: digest('f'), prepared: base(), output });

test('three independent outputs preserve dirty baseline and combine staged, worktree, new and deleted paths', () => {
  const a = base(); a.index = [index('tracked', '1', '100755')]; a.worktree = [file('tracked', '2', 0o755), file('baseline-untracked', 'd')];
  const b = base(); b.worktree = [file('tracked', 'c')];
  const c = base(); c.index.push(index('new', '3')); c.worktree.push(file('new', '4'));
  const result = planDisjointIntegration(base(), [builder('a', ['tracked'], a), builder('b', ['baseline-untracked'], b), builder('c', ['new'], c)]);
  assert.deepEqual(result.changes.map(x => x.path), ['baseline-untracked', 'new', 'tracked']);
  assert.equal(result.index.find(x => x.path === 'tracked').mode, '100755');
  assert.equal(result.index.find(x => x.path === 'new').sha256, digest('3'));
  assert.equal(result.worktree.find(x => x.path === 'new').sha256, digest('4'));
  assert.equal(result.worktree.some(x => x.path === 'baseline-untracked'), false);
});

test('overlaps, undeclared changes, stale prepared baselines and nonempty dependencies fail closed', () => {
  const one = base(); one.worktree[0] = file('tracked', '1');
  assert.throws(() => planDisjointIntegration(base(), [builder('a', [], one)]), /Undeclared/);
  assert.throws(() => planDisjointIntegration(base(), [builder('a', ['tracked'], one), builder('b', ['tracked'], one)]), /Overlapping/);
  const stale = builder('a', ['tracked'], one); stale.prepared.index[0] = index('tracked', '2');
  assert.throws(() => planDisjointIntegration(base(), [stale]), /Prepared baseline/);
  const dependent = builder('a', ['tracked'], one); dependent.dependencies = [{ id: 'other', digest: digest('d') }];
  assert.throws(() => planDisjointIntegration(base(), [dependent]), /dependencies/);
});

test('rejects symlinks, excluded paths, path aliases and unsupported modes', () => {
  const symlink = base(); symlink.worktree[0] = { path: 'tracked', kind: 'symlink', mode: 0o777, targetBase64: 'eA==' };
  assert.throws(() => planDisjointIntegration(base(), [builder('a', ['tracked'], symlink)]), /Unsupported/);
  const excluded = base(); excluded.worktree.push(file('excluded/private', '1'));
  assert.throws(() => planDisjointIntegration(base(), [builder('a', ['excluded/private'], excluded)]), /excluded prefix/);
  const alias = base(); alias.worktree.push(file('TRACKED', '1'));
  assert.throws(() => planDisjointIntegration(base(), [builder('a', ['TRACKED'], alias)]), /aliased/);
  const mode = base(); mode.index[0] = index('tracked', '1', '120000');
  assert.throws(() => planDisjointIntegration(base(), [builder('a', ['tracked'], mode)]), /Unsupported/);
});
