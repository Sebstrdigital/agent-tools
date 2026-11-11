import { lstat, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Read-only, explicit scope. No shell commands, recursive traversal or deletion.
export async function inspectCleanup(scope = {}, io = { lstat, readdir }) {
  const checks = [];
  const errorText = error => `${error.code ?? 'ERROR'}: ${error.message}`;
  let scans, removed, retained;
  try {
    const paths = value => {
      if (!Array.isArray(value) || value.some(p => typeof p !== 'string' || !p.trim()))
        throw new Error('Paths must be nonempty strings');
      return [...new Set(value.map(p => resolve(p)))];
    };
    scans = paths(scope.scans ?? []);
    removed = paths(scope.removed ?? []);
    if (!Array.isArray(scope.retained ?? [])) throw new Error('Retained items must be an array');
    retained = (scope.retained ?? []).map(item => {
      if (!item || typeof item.path !== 'string' || !item.path.trim() || typeof item.reason !== 'string' || !item.reason.trim())
        throw new Error('Each retained path needs a nonempty purpose');
      return { path: resolve(item.path), reason: item.reason.trim() };
    });
    if (!scans.length && !removed.length && !retained.length) throw new Error('Supply an explicit inventory scope');
    const seen = new Set();
    for (const item of retained) {
      if (seen.has(item.path) || removed.includes(item.path)) throw new Error(`Conflicting disposition: ${item.path}`);
      seen.add(item.path);
    }
  } catch (error) {
    return { status: 'error', checks: [{ kind: 'scope', status: 'error', error: errorText(error) }] };
  }

  const retentionChecks = [];
  const validRetained = new Set();
  for (const item of retained) {
    try {
      const stat = await io.lstat(item.path);
      if (stat.isSymbolicLink()) throw new Error('Retained symlink requires separate target verification');
      validRetained.add(item.path);
      retentionChecks.push({ kind: 'retained', ...item, status: 'retained' });
    } catch (error) {
      retentionChecks.push({ kind: 'retained', ...item, status: 'error', error: errorText(error) });
    }
  }
  for (const path of scans) {
    try {
      const stat = await io.lstat(path);
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('Scan must name an existing non-symlink directory');
      const entries = (await io.readdir(path)).map(name => resolve(path, name)).sort();
      const remaining = entries.filter(entry => !validRetained.has(entry));
      checks.push({ kind: 'scan', path, status: entries.length === 0 ? 'empty' : remaining.length ? 'remaining' : 'reconciled', entries, remaining });
    } catch (error) {
      checks.push({ kind: 'scan', path, status: 'error', error: errorText(error) });
    }
  }
  for (const path of removed) {
    try {
      await io.lstat(path); // A dangling symlink is still a remaining artifact.
      checks.push({ kind: 'removed', path, status: 'remaining' });
    } catch (error) {
      checks.push(error.code === 'ENOENT'
        ? { kind: 'removed', path, status: 'absent' }
        : { kind: 'removed', path, status: 'error', error: errorText(error) });
    }
  }
  checks.push(...retentionChecks);
  const status = checks.some(c => c.status === 'error') ? 'error'
    : checks.some(c => c.status === 'remaining') ? 'incomplete' : 'complete';
  return { status, checks };
}

function parseArgs(args) {
  const scope = { scans: [], removed: [], retained: [] };
  const value = () => {
    const next = args.shift();
    if (!next || next.startsWith('--')) throw new Error('Missing option value; use an absolute path for names beginning with --');
    return next;
  };
  while (args.length) {
    const flag = args.shift();
    if (flag === '--scan') scope.scans.push(value());
    else if (flag === '--removed') scope.removed.push(value());
    else if (flag === '--retained') scope.retained.push({ path: value(), reason: value() });
    else throw new Error(`Unknown option: ${flag}`);
  }
  return scope;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  let result;
  try { result = await inspectCleanup(parseArgs(process.argv.slice(2))); }
  catch (error) { result = { status: 'error', checks: [{ kind: 'scope', status: 'error', error: error.message }] }; }
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.status === 'complete' ? 0 : result.status === 'incomplete' ? 1 : 2;
}
