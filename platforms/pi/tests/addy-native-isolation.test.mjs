import assert from 'node:assert/strict';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = join(root, 'tests/fixtures/addy-dirfd-probe.c');
const graph = join(root, 'scripts/addy-graph.mjs');
const fixture = () => { const workspace = join(root, '.agent-work/parallel-addy'); mkdirSync(workspace, { recursive: true }); return mkdtempSync(join(workspace, 'native-isolation-')); };
const environment = home => ({ PATH: '/usr/bin:/bin', HOME: home, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' });
function compile(dir, t) {
  const bin = join(dir, 'dirfd-probe');
  const check = spawnSync('clang', ['--version'], { encoding: 'utf8' });
  if (check.error?.code === 'ENOENT') { t.skip('Native compiler unavailable; no install attempted'); return null; }
  const feature = process.platform === 'darwin' ? '-D_DARWIN_C_SOURCE' : '-D_POSIX_C_SOURCE=200809L';
  const r = spawnSync('clang', ['-std=c11', '-Wall', '-Wextra', '-Werror', feature, source, '-o', bin], { encoding: 'utf8', timeout: 30000, env: { ...environment(dir), TMPDIR: dir } });
  assert.equal(r.status, 0, r.stderr); return bin;
}
async function synchronized(command, args, env, onReady) {
  const child = spawn(command, args, { env, stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '', stderr = '', swapped = false;
  child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
  child.stdout.on('data', data => { stdout += data; if (!swapped && stdout.includes('READY\n')) { swapped = true; onReady(); child.stdin.end('x'); } });
  child.stderr.on('data', data => { stderr += data; });
  const outcome = await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', (status, signal) => resolve({ status, signal })); });
  return { ...outcome, stdout, stderr, swapped };
}

for (const mode of ['anchored', 'reject', 'root-swap']) test(`native dirfd research fixture handles ${mode} without outside data access`, async t => {
  const dir = fixture(), bin = compile(dir, t); if (!bin) return;
  const project = join(dir, 'project'), outside = join(dir, 'outside'); mkdirSync(project); mkdirSync(outside);
  mkdirSync(join(project, 'source')); mkdirSync(join(project, 'target'));
  writeFileSync(join(project, 'source', 'data'), 'approved'); writeFileSync(join(outside, 'data'), 'external secret fixture');
  const result = await synchronized(bin, [mode === 'root-swap' ? 'anchored' : mode, project], environment(dir), () => {
    if (mode === 'root-swap') { renameSync(project, project + '-retained'); symlinkSync(outside, project); }
    else {
      renameSync(join(project, 'source'), join(project, 'source-retained')); renameSync(join(project, 'target'), join(project, 'target-retained'));
      symlinkSync(outside, join(project, 'source')); symlinkSync(outside, join(project, 'target'));
    }
  });
  writeFileSync(join(dir, 'probe-result.json'), JSON.stringify(result, null, 2) + '\n'); t.diagnostic('Retained native fixture: ' + dir);
  assert.equal(result.status, 0, result.stderr); assert.equal(result.swapped, true);
  const actual = JSON.parse(result.stdout.slice(result.stdout.indexOf('READY\n') + 6));
  if (mode === 'reject') assert.deepEqual(actual, { sourceOpened: false, targetOpened: false, read: -1, write: -1 });
  else {
    assert.deepEqual(actual, { sourceOpened: true, targetOpened: true, read: 0, write: 0 });
    assert.equal(readFileSync(join(mode === 'root-swap' ? project + '-retained/target' : project + '/target-retained', 'created'), 'utf8'), 'synthetic');
  }
  assert.deepEqual(readdirSync(outside), ['data']); assert.equal(readFileSync(join(outside, 'data'), 'utf8'), 'external secret fixture');
});

for (const isolation of ['native-only', 'fixture-deny', 'global-sandbox']) test(`${isolation} subprocess probes actual Git and graph operations after a target-parent swap`, async t => {
  if (isolation !== 'native-only' && (process.platform !== 'darwin' || !existsSync('/usr/bin/sandbox-exec'))) { t.skip('macOS sandbox-exec unavailable'); return; }
  if (isolation === 'global-sandbox' && process.env.ADDY_EXPERIMENT_GLOBAL_DENY !== '1') { t.skip('Unproven global sandbox aborts before normal execution; explicit experiment opt-in required'); return; }
  const dir = fixture(), bin = compile(dir, t); if (!bin) return;
  const repo = join(dir, 'repo'), outside = join(dir, 'outside'); mkdirSync(repo); mkdirSync(outside);
  mkdirSync(join(repo, 'target')); mkdirSync(join(repo, 'target/checkout')); mkdirSync(join(repo, 'target/graph')); writeFileSync(join(repo, 'target/data'), 'approved fixture');
  mkdirSync(join(outside, 'checkout')); mkdirSync(join(outside, 'graph')); writeFileSync(join(outside, 'data'), 'unapproved synthetic'); writeFileSync(join(outside, 'sentinel'), 'outside synthetic');
  const env = environment(dir);
  const git = (cwd, ...args) => execFileSync('git', ['-c', 'core.hooksPath=/dev/null', '-C', cwd, ...args], { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git(repo, 'init', '-q', '--template=');
  const object = (args, input) => execFileSync('git', ['-C', repo, ...args], { env, input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  const blob = object(['hash-object', '-w', '--stdin'], 'synthetic readme\n');
  const tree = object(['mktree'], `100644 blob ${blob}\tREADME.md\n`);
  // A detached tree is sufficient for read-tree; no commit or project data is used.
  writeFileSync(join(repo, '.git/HEAD'), tree + '\n'); git(repo, 'read-tree', 'HEAD');
  const q = x => JSON.stringify(x), runtime = dirname(dirname(process.execPath)), target = join(repo, 'target');
  const profile = isolation === 'fixture-deny' ? `(version 1)(allow default)(deny file-read-data file-write* (subpath ${q(outside)}))` :
    `(version 1)(allow default)(deny file-read-data file-write* (regex #"^/"))` +
    `(allow file-read-data (subpath "/System") (subpath "/usr") (subpath "/Library") (subpath "/private/var/db") (subpath "/private/etc") (subpath "/dev") (subpath ${q(runtime)}) (literal ${q(bin)}) (literal ${q(graph)}) (literal ${q(repo)}) (subpath ${q(join(repo, '.git'))}))` +
    `(allow file-read-data file-write* (subpath ${q(target)}))`;
  writeFileSync(join(dir, 'profile.sb'), profile);
  const command = isolation === 'native-only' ? bin : '/usr/bin/sandbox-exec';
  const args = isolation === 'native-only' ? ['git', repo, target, process.execPath, graph, dir] : ['-p', profile, bin, 'git', repo, target, process.execPath, graph, dir];
  const result = await synchronized(command, args, env, () => { renameSync(target, target + '-retained'); symlinkSync(outside, target); });
  writeFileSync(join(dir, 'probe-result.json'), JSON.stringify(result, null, 2) + '\n'); t.diagnostic('Retained native subprocess fixture: ' + dir);
  if (isolation === 'global-sandbox' && result.status === null && result.signal === 'SIGABRT' && !result.swapped) {
    assert.deepEqual(readdirSync(outside).sort(), ['checkout', 'data', 'graph', 'sentinel']);
    t.skip('Global read/write deny aborts native program before the normal path; no confinement claim'); return;
  }
  assert.equal(result.status, 0, result.stderr); assert.equal(result.swapped, true);
  const actual = JSON.parse(result.stdout.slice(result.stdout.indexOf('READY\n') + 6));
  assert.equal(readFileSync(join(outside, 'data'), 'utf8'), 'unapproved synthetic');
  assert.equal(readFileSync(join(outside, 'sentinel'), 'utf8'), 'outside synthetic');
  if (isolation === 'native-only') {
    for (const key of ['normalHash', 'normalIndex', 'normalCheckout', 'normalGraph', 'swappedHash', 'swappedIndex', 'swappedCheckout', 'swappedGraph']) assert.equal(actual[key], 0, key + ': ' + result.stderr);
    assert.ok(readdirSync(outside).includes('index')); assert.ok(readdirSync(join(outside, 'checkout')).includes('README.md'));
    assert.deepEqual(readdirSync(join(outside, 'graph', 'graph')), ['00000000.json']);
  } else {
    assert.deepEqual(readdirSync(outside).sort(), ['checkout', 'data', 'graph', 'sentinel']);
    assert.deepEqual(readdirSync(join(outside, 'checkout')), []); assert.deepEqual(readdirSync(join(outside, 'graph')), []);
    assert.notEqual(actual.swappedHash, 0); assert.notEqual(actual.swappedIndex, 0); assert.notEqual(actual.swappedCheckout, 0); assert.notEqual(actual.swappedGraph, 0);
    if (isolation === 'fixture-deny') {
      for (const key of ['normalHash', 'normalIndex', 'normalCheckout', 'normalGraph']) assert.equal(actual[key], 0, key + ': ' + result.stderr);
    } else if (actual.normalHash !== 0 || actual.normalIndex !== 0 || actual.normalCheckout !== 0 || actual.normalGraph !== 0) {
      t.skip('Restrictive profile does not support the complete normal Git/graph path; no safe-transfer claim'); return;
    }
  }
});
