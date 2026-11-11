import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { initCoordination } from '../scripts/addy-candidate.mjs';
import { initSyntheticGit } from './fixtures/synthetic-git.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const candidate = join(root, 'scripts/addy-candidate.mjs'), compare = join(root, 'scripts/addy-compare.mjs');
const url = pathToFileURL(candidate).href;
function fixture() {
  const parent = mkdtempSync(join(root, '.agent-work/parallel-addy/prefix-auth-')), repo = join(parent, 'repo'); mkdirSync(repo);
  const env = { PATH: '/usr/bin:/bin', HOME: parent, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' };
  const head = initSyntheticGit(repo, env), task = 'task', rel = '.agent-work/linked-worktrees/builder', linked = join(repo, rel);
  initCoordination(repo, task, { authorizeRepositoryControl: true, authorizeCoordinationArtifacts: true });
  execFileSync('/usr/bin/git', ['-c', 'core.hooksPath=/dev/null', '-C', repo, 'worktree', 'add', '--detach', '--no-checkout', linked, head], { env, stdio: 'pipe' });
  const selection = join(repo, '.agent-work/addy-coordination/task/selection.json'); writeFileSync(selection, JSON.stringify({ include: [], exclude: [] }));
  mkdirSync(join(repo, 'excluded')); writeFileSync(join(repo, 'excluded', 'selection.json'), JSON.stringify({ include: [], exclude: [] }));
  mkdirSync(join(repo, '!excluded')); symlinkSync(join(repo, 'excluded'), join(repo, 'alias-to-excluded'));
  const guard = join(parent, 'guard.mjs');
  writeFileSync(guard, `
    import fs from 'node:fs'; import cp from 'node:child_process'; import {syncBuiltinESMExports} from 'node:module'; import {resolve,sep} from 'node:path';
    const protectedPaths=JSON.parse(process.env.GUARD_PATHS), log=process.env.GUARD_LOG, write=fs.writeFileSync;
    const hit=(kind,p)=>{write(log,kind+' '+p+'\\n',{flag:'a'});throw Error('PROTECTED_ACCESS '+kind);};
    for(const key of ['openSync','readFileSync','lstatSync','statSync','readdirSync','realpathSync','readlinkSync','accessSync','opendirSync']) {
      const original=fs[key]; fs[key]=function(path,...rest) {
        if(typeof path==='string'||Buffer.isBuffer(path)) {const p=resolve(String(path));if(protectedPaths.some(x=>p===x||p.startsWith(x+sep))) hit(key,p);}
        return original.call(this,path,...rest);
      };
    }
    cp.spawnSync=function(){hit('spawnSync','git-or-child');}; syncBuiltinESMExports();
  `);
  const protectedPaths = [join(repo, '.agent-work/addy-coordination/task'), linked, join(repo, 'excluded'), join(repo, '!excluded')];
  return { parent, repo, linked, task, rel, env, selection, guard, protectedPaths };
}
function run(f, label, argv) {
  const log = join(f.parent, label + '.log');
  const env = { ...f.env, GUARD_PATHS: JSON.stringify(f.protectedPaths), GUARD_LOG: log };
  const result = spawnSync(process.execPath, ['--import', f.guard, ...argv], { cwd: f.repo, env, encoding: 'utf8' });
  assert.notEqual(result.status, 0, label + ': unexpectedly succeeded');
  assert.equal(existsSync(log), false, label + ': touched protected content or launched Git: ' + result.stderr);
  assert.doesNotMatch(result.stderr, /PROTECTED_ACCESS/, label);
  assert.match(result.stderr, /excluded.prefix|overlap|authorization|control|coordination|selection|symlink/i, label + ': ' + result.stderr);
}
const api = code => ['--input-type=module', '-e', `import * as c from ${JSON.stringify(url)}; ${code}`];

test('all API entry points reject overlap and missing authority before protected access', () => {
  const f = fixture(), a = { authorizeRepositoryControl: true, authorizeCoordinationArtifacts: true, authorizeNestedLinkedControls: true, coordination: f.task, nestedLinked: [{ path: f.rel, controlId: 'builder' }], authorizeExcludedPrefixes: true };
  const literal = x => JSON.stringify(x), empty = `{include:[],exclude:[]}`, digest = 'a'.repeat(64);
  for (const [kind, prefix] of [['coord', '.agent-work/addy-coordination/task'], ['ancestor', '.agent-work'], ['nested', f.rel]]) {
    const options = { ...a, excludedPrefixes: [prefix] };
    for (const [name, code] of [
      ['inventory', `c.inventoryCandidate(${literal(f.repo)},${literal(options)})`],
      ['capture', `c.captureCandidate(${literal(f.repo)},${empty},${literal(options)})`],
      ['retain-selection', `c.retainCandidateSelection(${literal(f.repo)},${empty},${literal(options)})`],
      ['capture-retained', `c.captureRetainedCandidate(${literal(f.repo)},${empty},${literal(options)})`],
      ['read-retained', `c.readRetainedCandidateEvidence(${literal(f.repo)},'manifest',${literal(digest)},${literal(options)})`],
      ['verify', `c.verifyCandidate(${literal(f.repo)},${empty},${literal(digest)},${literal(options)})`],
      ['init', `c.initCoordination(${literal(f.repo)},${literal(f.task)},${literal(options)})`],
    ]) run(f, kind + '-' + name, api(code));
  }
  const unauthorized = { ...a, authorizeExcludedPrefixes: false, excludedPrefixes: ['excluded'] };
  run(f, 'invalid-authority-verify', api(`c.verifyCandidate(${literal(f.repo)},${empty},${literal(digest)},${literal(unauthorized)})`));
  const multiple = { ...a, excludedPrefixes: ['!excluded', '.agent-work/addy-coordination/task'] };
  run(f, 'all-prefixes-validated-before-metadata', api(`c.inventoryCandidate(${literal(f.repo)},${literal(multiple)})`));
  const badCoord = { ...a, authorizeCoordinationArtifacts: false, excludedPrefixes: ['excluded'] };
  run(f, 'invalid-coordination-authority-verify', api(`c.verifyCandidate(${literal(f.repo)},${empty},${literal(digest)},${literal(badCoord)})`));
  const badNested = { ...a, authorizeNestedLinkedControls: false, excludedPrefixes: ['excluded'] };
  run(f, 'invalid-nested-authority-verify', api(`c.verifyCandidate(${literal(f.repo)},${empty},${literal(digest)},${literal(badNested)})`));
  const linkedAuth = { authorizeRepositoryControl: true, authorizeCoordinationArtifacts: true, authorizeLinkedControl: true };
  const request = { ownerProject: f.repo, linkedProject: f.linked, task: f.task, boundary: f.rel, controlId: 'builder', expectedControlIdentity: digest, ownerDigest: digest, linkedDigest: digest, ownerAuthorization: a, linkedAuthorization: linkedAuth };
  for (const [name, owner, linked] of [
    ['owner-coordinate', { ...a, excludedPrefixes: ['.agent-work/addy-coordination/task'] }, linkedAuth],
    ['owner-nested', { ...a, excludedPrefixes: [f.rel] }, linkedAuth],
    ['linked-coordinate', a, { ...linkedAuth, authorizeExcludedPrefixes: true, excludedPrefixes: ['.agent-work/addy-coordination'] }],
    ['linked-missing-authority', a, { ...linkedAuth, excludedPrefixes: ['safe'] }],
  ]) run(f, 'compare-' + name, api(`c.compareCandidates(${literal({ ...request, ownerAuthorization: owner, linkedAuthorization: linked })})`));
});

test('candidate and compare CLIs reject overlap before selection or nested-control reads', () => {
  const f = fixture(), digest = 'a'.repeat(64), common = ['--authorize-repository-control', '--authorize-coordination-artifacts', '--authorize-nested-linked-controls', '--nested-linked', f.rel + '=builder', '--authorize-excluded-prefixes', '--coordination', f.task];
  for (const [kind, prefix] of [['coord', '.agent-work/addy-coordination/task'], ['nested', f.rel]]) {
    const flags = [...common, '--exclude-prefix', prefix];
    for (const [action, rest] of [['inventory', []], ['capture', [f.selection]], ['verify', [f.selection, digest]], ['init-coordination', [f.task]]])
      run(f, 'cli-' + kind + '-' + action, [candidate, f.repo, ...flags, action, ...rest]);
    const auth = ['--authorize-owner-repository-control', '--authorize-owner-coordination-artifacts', '--authorize-owner-nested-linked-controls', '--authorize-linked-repository-control', '--authorize-linked-coordination-artifacts', '--authorize-linked-control', '--authorize-excluded-prefixes', '--exclude-prefix', prefix];
    run(f, 'compare-cli-' + kind, [compare, f.repo, f.linked, f.task, f.rel, 'builder', digest, digest, digest, ...auth]);
  }
  run(f, 'candidate-cli-no-prefix-authority', [candidate, f.repo, '--authorize-repository-control', '--authorize-coordination-artifacts', '--coordination', f.task, '--exclude-prefix', 'safe', 'verify', f.selection, digest]);
  const prefixFlags = ['--authorize-repository-control', '--authorize-excluded-prefixes', '--exclude-prefix', 'excluded'];
  run(f, 'candidate-cli-selection-in-excluded', [candidate, f.repo, ...prefixFlags, 'capture', join(f.repo, 'excluded/selection.json')]);
  run(f, 'candidate-cli-selection-alias-to-excluded', [candidate, f.repo, ...prefixFlags, 'verify', join(f.repo, 'alias-to-excluded/selection.json'), digest]);
  run(f, 'compare-cli-no-prefix-authority', [compare, f.repo, f.linked, f.task, f.rel, 'builder', digest, digest, digest, '--exclude-prefix', 'safe']);
});

test('guard detects protected file, nested control, and subprocess access (positive controls)', () => {
  const f = fixture();
  for (const [label, program] of [
    ['selection', `import {readFileSync} from 'node:fs'; readFileSync(${JSON.stringify(f.selection)})`],
    ['nested', `import {lstatSync} from 'node:fs'; lstatSync(${JSON.stringify(f.linked)})`],
    ['excluded', `import {readFileSync} from 'node:fs'; readFileSync(${JSON.stringify(join(f.repo, 'excluded/selection.json'))})`],
    ['subprocess', `import {spawnSync} from 'node:child_process'; spawnSync('/usr/bin/true')`],
  ]) {
    const log = join(f.parent, 'positive-' + label + '.log');
    const result = spawnSync(process.execPath, ['--import', f.guard, '--input-type=module', '-e', program], {
      cwd: f.repo, env: { ...f.env, GUARD_PATHS: JSON.stringify(f.protectedPaths), GUARD_LOG: log }, encoding: 'utf8',
    });
    assert.notEqual(result.status, 0, label); assert.equal(existsSync(log), true, label); assert.match(result.stderr, /PROTECTED_ACCESS/, label);
  }
});
