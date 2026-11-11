import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { test } from 'node:test';
import { materializeCandidate } from '../scripts/addy-materialize.mjs';

const cli = fileURLToPath(new URL('../scripts/addy-materialize.mjs', import.meta.url));
const unopened = join(fileURLToPath(new URL('../', import.meta.url)), '.agent-work/parallel-addy/nonexistent-materialization-input');
test('materialization rejects missing grants before examining the project', () => {
  let touched = false;
  const request = { grants: {}, get project() { touched = true; throw Error('project examined'); } };
  assert.throws(() => materializeCandidate(request), /grants required/); assert.equal(touched, false);
  const keys = ['sourceContent', 'repositoryControl', 'coordinationArtifacts', 'journalWrite', 'nestedControls', 'linkedControl', 'worktreeCreate', 'targetContent', 'targetWrite', 'targetCoordination', 'metadataExclusionsAccepted'];
  for (const missing of keys) {
    const declared = Object.fromEntries(keys.filter(x => x !== missing).map(x => [x, true]));
    assert.throws(() => materializeCandidate({ grants: declared, get project() { throw Error('project examined'); } }), /grants required/, missing);
  }
  const result = spawnSync(process.execPath, [cli, unopened, 'task', 'attempt', 'builder', 'a'.repeat(64), '0'], { encoding: 'utf8' });
  assert.notEqual(result.status, 0); assert.match(result.stderr, /grants required/);
});
