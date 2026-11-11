// Test-only Git objects. Call only for a fresh, task-owned synthetic repository.
import { execFileSync } from 'node:child_process';

export function initSyntheticGit(repo, env, { checkout = true } = {}) {
  const command = (args, input) => execFileSync('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false', '-C', repo, ...args], {
    env, input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
  command(['init', '-q', '--template=']);
  const blob = text => command(['hash-object', '-w', '--stdin'], text);
  const docs = command(['mktree'], `100644 blob ${blob('synthetic roles\n')}\troles-library.md\n`);
  const entries = [
    `100644 blob ${blob('# synthetic fixture\n')}\t.gitignore`,
    `100644 blob ${blob('synthetic plan\n')}\tPLAN.md`,
    `100644 blob ${blob('synthetic readme\n')}\tREADME.md`,
    `040000 tree ${docs}\tdocs`,
  ];
  const tree = command(['mktree'], entries.join('\n') + '\n');
  const initial = command(['hash-object', '-t', 'commit', '-w', '--stdin'],
    `tree ${tree}\nauthor Synthetic Fixture <synthetic@example.invalid> 946684800 +0000\ncommitter Synthetic Fixture <synthetic@example.invalid> 946684800 +0000\n\nSynthetic test fixture\n`);
  command(['symbolic-ref', 'HEAD', 'refs/heads/synthetic']);
  command(['update-ref', 'refs/heads/synthetic', initial]);
  command(['read-tree', 'HEAD']);
  if (checkout) command(['checkout-index', '-a']);
  return initial;
}
