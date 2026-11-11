import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, readdir, readlink, lstat, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
async function fixture(t:any){const home=await mkdtemp(join(tmpdir(),'pi-ask-user-install-'));t.after(()=>rm(home,{recursive:true,force:true}));return {home,agent:join(home,'.pi/agent')};}
function install(home:string,...flags:string[]){return spawnSync('bash',[resolve(root,'install.sh'),...flags],{encoding:'utf8',timeout:10000,env:{...process.env,HOME:home}});}

test('default installer does not add the optional question tool or bundled skill',async t=>{
 const f=await fixture(t);assert.equal(install(f.home).status,0);
 await assert.rejects(lstat(join(f.agent,'extensions/ask-user')),{code:'ENOENT'});
 await assert.rejects(lstat(join(f.agent,'skills/ask-user')),{code:'ENOENT'});
});
test('ask-user opt-in is idempotent and changes no settings bytes or defaults',async t=>{
 const f=await fixture(t);await mkdir(f.agent,{recursive:true});
 const settings='not JSON: opaque settings are not read for this flag\n';await writeFile(join(f.agent,'settings.json'),settings);
 assert.equal(install(f.home).status,0);const before=(await readdir(f.agent)).filter(n=>n.startsWith('toolkit-backup-'));
 const result=install(f.home,'--with-ask-user');assert.equal(result.status,0,result.stderr);
 assert.equal(await readlink(join(f.agent,'extensions/ask-user')),resolve(root,'extensions/ask-user'));
 assert.equal(await readFile(join(f.agent,'settings.json'),'utf8'),settings);
 const backups=(await readdir(f.agent)).filter(n=>n.startsWith('toolkit-backup-'));assert.equal(backups.length,before.length+1);
 const added=backups.find(n=>!before.includes(n))!;const manifest=JSON.parse(await readFile(join(f.agent,added,'manifest.json'),'utf8'));
 assert.equal(manifest.settingsChanged,false);assert.deepEqual(manifest.newLinks,[[resolve(root,'extensions/ask-user'),join(f.agent,'extensions/ask-user')]]);
 assert.equal(install(f.home,'--with-ask-user').status,0);assert.deepEqual((await readdir(f.agent)).filter(n=>n.startsWith('toolkit-backup-')),backups);
 await assert.rejects(lstat(join(f.agent,'skills/ask-user')),{code:'ENOENT'});
});
test('ask-user opt-in does not follow or replace an existing settings symlink',async t=>{
 const f=await fixture(t);await mkdir(f.agent,{recursive:true});const owned=join(f.home,'fixture-settings');await writeFile(owned,'preserve\n');await symlink(owned,join(f.agent,'settings.json'));
 const result=install(f.home,'--with-ask-user');assert.equal(result.status,0,result.stderr);
 assert.equal(await readlink(join(f.agent,'settings.json')),owned);assert.equal(await readFile(owned,'utf8'),'preserve\n');
});
test('ask-user conflicts preflight before creating any default links or backup',async t=>{
 for(const kind of ['file','directory','link','dangling']){
  const f=await fixture(t);const conflict=join(f.agent,'extensions/ask-user');await mkdir(join(f.agent,'extensions'),{recursive:true});
  if(kind==='file')await writeFile(conflict,'preserve');else if(kind==='directory')await mkdir(conflict);else{const target=join(f.home,kind);if(kind==='link')await mkdir(target);await symlink(target,conflict);}
  const result=install(f.home,'--with-ask-user');assert.equal(result.status,1);assert.match(result.stderr,/Refusing to overwrite/);
  if(kind==='file')assert.equal(await readFile(conflict,'utf8'),'preserve');else if(kind==='directory')assert.ok((await lstat(conflict)).isDirectory());else assert.equal(await readlink(conflict),join(f.home,kind));
  await assert.rejects(lstat(join(f.agent,'AGENTS.md')),{code:'ENOENT'});assert.ok(!(await readdir(f.agent)).some(n=>n.startsWith('toolkit-backup-')));
 }
});
test('combined opt-ins include one ask-user extension and no upstream ask skill',async t=>{
 const f=await fixture(t);const result=install(f.home,'--with-delivery-tmux','--with-one-pager','--with-progress','--hide-thinking','--with-ask-user');assert.equal(result.status,0,result.stderr);
 assert.deepEqual((await readdir(join(f.agent,'extensions'))).sort(),['ask-user','delivery-tmux','delivery-worker','lean-progress','one-pager']);
 assert.ok(!(await readdir(join(f.agent,'skills'))).includes('ask-user'));
});
