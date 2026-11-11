import assert from 'node:assert/strict';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const graph = join(root, 'scripts/addy-graph.mjs');

function initSyntheticTree(repo, env) {
  const git = (args, input) => execFileSync('git', ['-C', repo, ...args], { env, input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  git(['init', '-q', '--template=']);
  const blob = git(['hash-object', '-w', '--stdin'], 'synthetic sandbox fixture\n');
  const tree = git(['mktree'], `100644 blob ${blob}\tREADME.md\n`);
  writeFileSync(join(repo, '.git/HEAD'), tree + '\n');
  git(['read-tree', 'HEAD']); git(['checkout-index', '-a']);
}

for (const policyMode of ['fixture-deny', 'global-default-deny']) test(`${policyMode} macOS profile tests real Git and graph across an externally timed parent swap`, async t => {
  if (process.platform !== 'darwin' || !existsSync('/usr/bin/sandbox-exec')) { t.skip('macOS sandbox-exec unavailable'); return; }
  if (policyMode === 'global-default-deny' && process.env.ADDY_EXPERIMENT_GLOBAL_DENY !== '1') { t.skip('Unproven restrictive profile aborts Node; explicit experiment opt-in required'); return; }
  const fixture = mkdtempSync(join(root, '.agent-work/parallel-addy/sandbox-narrow-'));
  const foreign = mkdtempSync(join(root, '.agent-work/parallel-addy/sandbox-foreign-'));
  const repo = join(fixture, 'repo'), outside = join(fixture, 'outside'), privateSibling = join(repo, 'unapproved-fixture');
  mkdirSync(repo); mkdirSync(outside); mkdirSync(privateSibling);
  writeFileSync(join(outside, 'secret'), 'outside fixture'); writeFileSync(join(privateSibling, 'secret'), 'unapproved fixture'); writeFileSync(join(foreign, 'secret'), 'foreign synthetic fixture');
  const env = { PATH: '/usr/bin:/bin', HOME: fixture, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' };
  initSyntheticTree(repo, env);
  for (const name of ['source', 'target', 'graph-workspace', 'checkout']) mkdirSync(join(repo, name));
  writeFileSync(join(repo, 'source', 'sample'), 'approved fixture');
  const probe = join(root, '.agent-work/parallel-addy/sandbox-narrow-probe-' + Date.now() + '-' + Math.random().toString(16).slice(2) + '.mjs');
  writeFileSync(probe, `
    import fs from 'node:fs'; import {spawnSync} from 'node:child_process'; import {join} from 'node:path';
    const [fixture,repo,graph]=process.argv.slice(2), out={};
    const invoke=(program,args,opts={})=>{const r=spawnSync(program,args,{encoding:'utf8',...opts});return {status:r.status,stderr:r.stderr,error:r.error?.code};};
    const denied=fn=>{try{fn();return 'ALLOWED'}catch(e){return e.code}};
    out.normalSource=fs.readFileSync(join(repo,'source/sample'),'utf8');fs.writeFileSync(join(repo,'target/normal'),'normal');
    const gitEnv={...process.env,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null',GIT_INDEX_FILE:join(repo,'target/index')};
    out.normalIndex=invoke('git',['-C',repo,'read-tree','HEAD'],{env:gitEnv});
    out.normalCheckout=invoke('git',['-C',repo,'--work-tree',join(repo,'checkout'),'checkout-index','-a'],{env:gitEnv});
    const init=JSON.stringify({op:'init',baseline:'a'.repeat(64),baselineRef:'synthetic',slices:[{id:'slice',depends:[]}]});
    out.normalGraph=invoke(process.execPath,[graph,fixture,join(repo,'graph-workspace'),'normal','init',init]);
    process.stdout.write('READY\\n'); await new Promise(resolve=>process.stdin.once('data',resolve));
    out.swappedRead=denied(()=>fs.readFileSync(join(repo,'source/secret'),'utf8'));
    out.swappedWrite=denied(()=>fs.writeFileSync(join(repo,'target/escaped'),'synthetic'));
    out.swappedIndex=invoke('git',['-C',repo,'read-tree','HEAD'],{env:{...gitEnv,GIT_INDEX_FILE:join(repo,'target/index')}});
    out.swappedCheckout=invoke('git',['-C',repo,'--work-tree',join(repo,'target'),'checkout-index','-a'],{env:{...gitEnv,GIT_INDEX_FILE:join(repo,'.git/index')}});
    out.swappedGraph=invoke(process.execPath,[graph,fixture,join(repo,'graph-workspace'),'escaped-graph','init',init]);
    process.stdout.write('BLOCKED\\n'); await new Promise(resolve=>process.stdin.once('data',resolve));
    out.foreignRead=denied(()=>fs.readFileSync(join(repo,'source/secret'),'utf8'));
    out.foreignWrite=denied(()=>fs.writeFileSync(join(repo,'target/escaped'),'synthetic'));
    console.log(JSON.stringify(out));
  `);
  const path = x => JSON.stringify(x);
  const runtime = policyMode === 'fixture-deny' ? `(allow default)(deny file-read-data file-write* (subpath ${path(fixture)}))` :
    `(allow default)(deny file-read-data file-write* (regex #"^/"))` +
    `(allow file-read-data (subpath "/System") (subpath "/usr") (subpath "/Library") (subpath "/private/var/db") (subpath "/private/etc") (subpath "/dev") (subpath ${path(dirname(dirname(process.execPath)))}) (literal ${path(probe)}) (literal ${path(graph)}))`;
  const profile = `(version 1)` + runtime +
    `(allow file-read-data (literal ${path(repo)}) (subpath ${path(join(repo, '.git'))}) (subpath ${path(join(repo, 'source'))}))` +
    `(allow file-read-data file-write* (subpath ${path(join(repo, 'target'))}) (subpath ${path(join(repo, 'graph-workspace'))}) (subpath ${path(join(repo, 'checkout'))}))`;
  // Profile compilation sees the original directories; the unconfined synthetic actor swaps them after READY.
  writeFileSync(join(fixture, 'profile.sb'), profile);
  const child = spawn('/usr/bin/sandbox-exec', ['-p', profile, process.execPath, probe, fixture, repo, graph], { encoding: 'utf8', env, stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '', stderr = '', swapped = false, foreignSwapped = false;
  child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
  child.stdout.on('data', data => {
    stdout += data;
    if (!swapped && stdout.includes('READY\n')) {
      swapped = true;
      for (const name of ['source', 'target', 'graph-workspace']) renameSync(join(repo, name), join(repo, name + '-retained'));
      symlinkSync(privateSibling, join(repo, 'source')); symlinkSync(privateSibling, join(repo, 'target')); symlinkSync(outside, join(repo, 'graph-workspace'));
      child.stdin.write('continue\n');
    }
    if (!foreignSwapped && stdout.includes('BLOCKED\n')) {
      foreignSwapped = true;
      renameSync(join(repo, 'source'), join(repo, 'source-link-retained')); renameSync(join(repo, 'target'), join(repo, 'target-link-retained'));
      symlinkSync(foreign, join(repo, 'source')); symlinkSync(foreign, join(repo, 'target')); child.stdin.end('continue\n');
    }
  });
  child.stderr.on('data', data => { stderr += data; });
  const closed = await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', (status, signal) => resolve({ status, signal })); });
  writeFileSync(join(fixture, 'launch-result.json'), JSON.stringify({ ...closed, stdout, stderr }, null, 2) + '\n');
  t.diagnostic('Retained sandbox launch evidence: ' + fixture);
  if (policyMode === 'global-default-deny' && closed.status === null && closed.signal === 'SIGABRT') {
    t.skip('Global read/write deny profile aborts Node before the supported path; no confinement claim'); return;
  }
  assert.equal(closed.status, 0, JSON.stringify(closed) + ' ' + stderr); assert.equal(swapped, true); assert.equal(foreignSwapped, true);
  const actual = JSON.parse(stdout.slice(stdout.indexOf('BLOCKED\n') + 8));
  writeFileSync(join(fixture, 'probe-result.json'), JSON.stringify(actual, null, 2) + '\n'); t.diagnostic('Retained narrow sandbox evidence: ' + fixture);
  assert.equal(actual.normalSource, 'approved fixture');
  for (const key of ['normalIndex', 'normalCheckout', 'normalGraph']) assert.equal(actual[key].status, 0, key + ': ' + JSON.stringify(actual[key]));
  assert.match(actual.swappedRead, /^(EPERM|EACCES)$/); assert.match(actual.swappedWrite, /^(EPERM|EACCES)$/);
  for (const key of ['swappedIndex', 'swappedCheckout', 'swappedGraph']) assert.notEqual(actual[key].status, 0, key + ': ' + JSON.stringify(actual[key]));
  assert.deepEqual(readdirSync(privateSibling), ['secret']); assert.deepEqual(readdirSync(outside), ['secret']);
  if (policyMode === 'fixture-deny') {
    assert.equal(actual.foreignRead, 'ALLOWED'); assert.equal(actual.foreignWrite, 'ALLOWED'); assert.equal(readFileSync(join(foreign, 'escaped'), 'utf8'), 'synthetic');
  } else {
    assert.match(actual.foreignRead, /^(EPERM|EACCES)$/); assert.match(actual.foreignWrite, /^(EPERM|EACCES)$/);
    assert.deepEqual(readdirSync(foreign), ['secret']);
  }
  t.diagnostic('Retained foreign synthetic fixture: ' + foreign);
});

test('macOS sandbox denies specified external parent swaps but coarse project scope exposes an excluded sibling', t => {
  if (process.platform !== 'darwin' || !existsSync('/usr/bin/sandbox-exec')) { t.skip('macOS sandbox-exec unavailable'); return; }
  const fixture = mkdtempSync(join(root, '.agent-work/parallel-addy/sandbox-isolation-'));
  const repo = join(fixture, 'repo'), outside = join(fixture, 'outside'), privateSibling = join(repo, 'unapproved-fixture');
  mkdirSync(repo); mkdirSync(outside); mkdirSync(privateSibling);
  writeFileSync(join(outside, 'secret'), 'external fixture'); writeFileSync(join(privateSibling, 'secret'), 'unapproved fixture');
  const env = { PATH: '/usr/bin:/bin', HOME: fixture, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' };
  initSyntheticTree(repo, env);
  for (const name of ['source', 'target', 'graph-workspace', 'checkout']) mkdirSync(join(repo, name));
  writeFileSync(join(repo, 'source', 'sample'), 'approved fixture');
  const probe = join(fixture, 'probe.mjs');
  writeFileSync(probe, `
    import fs from 'node:fs'; import {spawnSync} from 'node:child_process'; import {join} from 'node:path';
    const [fixture,repo,outside,privateSibling,graph]=process.argv.slice(2), out={};
    const invoke=(program,args,opts={})=>{const r=spawnSync(program,args,{encoding:'utf8',...opts}); return {status:r.status,stderr:r.stderr,error:r.error?.code};};
    const denied=fn=>{try{fn();return 'ALLOWED'}catch(e){return e.code}};
    out.normalSource=fs.readFileSync(join(repo,'source/sample'),'utf8');
    fs.writeFileSync(join(repo,'target/normal'),'normal');
    const gitEnv={...process.env,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null',GIT_INDEX_FILE:join(repo,'target/index')};
    out.normalIndex=invoke('git',['-C',repo,'read-tree','HEAD'],{env:gitEnv});
    out.normalCheckout=invoke('git',['-C',repo,'--work-tree',join(repo,'checkout'),'checkout-index','-a'],{env:gitEnv});
    const init=JSON.stringify({op:'init',baseline:'a'.repeat(64),baselineRef:'synthetic',slices:[{id:'slice',depends:[]}]});
    out.normalGraph=invoke(process.execPath,[graph,fixture,join(repo,'graph-workspace'),'normal','init',init]);
    fs.renameSync(join(repo,'source'),join(repo,'source-retained')); fs.symlinkSync(outside,join(repo,'source'));
    fs.renameSync(join(repo,'target'),join(repo,'target-retained')); fs.symlinkSync(outside,join(repo,'target'));
    fs.renameSync(join(repo,'graph-workspace'),join(repo,'graph-retained')); fs.symlinkSync(outside,join(repo,'graph-workspace'));
    out.swappedRead=denied(()=>fs.readFileSync(join(repo,'source/secret'),'utf8'));
    out.swappedWrite=denied(()=>fs.writeFileSync(join(repo,'target/escaped'),'no'));
    out.swappedIndex=invoke('git',['-C',repo,'read-tree','HEAD'],{env:{...gitEnv,GIT_INDEX_FILE:join(repo,'target/index')}});
    out.swappedCheckout=invoke('git',['-C',repo,'--work-tree',join(repo,'target'),'checkout-index','-a'],{env:{...gitEnv,GIT_INDEX_FILE:join(repo,'target-retained/index')}});
    out.swappedGraph=invoke(process.execPath,[graph,fixture,join(repo,'graph-workspace'),'escaped-graph','init',init]);
    fs.symlinkSync(privateSibling,join(repo,'sibling-source')); fs.symlinkSync(privateSibling,join(repo,'sibling-target'));
    out.coarseSiblingRead=denied(()=>fs.readFileSync(join(repo,'sibling-source/secret'),'utf8'));
    out.coarseSiblingWrite=denied(()=>fs.writeFileSync(join(repo,'sibling-target/escaped'),'synthetic only'));
    console.log(JSON.stringify(out));
  `);
  const profile = `(version 1)(allow default)(deny file-read-data file-write* (subpath ${JSON.stringify(outside)}))`;
  writeFileSync(join(fixture, 'profile.sb'), profile);
  const result = spawnSync('/usr/bin/sandbox-exec', ['-p', profile, process.execPath, probe, fixture, repo, outside, privateSibling, graph], { encoding: 'utf8', env, timeout: 30000 });
  assert.equal(result.status, 0, result.stderr); const actual = JSON.parse(result.stdout);
  writeFileSync(join(fixture, 'probe-result.json'), JSON.stringify(actual, null, 2) + '\n'); t.diagnostic('Retained synthetic sandbox evidence: ' + fixture);
  assert.equal(actual.normalSource, 'approved fixture'); assert.equal(actual.normalIndex.status, 0, actual.normalIndex.stderr);
  assert.equal(actual.normalCheckout.status, 0, actual.normalCheckout.stderr); assert.equal(actual.normalGraph.status, 0, actual.normalGraph.stderr);
  assert.match(actual.swappedRead, /^(EPERM|EACCES)$/); assert.match(actual.swappedWrite, /^(EPERM|EACCES)$/);
  for (const key of ['swappedIndex', 'swappedCheckout', 'swappedGraph']) assert.notEqual(actual[key].status, 0, key + ': ' + JSON.stringify(actual[key]));
  assert.deepEqual(readdirSync(outside), ['secret']); assert.equal(readFileSync(join(outside, 'secret'), 'utf8'), 'external fixture');
  assert.equal(actual.coarseSiblingRead, 'ALLOWED'); assert.equal(actual.coarseSiblingWrite, 'ALLOWED');
  assert.equal(readFileSync(join(privateSibling, 'escaped'), 'utf8'), 'synthetic only');
});
