import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const agentDir = dirname(dirname(realpathSync(execFileSync('which', ['pi'], { encoding: 'utf8' }).trim())));
const version = readFileSync(join(agentDir, 'install/current-version'), 'utf8').trim();
const modules = join(agentDir, 'install/releases', version, 'node_modules');
const host = join(modules, '@earendil-works/pi-coding-agent');

test('widget separates context, new input, and output without counting repeated cache reads', () => {
  const parent = join(root, '.agent-work', 'widget-usage-tests'); mkdirSync(parent, { recursive: true });
  const dir = mkdtempSync(join(parent, 'run-'));
  const runtime = join(root, 'vendor/pi-interactive-subagents/pi-extension/subagents');
  const wrapper = join(dir, 'extension.ts');
  writeFileSync(wrapper, `import {__test__} from ${JSON.stringify(join(runtime, 'index.ts'))}; import {createStatusState} from ${JSON.stringify(join(runtime, 'status.ts'))}; globalThis.widgetTest = { ...__test__, createStatusState }; export default function() {}`);
  const script = `
    import assert from 'node:assert/strict';
    import {writeFileSync, appendFileSync} from 'node:fs';
    const {loadExtensions} = await import(${JSON.stringify(join(host, 'dist/core/extensions/loader.js'))});
    const {createEventBus} = await import(${JSON.stringify(join(host, 'dist/core/event-bus.js'))});
    const loaded = await loadExtensions([${JSON.stringify(wrapper)}], ${JSON.stringify(dir)}, createEventBus());
    assert.deepEqual(loaded.errors, []);
    const t = globalThis.widgetTest, path = ${JSON.stringify(join(dir, 'session.jsonl'))};
    const agent = {id:'abc', name:'checker', agent:'reviewer', sessionFile:path, startTime:Date.now(), statusState:t.createStatusState({source:'pi',startTimeMs:Date.now()})};
    assert.equal(t.widgetSessionDetails(agent), '? · ctx ? · new in ? · out ?');
    const entry = (model, usage) => JSON.stringify({type:'message',message:{role:'assistant',model,content:[],usage}})+'\\n';
    writeFileSync(path, entry('model-one',{input:100,output:20,cacheRead:300,cacheWrite:10,totalTokens:430}));
    assert.equal(t.widgetSessionDetails(agent), 'model-one · ctx ~430 · new in 110 · out 20');
    appendFileSync(path, entry('model-two',{input:500,output:50,cacheRead:200000,cacheWrite:0,totalTokens:200550}));
    assert.equal(t.widgetSessionDetails(agent), 'model-two · ctx ~201k · new in 610 · out 70');
    appendFileSync(path, entry('model-two',{input:1,output:2,cacheRead:100000,cacheWrite:3}));
    assert.equal(t.widgetSessionDetails(agent), 'model-two · ctx ~100k · new in 614 · out 72');
    const lines = t.renderSubagentWidgetLines([agent], 120).join('\\n');
    assert.match(lines, /checker/); assert.match(lines, /model-two/); assert.match(lines, /new in 614/);
    const narrow = t.renderSubagentWidgetLines([{...agent, name:'a-very-long-subagent-name-for-testing'}], 40).join('\\n');
    for (const part of ['model-two', 'ctx ~100k', 'new in 614', 'out 72']) assert.ok(narrow.includes(part), part);
    const {visibleWidth} = await import(${JSON.stringify(join(modules, '@earendil-works/pi-tui/dist/index.js'))});
    for (const width of [20,40,80,120]) for (const line of t.renderSubagentWidgetLines([agent], width)) assert.ok(visibleWidth(line) <= width);
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8', timeout: 30000 });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
