// Synthetic transport/provider regression: real delivery loader, Git and workspace admission;
// fake tmux holds panes open while two deterministic child processes perform writes.
// Run: node --test tests/delivery-submodule-parallel-e2e.test.mjs
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, realpathSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
test('wrapper launches overlapping builders in actual submodule linked worktrees', { timeout: 30000 }, () => {
  mkdirSync(join(root, '.agent-work/submodule-parallel-fix'), { recursive: true });
  const dir = mkdtempSync(join(root, '.agent-work/submodule-parallel-fix/submodule-e2e-'));
  const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const init = name => {
    const p = join(dir, name); mkdirSync(p); git(p, 'init', '-q');
    git(p, 'config', 'user.name', 'Fixture'); git(p, 'config', 'user.email', 'fixture@example.invalid');
    writeFileSync(join(p, 'README'), name); git(p, 'add', '.'); git(p, 'commit', '-qm', 'initial'); return p;
  };
  const source = init('source'), wrapper = init('wrapper'), unrelated = init('unrelated');
  git(wrapper, '-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', source, 'module');
  git(wrapper, 'commit', '-qam', 'submodule');
  const module = join(wrapper, 'module'), trees = [join(wrapper, 'builder-one'), join(wrapper, 'builder-two')];
  for (const tree of trees) git(module, 'worktree', 'add', '-q', '--detach', tree);
  const bin = join(dir, 'bin'), agent = join(dir, 'agent'); mkdirSync(bin); mkdirSync(agent);
  writeFileSync(join(bin, 'tmux'), `#!/bin/sh
case "$1" in
 display-message) printf '$fake-session\\n';;
 new-session) printf '$parking %%parking-anchor\\n';;
 new-window) n=0; [ ! -f "$FIXTURE/count" ] || read n < "$FIXTURE/count"; n=$((n+1)); echo "$n" > "$FIXTURE/count"; printf '%%owned%s\\n' "$n";;
 send-keys|kill-pane) :;;
 capture-pane) :;;
 *) exit 24;;
esac
`, { mode: 0o755 });
  let host = dirname(realpathSync(execFileSync('which', ['pi'], { encoding: 'utf8' }).trim()));
  while (true) { try { if (JSON.parse(readFileSync(join(host, 'package.json'), 'utf8')).name === '@earendil-works/pi-coding-agent') break; } catch {} const parent = dirname(host); assert.notEqual(parent, host, 'pi host not found'); host = parent; }
  const child = join(dir, 'client.mjs');
  writeFileSync(child, `
import assert from 'node:assert/strict';
import {writeFileSync,readFileSync,existsSync,renameSync,mkdirSync} from 'node:fs';
import {spawn} from 'node:child_process';
const {loadExtensions}=await import(${JSON.stringify(join(host, 'dist/core/extensions/loader.js'))});
const {createEventBus}=await import(${JSON.stringify(join(host, 'dist/core/event-bus.js'))});
const dir=${JSON.stringify(dir)}, wrapper=${JSON.stringify(wrapper)}, trees=${JSON.stringify(trees)}, unrelated=${JSON.stringify(unrelated)};
const loaded=await loadExtensions([${JSON.stringify(join(root, 'extensions/delivery-tmux/index.ts'))}],wrapper,createEventBus());
assert.deepEqual(loaded.errors,[]);
const ext=loaded.extensions[0], runtime=loaded.runtime, entries=[];
runtime.getAllTools=()=>[...ext.tools.keys()].map(name=>({name})); runtime.getThinkingLevel=()=> 'medium';
runtime.appendEntry=(customType,data)=>entries.push({type:'custom',customType,data:structuredClone(data)}); runtime.sendMessage=()=>{};
const parent=dir+'/parent.jsonl'; writeFileSync(parent,JSON.stringify({type:'session',version:3,id:'parent',cwd:wrapper})+'\\n');
const models=['gpt-5.4-mini','gpt-5.6-terra','gpt-5.6-sol','gpt-6.1-sol','gpt-6.1-terra','gpt-6-luna'].map(id=>({provider:'openai',id,api:'openai-responses',reasoning:true,thinkingLevelMap:{off:'none',xhigh:'xhigh'}}));
const {ModelRegistry}=await import(${JSON.stringify(join(host, 'dist/core/model-registry.js'))});
const registry=new ModelRegistry({getError:()=>undefined,getModel:(p,id)=>models.find(m=>m.provider===p&&m.id===id),getAvailableSnapshot:()=>models});
const ctx={cwd:wrapper,hasUI:false,model:models[3],modelRegistry:registry,sessionManager:{getSessionFile:()=>parent,getSessionId:()=> 'parent',getSessionDir:()=>dir,getBranch:()=>entries,getEntries:()=>entries}};
for(const h of ext.handlers.get('session_start')??[]) await h({reason:'startup'},ctx);
const invoke=(name,cwd)=>ext.tools.get('developer').definition.execute(name,{name,cwd,approvalRef:'fixture-approval',packetRef:'fixture-packet',packet:'Write only your assigned fixture; no nesting.'},undefined,undefined,ctx);
await assert.rejects(invoke('unrelated',unrelated),/linked worktree|repository/i);
const results=await Promise.all(trees.map((tree,i)=>invoke('builder-'+i,tree)));
assert.equal(results.length,2); for(const r of results) assert.equal(r.details.status,'started');
const records=entries.filter(e=>e.customType==='delivery-tmux-owned-v1'&&e.data.state==='running').map(e=>e.data);
assert.equal(records.length,2); assert.deepEqual(new Set(records.map(r=>r.loadout.cwd)),new Set(trees));
await assert.rejects(invoke('wrapper-owner',wrapper),/already active/);
await assert.rejects(ext.tools.get('subagent').definition.execute('review-wrapper',{agent:'reviewer',name:'review-wrapper',task:'Review.',cwd:wrapper},undefined,undefined,ctx),/already active/);
// Each deterministic stand-in waits at a two-process barrier before writing. Neither
// can pass if the other builder is absent or if execution is serial.
const worker=\`const fs=require('fs');const [dir,cwd,id]=process.argv.slice(1);fs.writeFileSync(dir+'/ready-'+id,'ready');const until=Date.now()+5000;while(!(fs.existsSync(dir+'/ready-0')&&fs.existsSync(dir+'/ready-1'))){if(Date.now()>until)process.exit(2);Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,10)}fs.writeFileSync(cwd+'/output-'+id,id);\`;
const children=trees.map((tree,i)=>spawn(process.execPath,['-e',worker,dir,tree,String(i)],{stdio:'inherit'}));
await Promise.all(children.map(c=>new Promise((resolve,reject)=>{c.on('error',reject);c.on('exit',code=>code===0?resolve():reject(Error('synthetic worker exit '+code)));})));
for(let i=0;i<2;i++) assert.equal(readFileSync(trees[i]+'/output-'+i,'utf8'),String(i));
assert.equal(existsSync(trees[0]+'/output-1'),false); assert.equal(existsSync(trees[1]+'/output-0'),false);
renameSync(trees[0],trees[0]+'-original'); mkdirSync(trees[0]);
await assert.rejects(ext.tools.get('subagent_message').definition.execute('replacement',{name:'builder-0',action:'pause'},undefined,undefined,ctx),/workspace replaced/);
for(const h of ext.handlers.get('session_start')??[]) await h({reason:'resume'},ctx);
await assert.rejects(invoke('after-recovery',trees[1]),/reconciliation|required|unavailable/i);
for(const h of ext.handlers.get('session_shutdown')??[]) await h({},ctx);
`);
  const result = spawnSync(process.execPath, [child], { encoding: 'utf8', timeout: 25000, env: { ...process.env, HOME: dir, PI_CODING_AGENT_DIR: agent, PATH: `${bin}:/usr/bin:/bin`, FIXTURE: dir, TMUX: 'fake', TMUX_PANE: '%parent', PI_OFFLINE: '1', PI_SUBAGENT_AGENT: '', PI_SUBAGENT_ALLOWED: '', PI_SUBAGENT_SHELL_READY_DELAY_MS: '40' } });
  assert.equal(result.status, 0, `fixture retained at ${dir}\n${result.stdout}\n${result.stderr}`);
});
