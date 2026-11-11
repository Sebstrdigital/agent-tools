import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';
import { initSyntheticGit } from './fixtures/synthetic-git.mjs';

const root = fileURLToPath(new URL('../', import.meta.url)), suite = join(root, '.agent-work/integration-tests'); mkdirSync(suite, { recursive: true });
const cli = join(root, 'scripts/addy-integrate.mjs'), flags = ['--authorize-local-integration', '--declare-inputs-quiescent'];
const version = spawnSync('/usr/bin/git', ['--version'], { encoding: 'utf8' });
const supported = process.platform === 'darwin' && version.status === 0 && version.stdout.trim() === 'git version 2.54.0 (Apple Git-157)';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
test('real normal CLI termination retains a partially published target; inspect/reconcile never replay or delete', { skip: supported ? false : 'Requires tested Darwin / Apple Git runtime' }, async () => {
  const parent = mkdtempSync(join(suite, 'cli-interruption-')), repo = join(parent, 'repo'); mkdirSync(repo);
  const env = { PATH: '/usr/bin:/bin', HOME: parent, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' };
  initSyntheticGit(repo, env); writeFileSync(join(repo, 'README.md'), 'synthetic dirty CLI baseline\n');
  const command = (action, value) => {
    const result = spawnSync(process.execPath, [cli, repo, action, 'task', ...(value === undefined ? [] : [JSON.stringify(value)]), ...flags], { env, encoding: 'utf8', timeout: 120000 });
    assert.equal(result.status, 0, result.stderr); return JSON.parse(result.stdout);
  };
  const selection = { include: ['.gitignore', 'PLAN.md', 'README.md', 'docs/roles-library.md'], exclude: [] };
  const prepared = command('prepare', { builders: ['one', 'two', 'three'], target: 'combined', excludedPrefixes: [], selection });
  const paths = ['README.md', 'PLAN.md', 'docs/roles-library.md'];
  const request = { attempt: 'real-interruption', builders: prepared.workspaces.map((b, i) => {
    writeFileSync(join(b.path, paths[i]), 'synthetic CLI builder ' + b.id + '\n');
    return { ...command('output', { builder: b.id, selection }), paths: [paths[i]] };
  }) };
  const before = { sourceIndex: hash(readFileSync(join(repo, '.git/index'))), source: hash(readFileSync(join(repo, 'README.md'))), builders: prepared.workspaces.map(b => hash(readFileSync(join(b.path, paths[prepared.workspaces.indexOf(b)])))) };
  const target = join(repo, '.agent-work/linked-worktrees/task-combined'), marker = join(target, '.agent-work/addy-coordination/task/selection.json');
  const child = spawn(process.execPath, [cli, repo, 'integrate', 'task', JSON.stringify(request), ...flags], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '', stderr = '', closed = false;
  child.stdout.on('data', bytes => { stdout += bytes; }); child.stderr.on('data', bytes => { stderr += bytes; });
  const ended = new Promise((resolve, reject) => { child.once('error', reject); child.once('close', (code, signal) => { closed = true; resolve({ code, signal }); }); });
  const deadline = Date.now() + 90000;
  while (!existsSync(marker) && !closed && Date.now() < deadline) await delay(10);
  const reached = existsSync(marker);
  // Terminate only this task-owned child. No unrelated app/process is touched.
  if (!closed) child.kill('SIGTERM');
  const termination = await ended;
  assert.ok(reached, 'CLI never reached materialized target: ' + stderr);
  assert.equal(termination.signal, 'SIGTERM');
  const state = command('inspect'); assert.equal(state.revision, 3); assert.equal(state.attempts.at(-1).status, 'running'); assert.equal(state.attempts.at(-1).prepared, undefined);
  const targetBytes = readFileSync(join(target, 'README.md'));
  command('reconcile', { attempt: 'real-interruption', expectedRevision: 3, outcome: 'abandoned', note: 'Synthetic operator inspected SIGTERM interruption. Preserve all target content; no replay or cleanup.' });
  assert.equal(command('inspect').attempts.at(-1).status, 'abandoned'); assert.deepEqual(readFileSync(join(target, 'README.md')), targetBytes);
  const retry = spawnSync(process.execPath, [cli, repo, 'integrate', 'task', JSON.stringify(request), ...flags], { env, encoding: 'utf8' });
  assert.notEqual(retry.status, 0); assert.match(retry.stderr, /boundary|exists/i);
  const after = { sourceIndex: hash(readFileSync(join(repo, '.git/index'))), source: hash(readFileSync(join(repo, 'README.md'))), builders: prepared.workspaces.map(b => hash(readFileSync(join(b.path, paths[prepared.workspaces.indexOf(b)])))) };
  assert.deepEqual(after, before);
  writeFileSync(join(parent, 'evidence.json'), JSON.stringify({ repo, request, before, after, termination, state, stdout, stderr, retry: { status: retry.status, stderr: retry.stderr } }, null, 2));
  console.log('Synthetic CLI SIGTERM evidence: ' + join(parent, 'evidence.json'));
});
