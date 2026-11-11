import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, realpathSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getEventListeners } from 'node:events';
import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { validateRequest, validateResult } from '../extensions/ask-user/validation.ts';
const root=fileURLToPath(new URL('../',import.meta.url));
const located=spawnSync('sh',['-c','command -v pi'],{encoding:'utf8'});
assert.equal(located.status,0,'Installed Pi required, not a skipped gate');
let host=dirname(realpathSync(located.stdout.trim()));
while(true){try{if(JSON.parse(readFileSync(join(host,'package.json'),'utf8')).name==='@earendil-works/pi-coding-agent')break;}catch{}
const parent=dirname(host);assert.notEqual(parent,host);host=parent;}
for(const key of Object.keys(process.env)) if(key.startsWith('PI_ASK_USER_')) delete process.env[key];
const {loadExtensions}=await import(join(host,'dist/core/extensions/loader.js'));
const {createEventBus}=await import(join(host,'dist/core/event-bus.js'));
const {initTheme,theme}=await import(join(host,'dist/modes/interactive/theme/theme.js'));
const {getKeybindings,visibleWidth}=await import(join(host,'node_modules/@earendil-works/pi-tui/dist/index.js'));
initTheme('dark');
const keys={up:'\x1b[A',down:'\x1b[B',enter:'\r',escape:'\x1b',space:' ',tab:'\t',altO:'\x1bo'};
const params={question:'Start BUILD for the saved Format Selection removal plan?',context:'Fixture only. Preserve shared embeddings and unrelated work. No commit, install, release or app control.',options:[{title:'Yes — implement the saved plan'},{title:'Not yet — keep BUILD on hold'}],allowFreeform:false,allowComment:false,displayMode:'inline'};
async function fixture(){
 const events=createEventBus();const emitted=[];
 for(const name of ['ask:answered','ask:cancelled','herdr:blocked']) events.on(name,payload=>emitted.push({name,payload}));
 const loaded=await loadExtensions([join(root,'extensions/ask-user/index.ts')],root,events);
 assert.deepEqual(loaded.errors,[]); assert.equal(loaded.extensions.length,1);
 const ext=loaded.extensions[0]; assert.equal(ext.tools.size,0,'Factory must not activate before collision preflight');
 assert.equal(ext.commands.size,0); assert.deepEqual([...ext.handlers.keys()].sort(),['session_shutdown','session_start']);
 loaded.runtime.getAllTools=()=>[];
 for(const handler of ext.handlers.get('session_start')??[]) await handler({}, {});
 assert.deepEqual([...ext.tools.keys()],['ask_user']);
 const tool=ext.tools.get('ask_user').definition;
 assert.equal(tool.exposure,'model-only'); assert.equal(tool.executionMode,'sequential');
 const state={component:null,doneCalls:[],listener:null,listenerRemoved:0,hidden:false,customCalls:0};
 const ui={
  custom: async (factory,options)=>new Promise(resolve=>{
   state.customCalls++; const done=value=>{state.doneCalls.push(value);resolve(value);};
   state.component=factory({requestRender(){},terminal:{rows:40}},theme,getKeybindings(),done);
   options?.onHandle?.({isHidden:()=>state.hidden,setHidden:value=>{state.hidden=value;}});
  }),
  onTerminalInput:listener=>{assert.equal(state.listener,null);state.listener=listener;return()=>{state.listener=null;state.listenerRemoved++;};},
  notify(){},
  select:async()=>{throw Error('Unexpected RPC select');},input:async()=>{throw Error('Unexpected freeform input dialog');},
 };
 const start=(args=params,signal)=>tool.execute('fixture',args,signal,undefined,{mode:'tui',hasUI:true,cwd:root,ui});
 return {loaded,ext,tool,emitted,state,ui,start};
}
const press=(f,...inputs)=>{assert.ok(f.state.component);for(const key of inputs)f.state.component.handleInput(key);};
const cancelled=result=>{assert.equal(result.details.cancelled,true);if(result.details.kind==='batch')assert.deepEqual(result.details.answers,[]);else assert.equal(result.details.response,null);};
const noAnswers=f=>assert.equal(f.emitted.filter(e=>e.name==='ask:answered').length,0);
const balanced=f=>assert.deepEqual(f.emitted.filter(e=>e.name==='herdr:blocked').map(e=>e.payload.active),[true,false]);

test('native loader exposes exactly one model-only sequential tool after startup preflight',async()=>{await fixture();});
test('cursor navigation is not approval; Enter explicitly selects the offered Yes',async()=>{
 const f=await fixture();const pending=f.start();assert.equal(f.state.doneCalls.length,0);
 press(f,keys.down,keys.up);assert.equal(f.state.doneCalls.length,0);press(f,keys.enter);
 const result=await pending;assert.deepEqual(result.details.response,{kind:'selection',selections:[params.options[0].title]});assert.equal(result.details.cancelled,false);balanced(f);
 assert.deepEqual(f.emitted.filter(e=>e.name==='ask:answered').map(e=>e.payload),[{question:params.question,response:{kind:'selection'}}]);
});
test('arrow plus Enter returns Not yet as an answer, not implicit approval',async()=>{
 const f=await fixture();const pending=f.start();press(f,keys.down,keys.enter);const result=await pending;
 assert.deepEqual(result.details.response,{kind:'selection',selections:[params.options[1].title]});balanced(f);
});
test('Escape while Yes is focused cancels with no selected answer',async()=>{
 const f=await fixture();const pending=f.start();press(f,keys.escape);cancelled(await pending);noAnswers(f);balanced(f);
});
test('checkbox selection supports multiple choices, deselection and explicit Enter submit',async()=>{
 const f=await fixture();const pending=f.start({...params,options:[{title:'Regression checks'},{title:'Integrated checks'},{title:'Manual follow-up'}],allowMultiple:true});
 press(f,keys.space,keys.down,keys.space,keys.space,keys.down,keys.space);assert.equal(f.state.doneCalls.length,0);press(f,keys.enter);
 assert.deepEqual((await pending).details.response,{kind:'selection',selections:['Regression checks','Manual follow-up']});balanced(f);
});
test('multi-select Enter with no checked boxes submits the focused option (documented UX caveat)',async()=>{
 const f=await fixture();const pending=f.start({...params,allowMultiple:true});press(f,keys.down,keys.enter);
 assert.deepEqual((await pending).details.response,{kind:'selection',selections:[params.options[1].title]});
});
test('custom text is an explicit freeform answer, not mapped to Yes',async()=>{
 const f=await fixture();const pending=f.start({...params,allowFreeform:true});press(f,keys.down,keys.down,keys.enter);
 for(const key of 'Change scope first')press(f,key);press(f,keys.enter);
 assert.deepEqual((await pending).details.response,{kind:'freeform',text:'Change scope first'});balanced(f);
});
test('batch records answers but does not publish them until final review submission',async()=>{
 const f=await fixture();const args={questions:[{question:'Which check?',options:[{title:'Regression'},{title:'Integrated'}],allowFreeform:false},{question:'Which environment?',options:[{title:'Isolated fixture'},{title:'Defer live check'}],allowFreeform:false}],displayMode:'inline'};
 const pending=f.start(args);press(f,keys.down,keys.enter);noAnswers(f);press(f,keys.down,keys.enter);noAnswers(f);assert.equal(f.state.doneCalls.length,0);
 assert.ok(f.state.component.render(80).join('\n').includes('Review answers'));press(f,keys.enter);
 const result=await pending;assert.deepEqual(result.details.answers,[{status:'answered',response:{kind:'selection',selections:['Integrated']}},{status:'answered',response:{kind:'selection',selections:['Defer live check']}}]);assert.equal(f.emitted.filter(e=>e.name==='ask:answered').length,2);balanced(f);
});
test('batch cancellation discards already recorded answers',async()=>{
 const f=await fixture();const pending=f.start({questions:[{question:'First?',options:[{title:'Yes'}]},{question:'Second?',options:[{title:'No'}]}],displayMode:'inline'});
 press(f,keys.enter,keys.escape);cancelled(await pending);noAnswers(f);balanced(f);
});
test('batch skip is distinct from an answered choice',async()=>{
 const f=await fixture();const pending=f.start({questions:[{question:'First?',options:[{title:'A'}]},{question:'Second?',options:[{title:'B'}]}],displayMode:'inline'});
 press(f,keys.enter,keys.tab,keys.enter,keys.enter);const result=await pending;
 assert.deepEqual(result.details.answers,[{status:'answered',response:{kind:'selection',selections:['A']}},{status:'skipped'}]);assert.equal(f.emitted.filter(e=>e.name==='ask:answered').length,1);
});
test('pre-aborted request opens no UI and emits no answer',async()=>{
 const f=await fixture();const controller=new AbortController();controller.abort();cancelled(await f.start(params,controller.signal));assert.equal(f.state.customCalls,0);noAnswers(f);
});
test('in-flight abort cancels and removes listeners; a late Enter cannot complete twice',async()=>{
 const f=await fixture();const controller=new AbortController();const pending=f.start(params,controller.signal);assert.ok(getEventListeners(controller.signal,'abort').length>0);controller.abort();cancelled(await pending);
 assert.equal(getEventListeners(controller.signal,'abort').length,0);press(f,keys.enter);assert.equal(f.state.doneCalls.length,1);noAnswers(f);balanced(f);
});
test('timeout cancels with no answer and no late duplicate completion',async()=>{
 const f=await fixture();const pending=f.start({...params,timeout:15});cancelled(await pending);press(f,keys.enter);assert.equal(f.state.doneCalls.length,1);noAnswers(f);balanced(f);
});
test('batch timeout clears partial answers and removes caller abort listeners',async()=>{
 const f=await fixture();const controller=new AbortController();const pending=f.start({questions:[{question:'First?',options:[{title:'A'}]},{question:'Second?',options:[{title:'B'}]}],displayMode:'inline',timeout:15},controller.signal);press(f,keys.enter);cancelled(await pending);noAnswers(f);assert.equal(getEventListeners(controller.signal,'abort').length,0);balanced(f);
});
test('headless request fails rather than fabricating an answer',async()=>{
 const f=await fixture();await assert.rejects(f.tool.execute('headless',params,undefined,undefined,{mode:'json',hasUI:false,cwd:root}),/requires interactive mode/i);assert.equal(f.state.customCalls,0);noAnswers(f);
});
test('RPC dialog fallback returns an explicit answer and treats dialog cancel as cancellation',async()=>{
 for(const answer of [params.options[1].title,undefined]){
  const f=await fixture();const ui={custom:async()=>undefined,select:async(_title,options)=>{assert.deepEqual(options,params.options.map(o=>o.title));return answer;}};
  const result=await f.tool.execute('rpc',params,undefined,undefined,{mode:'rpc',hasUI:true,ui});
  if(answer)assert.deepEqual(result.details.response,{kind:'selection',selections:[answer]});else {cancelled(result);noAnswers(f);}balanced(f);
 }
});
test('late RPC answer after abort is discarded',async()=>{
 const f=await fixture();const controller=new AbortController();let resolveDialog;
 const pending=f.tool.execute('rpc-abort',params,controller.signal,undefined,{mode:'rpc',hasUI:true,ui:{custom:async()=>undefined,select:()=>new Promise(resolve=>{resolveDialog=resolve;})}});
 await new Promise(resolve=>setImmediate(resolve));assert.ok(resolveDialog);controller.abort();resolveDialog(params.options[0].title);cancelled(await pending);noAnswers(f);balanced(f);
});
test('UI failures throw and release blocked status without an answer',async()=>{
 const f=await fixture();await assert.rejects(f.tool.execute('broken',params,undefined,undefined,{mode:'tui',hasUI:true,ui:{custom:async()=>{throw Error('Fixture UI failed');}}}),/Fixture UI failed/);noAnswers(f);balanced(f);
});
test('malformed calls/batches fail before presenting UI',async()=>{
 for(const args of [{},{...params,options:[{title:' '}]},{questions:[{question:'Only one?'}]},{questions:[{question:'Same?'},{question:'Same?'}]}]){
  const f=await fixture();await assert.rejects(f.start(args));assert.equal(f.state.customCalls,0);noAnswers(f);
 }
});
test('overlay toggle listeners are owned and released after cancellation',async()=>{
 const f=await fixture();const pending=f.start({...params,displayMode:'overlay'});assert.ok(f.state.listener);f.state.listener(keys.altO);assert.equal(f.state.hidden,true);f.state.listener(keys.altO);assert.equal(f.state.hidden,false);press(f,keys.escape);cancelled(await pending);assert.equal(f.state.listener,null);assert.equal(f.state.listenerRemoved,1);balanced(f);
});
test('freeform Escape backs out; a second Escape cancels without publishing text',async()=>{
 const f=await fixture();const pending=f.start({...params,allowFreeform:true});press(f,keys.down,keys.down,keys.enter,'s','e','c','r','e','t',keys.escape);assert.equal(f.state.doneCalls.length,0);press(f,keys.escape);cancelled(await pending);noAnswers(f);balanced(f);
});
test('optional comment Escape backs out; cancellation never publishes pending selection',async()=>{
 const f=await fixture();const pending=f.start({...params,allowComment:true});press(f,'\x07',keys.enter,'n','o','t','e',keys.escape);assert.equal(f.state.doneCalls.length,0);press(f,keys.escape);cancelled(await pending);noAnswers(f);balanced(f);
});
test('Kitty overlay repeat/release do not double toggle and listener is removed',async()=>{
 const f=await fixture();const pending=f.start({...params,displayMode:'overlay'});const listener=f.state.listener;assert.ok(listener);
 listener('\x1b[111;3u');assert.equal(f.state.hidden,true);listener('\x1b[111;3:2u');assert.equal(f.state.hidden,true);listener('\x1b[111;3:3u');assert.equal(f.state.hidden,true);press(f,keys.escape);cancelled(await pending);assert.equal(f.state.listenerRemoved,1);
});
test('batch abort after first answer discards it and releases caller listener',async()=>{
 const f=await fixture();const controller=new AbortController();const pending=f.start({questions:[{question:'First?',options:[{title:'A'}]},{question:'Second?',options:[{title:'B'}]}],displayMode:'inline'},controller.signal);press(f,keys.enter);controller.abort();cancelled(await pending);noAnswers(f);assert.equal(getEventListeners(controller.signal,'abort').length,0);balanced(f);
});
test('RPC multi-select rejects out-of-options input before returning or broadcasting an answer',async()=>{
 const f=await fixture();
 await assert.rejects(f.tool.execute('rpc-multiple',{...params,allowMultiple:true},undefined,undefined,{mode:'rpc',hasUI:true,ui:{custom:async()=>undefined,input:async()=> 'Unlisted fixture value'}}),/not among the offered options/);
 noAnswers(f);balanced(f);
});
test('RPC multi-select blank input cancels without an answer',async()=>{
 const f=await fixture();const result=await f.tool.execute('rpc-multiple-empty',{...params,allowMultiple:true},undefined,undefined,{mode:'rpc',hasUI:true,ui:{custom:async()=>undefined,input:async()=> '   '}});cancelled(result);noAnswers(f);balanced(f);
});
test('default event payloads keep synthetic context and answer out of broadcasts',async()=>{
 const f=await fixture();const pending=f.start({...params,question:'Which option?',context:'Synthetic private context',options:[{title:'Synthetic private answer'}]});press(f,keys.enter);await pending;
 assert.deepEqual(f.emitted.filter(e=>e.name==='ask:answered').map(e=>e.payload),[{question:'Which option?',response:{kind:'selection'}}]);assert.doesNotMatch(JSON.stringify(f.emitted),/Synthetic private/);
});
test('all pinned vendor files are unchanged and the mandatory upstream skill is absent',async()=>{
 const manifest=JSON.parse(readFileSync(join(root,'vendor/pi-ask-user/UPSTREAM.json'),'utf8'));
 assert.equal(manifest.revision,'e8b59a5114bb1cf4fca239b75976483703c9783f');
 assert.equal(Object.keys(manifest.files).length,5);
 for(const [path,digest] of Object.entries(manifest.files))assert.equal(createHash('sha256').update(readFileSync(join(root,'vendor/pi-ask-user',path))).digest('hex'),digest,path);
 const {loadSkills}=await import(join(host,'dist/core/skills.js'));
 const loaded=loadSkills({cwd:root,agentDir:join(root,'not-an-agent-dir'),includeDefaults:false,skillPaths:[join(root,'vendor/pi-ask-user')]});
 assert.deepEqual(loaded.skills,[]);assert.deepEqual(loaded.diagnostics,[]);
 assert.match(readFileSync(join(root,'vendor/pi-ask-user/LICENSE'),'utf8'),/MIT License/);
});
test('collision denies activation, repeated startup registers once, shutdown denies execution',async()=>{
 const events=createEventBus();const loaded=await loadExtensions([join(root,'extensions/ask-user/index.ts')],root,events);assert.deepEqual(loaded.errors,[]);
 const ext=loaded.extensions[0];loaded.runtime.getAllTools=()=>[{name:'ask_user'}];
 const start=async()=>{for(const h of ext.handlers.get('session_start')??[])await h({},{});};
 await assert.rejects(start(),/Conflicting ask_user/);assert.equal(ext.tools.size,0);
 loaded.runtime.getAllTools=()=>[];await start();const tool=ext.tools.get('ask_user').definition;await start();assert.equal(ext.tools.get('ask_user').definition,tool);
 for(const h of ext.handlers.get('session_shutdown')??[])await h({},{});
 await assert.rejects(tool.execute('closed',params,undefined,undefined,{hasUI:false}),/session preflight/);
});
test('input guard rejects blank/duplicate/partially malformed options before UI opens',async()=>{
 for(const args of [{...params,question:' '},{...params,options:[{title:'Yes'},{title:'yes'}]},{...params,options:[{title:'Yes'},{}]},{...params,options:[],allowFreeform:false}]){
  const f=await fixture();await assert.rejects(f.start(args));assert.equal(f.state.customCalls,0);noAnswers(f);
 }
});
test('result guard rejects mismatches, malformed selections/freeform and ambiguous cancellations',()=>{
 const prompts=validateRequest(params);
 const details={question:params.question,cancelled:false,response:{kind:'selection',selections:[params.options[0].title]}};
 validateResult(params,prompts,details);
 for(const bad of [{...details,response:null},{...details,cancelled:'false'},{...details,response:{kind:'selection',selections:[]}},{...details,response:{kind:'selection',selections:['unlisted']}},{...details,response:{kind:'selection',selections:params.options.map(o=>o.title)}},{...details,response:{kind:'freeform',text:'Yes'}},{...details,question:'Another scope?'},{...details,cancelled:true}])assert.throws(()=>validateResult(params,prompts,bad));
 const request={questions:[{question:'First?',options:[{title:'A'}]},{question:'Second?',options:[{title:'B'}]}]};const batchPrompts=validateRequest(request);
 assert.throws(()=>validateResult(request,batchPrompts,{kind:'batch',cancelled:true,answers:[{status:'answered',response:{kind:'selection',selections:['A']}}]}));
 assert.throws(()=>validateResult(request,batchPrompts,{kind:'batch',cancelled:false,questions:request.questions,answers:[{status:'skipped',response:{kind:'selection',selections:['A']}},{status:'skipped'}]}));
});
test('outcome broadcasts stay redacted even when upstream full-event preference is enabled',async()=>{
 process.env.PI_ASK_USER_EMIT_FULL_EVENTS='true';
 try{const f=await fixture();const pending=f.start({...params,question:'Which option?',context:'Synthetic private context',options:[{title:'Synthetic private answer'}]});press(f,keys.enter);await pending;
 assert.deepEqual(f.emitted.filter(e=>e.name==='ask:answered').map(e=>e.payload),[{question:'Which option?',response:{kind:'selection'}}]);assert.doesNotMatch(JSON.stringify(f.emitted),/Synthetic private/);
 }finally{delete process.env.PI_ASK_USER_EMIT_FULL_EVENTS;}
});
test('upstream result is discarded if abort fires between its return and adapter continuation',async()=>{
 const f=await fixture();const controller=new AbortController();
 const pending=f.tool.execute('race',params,controller.signal,undefined,{mode:'rpc',hasUI:true,ui:{custom:async()=>undefined,select:async()=>{queueMicrotask(()=>queueMicrotask(()=>controller.abort()));return params.options[0].title;}}});
 cancelled(await pending);noAnswers(f);balanced(f);
});
test('native rendering fits compact/wide terminal widths with Unicode text and resizing',async()=>{
 const f=await fixture();const pending=f.start({...params,options:[{title:'日本語 😀 café',description:'Multicolumn fixture — do not truncate the outcome.'},{title:'Defer'}],singleSelectLayout:'list'});
 for(const width of [24,40,80,120,40]){f.state.component.invalidate();const lines=f.state.component.render(width);assert.ok(lines.length>0);for(const line of lines)assert.ok(visibleWidth(line)<=width,`width ${width}: ${visibleWidth(line)} ${line}`);}
 press(f,keys.escape);cancelled(await pending);
});

test('installed symlink is model-only in a real SDK/codemode loadout and no upstream skill is discovered',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'pi-ask-user-sdk-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const installed=spawnSync('bash',[join(root,'install.sh'),'--with-ask-user'],{encoding:'utf8',env:{...process.env,HOME:dir}});
 assert.equal(installed.status,0,installed.stderr);
 const sdk=await import(join(host,'dist/index.js'));
 const agentDir=join(dir,'.pi/agent');
 const settingsManager=sdk.SettingsManager.inMemory({defaultTools:['codemode','ask_user'],codemode:{mode:'on'},cacheWarming:'off'});
 const loader=new sdk.DefaultResourceLoader({cwd:dir,agentDir,settingsManager,noExtensions:true,noSkills:true,noPromptTemplates:true,noThemes:true,noContextFiles:true,
  additionalExtensionPaths:['builtin:codemode',join(agentDir,'extensions/ask-user/index.ts')],
  additionalSkillPaths:[join(agentDir,'skills')],
  extensionFactories:[{name:'codemode',builtin:true,factory:sdk.createCodemodeExtension()}]});
 const realFetch=globalThis.fetch;globalThis.fetch=()=>{throw Error('Network forbidden in fixture');};
 let session;
 try{
  await loader.reload();assert.deepEqual(loader.getExtensions().errors,[]);assert.deepEqual(loader.getSkills().diagnostics,[]);
  const discovery=new sdk.DefaultResourceLoader({cwd:dir,agentDir,settingsManager,noExtensions:false,noSkills:false,noContextFiles:true,noPromptTemplates:true,noThemes:true,extensionFactories:[]});
  await discovery.reload();assert.deepEqual(discovery.getExtensions().errors,[]);
  assert.ok(discovery.getExtensions().extensions.some(ext=>ext.path.includes('extensions/ask-user')),'Normal global discovery finds the installed link');
  assert.ok(!discovery.getSkills().skills.some(s=>s.name==='ask-user'));
  const skills=loader.getSkills().skills.map(s=>s.name).sort();
  assert.deepEqual(skills,['addy-engineering','debug','delivery','discovery','duadigital-pdf-maker','grill-me','homelab-validation','zoom-out']);
  const runtime=await sdk.ModelRuntime.create({authPath:join(agentDir,'fixture-auth.json'),modelsPath:join(agentDir,'fixture-models.json'),modelsStorePath:join(agentDir,'fixture-model-store.json'),refreshOnCreate:false,allowModelNetwork:false});
  const model={provider:'fixture',id:'fixture',name:'No model requests',api:'openai-responses',baseUrl:'http://127.0.0.1:1',reasoning:false,input:['text'],cost:{input:0,output:0,cacheRead:0,cacheWrite:0},contextWindow:128000,maxTokens:512};
  ({session}=await sdk.createAgentSession({cwd:dir,agentDir,settingsManager,resourceLoader:loader,modelRuntime:runtime,model,tools:['codemode','ask_user'],sessionManager:sdk.SessionManager.inMemory(dir)}));
  await session.bindExtensions({});session.setActiveToolsByName(['codemode','ask_user']);
  assert.ok(session.getActiveToolNames().includes('ask_user'));assert.ok(!session.getCallableToolNames().includes('ask_user'));
  assert.equal(session.getAllTools().find(t=>t.name==='ask_user').exposure,'model-only');
  assert.doesNotMatch(session.systemPrompt,/Non-negotiable rule|decision handshake|MUST use.*ask_user/i);
  const codemode=session.agent.state.tools.find(t=>t.name==='codemode');assert.ok(codemode);
  async function run(code){
   const id='fixture-'+session.agent.state.messages.length;
   session.agent.state.messages.push({role:'assistant',content:[{type:'toolCall',id,name:'codemode',arguments:{code}}],api:model.api,provider:'fixture',model:'fixture',timestamp:Date.now(),stopReason:'toolUse',usage:{input:0,output:0,cacheRead:0,cacheWrite:0,totalTokens:0,cost:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}}});
   return (await codemode.execute(id,{code})).content.filter(c=>c.type==='text').map(c=>c.text).join('\n');
  }
  const catalog=await run('return ALL_TOOLS.map(t=>t.name);');assert.match(catalog,/Script completed/);assert.doesNotMatch(catalog,/ask_user/);
  assert.match(await run('await tools.ask_user({question:"Must not open",options:[{title:"Yes"}]});'),/Script failed/);
 }finally{session?.dispose();globalThis.fetch=realFetch;}
});
