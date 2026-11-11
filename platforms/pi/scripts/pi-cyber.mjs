#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const prompt = fileURLToPath(new URL('../agent/cybersecurity.md', import.meta.url));
const args = [
  '--offline', '--no-extensions', '--no-mcp',
  '--provider', 'omlx',
  '--model', 'Huihui-Qwen3.6-35B-A3B-abliterated-mlx-4bit',
  '--append-system-prompt', prompt,
  ...process.argv.slice(2),
];
const child = spawn('pi', args, { stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => child.kill(signal));
}
child.on('error', (error) => {
  console.error(`pi-cyber: could not start pi: ${error.message}`);
  process.exitCode = 1;
});
child.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal === 'SIGINT' ? 130 : 1);
});
