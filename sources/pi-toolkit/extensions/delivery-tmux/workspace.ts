import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";

/** Only the current checkout or another linked worktree of its repository. */
export function resolveWorkerWorkspace(current: string, requested?: string): string {
  const cwd = realpathSync(current);
  if (requested === undefined) return cwd;
  if (typeof requested !== "string" || !requested.trim() || requested.includes("\0")) throw new Error("Invalid worker workspace");
  let target: string;
  try { target = realpathSync(requested); }
  catch { throw new Error("Worker workspace unavailable: " + requested); }
  if (target === cwd) return target;
  const listing = execFileSync("git", ["-C", cwd, "worktree", "list", "--porcelain", "-z"], { encoding: "utf8", timeout: 10000 });
  const worktrees = listing.split("\0").filter(line => line.startsWith("worktree ")).map(line => realpathSync(line.slice(9)));
  if (!worktrees.includes(target)) throw new Error("Worker workspace must be a linked worktree of the current repository");
  return target;
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
