import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

test('launcher selects local model, preserves cwd and forwards arguments without shell evaluation', () => {
  const dir = mkdtempSync(resolve('tests/.pi-cyber-test-'));
  try {
    writeFileSync(join(dir, 'pi'), '#!/usr/bin/env node\nconsole.log(JSON.stringify({args:process.argv.slice(2),cwd:process.cwd()}));\n', {mode:0o755});
    const input = 'Review spaces; $(never-execute)';
    const r = spawnSync(process.execPath, [resolve('scripts/pi-cyber.mjs'), '--print', input], {
      encoding:'utf8', env:{...process.env, PATH:dir+':'+process.env.PATH}
    });
    assert.equal(r.status,0,r.stderr);
    const result = JSON.parse(r.stdout);
    assert.equal(result.cwd,process.cwd());
    assert.deepEqual(result.args.slice(0,7), [
      '--offline','--no-extensions','--no-mcp','--provider','omlx',
      '--model','Huihui-Qwen3.6-35B-A3B-abliterated-mlx-4bit'
    ]);
    assert.equal(result.args[7],'--append-system-prompt');
    assert.equal(result.args[8],resolve('agent/cybersecurity.md'));
    assert.deepEqual(result.args.slice(9),['--print',input]);
  } finally { rmSync(dir,{recursive:true,force:true}); }
});

test('launcher reports a missing Pi executable', () => {
  const r = spawnSync(process.execPath,[resolve('scripts/pi-cyber.mjs')],{
    encoding:'utf8',env:{...process.env,PATH:'/nonexistent'}
  });
  assert.equal(r.status,1);
  assert.match(r.stderr,/pi-cyber: could not start pi/);
});
