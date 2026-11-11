import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

// Compare canonical roots, ignoring stale worktree registrations without pruning them.
function registeredWorktrees(repository: string): string[] {
  const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", timeout: 10000, stdio: ["ignore", "pipe", "pipe"] });
  const common = realpathSync(git(repository, "rev-parse", "--path-format=absolute", "--git-common-dir").trim());
  const listing = git(repository, "worktree", "list", "--porcelain", "-z");
  return listing.split("\0").filter(line => line.startsWith("worktree ")).flatMap(line => {
    try {
      const path = realpathSync(line.slice(9));
      if (realpathSync(git(path, "rev-parse", "--show-toplevel").trim()) !== path ||
          realpathSync(git(path, "rev-parse", "--path-format=absolute", "--git-common-dir").trim()) !== common) return [];
      return [path];
    } catch { return []; }
  });
}

/** Current repository worktrees, or worktrees of an initialized, registered submodule. */
export function resolveWorkerWorkspace(current: string, requested?: string): string {
  const cwd = realpathSync(current);
  if (requested === undefined) return cwd;
  if (typeof requested !== "string" || !requested.trim() || requested.includes("\0")) throw new Error("Invalid worker workspace");
  let target: string;
  try { target = realpathSync(requested); }
  catch { throw new Error("Worker workspace unavailable: " + requested); }
  if (target === cwd) return target;
  try { if (registeredWorktrees(cwd).includes(target)) return target; } catch { /* Non-repository contexts cannot admit other workspaces. */ }

  // A gitlink alone is not enough: the checked-out submodule must be a real
  // repository root at its declared path, not an unrelated repo or symlink.
  const git = (...args: string[]) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", timeout: 10000, stdio: ["ignore", "pipe", "pipe"] });
  try {
    const root = realpathSync(git("rev-parse", "--show-toplevel").trim());
    const entries = execFileSync("git", ["-C", root, "ls-files", "--stage", "-z"], { encoding: "utf8", timeout: 10000, stdio: ["ignore", "pipe", "pipe"] }).split("\0");
    const declared = git("config", "-z", "-f", resolve(root, ".gitmodules"), "--get-regexp", "^submodule\\..*\\.path$")
      .split("\0").filter(Boolean).map(entry => { const split = entry.indexOf("\n"); return { name: entry.slice(10, split - 5), path: entry.slice(split + 1) }; });
    for (const { name, path } of declared) {
      const submodule = resolve(root, path), rel = relative(root, submodule);
      if (!rel || rel === ".." || rel.startsWith(".." + sep) || isAbsolute(rel)) continue;
      const link = entries.find(entry => /^160000 [0-9a-f]+ 0\t/.test(entry) && entry.slice(entry.indexOf("\t") + 1) === path);
      if (!link) continue;
      try {
        if (realpathSync(submodule) !== submodule) continue;
        const top = execFileSync("git", ["-C", submodule, "rev-parse", "--show-toplevel"], { encoding: "utf8", timeout: 10000, stdio: ["ignore", "pipe", "pipe"] }).trim();
        if (realpathSync(top) !== submodule) continue;
        const subgit = (...args: string[]) => execFileSync("git", ["-C", submodule, ...args], { encoding: "utf8", timeout: 10000, stdio: ["ignore", "pipe", "pipe"] });
        if (realpathSync(subgit("rev-parse", "--show-superproject-working-tree").trim()) !== root) continue;
        // A separate clone at the gitlink path can also report a superproject.
        // Require the common Git storage for this declared submodule name.
        const expected = git("rev-parse", "--path-format=absolute", "--git-path", "modules/" + name).trim();
        if (realpathSync(subgit("rev-parse", "--path-format=absolute", "--git-common-dir").trim()) !== realpathSync(expected)) continue;
        subgit("cat-file", "-e", link.split(" ")[1] + "^{commit}");
        if (target === submodule || registeredWorktrees(submodule).includes(target)) return target;
      } catch { /* Uninitialized or unavailable submodule. */ }
    }
  } catch { /* No usable submodule declarations; deny by default. */ }
  throw new Error("Worker workspace must be a linked worktree of the current repository or its initialized submodule");
}

// A deliberately narrow candidate token: only a clean Git checkout with no
// assume-unchanged/skip-worktree entries qualifies for shared review. Git status
// cannot see ignored files or transient changes; this is not a filesystem lock.
export function cleanReviewCandidate(workspace: string): string {
  const git = (...args: string[]) => execFileSync("git", ["--no-optional-locks", "-c", "core.fsmonitor=false", "-C", workspace, ...args], {
    encoding: "utf8", timeout: 10000, maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" }, stdio: ["ignore", "pipe", "pipe"],
  });
  const root = realpathSync(git("rev-parse", "--show-toplevel").trim());
  if (root !== realpathSync(workspace)) throw new Error("Shared review requires the Git worktree root");
  const head = git("rev-parse", "--verify", "HEAD^{commit}").trim();
  if (!/^[a-f0-9]{40}([a-f0-9]{24})?$/.test(head)) throw new Error("Invalid review revision");
  const entries = git("ls-files", "-v", "-z").split("\0").filter(Boolean);
  if (entries.some(entry => !entry.startsWith("H "))) throw new Error("Shared review cannot verify index flags");
  if (git("status", "--porcelain=v1", "-z", "--untracked-files=all", "--ignore-submodules=none")) throw new Error("Shared review requires a clean worktree");
  if (git("rev-parse", "--verify", "HEAD^{commit}").trim() !== head) throw new Error("Review revision changed during inspection");
  return head;
}

/** Dispatch is serialized; running workers need not be. Keeps launch hooks unambiguous. */
export class DispatchQueue {
  private tail: Promise<void> = Promise.resolve();
  async acquire(): Promise<() => void> {
    const prior = this.tail;
    let release!: () => void;
    this.tail = new Promise<void>(resolve => { release = resolve; });
    await prior;
    return release;
  }
}
