// Research fixture only: not a transfer implementation or a security boundary.
#include <sys/types.h>
#include <sys/stat.h>
#include <sys/resource.h>
#include <sys/wait.h>
#include <fcntl.h>
#include <unistd.h>
#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#ifndef O_NOFOLLOW
#error "O_NOFOLLOW is required"
#endif
#ifndef O_DIRECTORY
#error "O_DIRECTORY is required"
#endif

static int wait_line(void) { char c; return read(STDIN_FILENO, &c, 1) == 1 ? 0 : -1; }
static int run(char *const args[]) {
  pid_t child = fork();
  if (child < 0) return 250;
  if (!child) { (void)dup2(STDERR_FILENO, STDOUT_FILENO); execv(args[0], args); _exit(251); }
  int status = 0; if (waitpid(child, &status, 0) != child) return 252;
  return WIFEXITED(status) ? WEXITSTATUS(status) : WIFSIGNALED(status) ? 128 + WTERMSIG(status) : 253;
}
static int file_read(int directory) {
  if (directory < 0) return -1;
  int fd = openat(directory, "data", O_RDONLY | O_NOFOLLOW);
  if (fd < 0) return -1;
  char buf[64]; ssize_t n = read(fd, buf, sizeof(buf)); close(fd);
  return n == 8 && !memcmp(buf, "approved", 8) ? 0 : -2;
}
static int file_write(int directory) {
  if (directory < 0) return -1;
  int fd = openat(directory, "created", O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW, 0600);
  if (fd < 0) return -1;
  int ok = write(fd, "synthetic", 9) == 9 && fsync(fd) == 0 ? 0 : -2; close(fd); return ok;
}
int main(int argc, char **argv) {
  struct rlimit no_core = {0, 0}; (void)setrlimit(RLIMIT_CORE, &no_core);
  if (argc < 3) return 2;
  if (!strcmp(argv[1], "anchored") || !strcmp(argv[1], "reject")) {
    int root = open(argv[2], O_RDONLY | O_DIRECTORY | O_NOFOLLOW);
    if (root < 0) return 3;
    int s = -1, t = -1;
    if (!strcmp(argv[1], "anchored")) { s = openat(root, "source", O_RDONLY | O_DIRECTORY | O_NOFOLLOW); t = openat(root, "target", O_RDONLY | O_DIRECTORY | O_NOFOLLOW); }
    printf("READY\n"); fflush(stdout); if (wait_line()) return 4;
    if (!strcmp(argv[1], "reject")) { s = openat(root, "source", O_RDONLY | O_DIRECTORY | O_NOFOLLOW); t = openat(root, "target", O_RDONLY | O_DIRECTORY | O_NOFOLLOW); }
    int r = file_read(s), w = file_write(t);
    printf("{\"sourceOpened\":%s,\"targetOpened\":%s,\"read\":%d,\"write\":%d}\n", s >= 0 ? "true" : "false", t >= 0 ? "true" : "false", r, w);
    if (s >= 0) close(s);
    if (t >= 0) close(t);
    close(root); return 0;
  }
  if (!strcmp(argv[1], "git") && argc == 7) {
    const char *repo = argv[2], *target = argv[3], *node = argv[4], *graph = argv[5], *project = argv[6];
    int root = open(repo, O_RDONLY | O_DIRECTORY | O_NOFOLLOW); if (root < 0) return 3;
    char index[4096], checkout[4096], workspace[4096], ownerindex[4096], data[4096];
    if (snprintf(index, sizeof(index), "%s/index", target) >= (int)sizeof(index) || snprintf(checkout, sizeof(checkout), "%s/checkout", target) >= (int)sizeof(checkout) ||
        snprintf(workspace, sizeof(workspace), "%s/graph", target) >= (int)sizeof(workspace) || snprintf(ownerindex, sizeof(ownerindex), "%s/.git/index", repo) >= (int)sizeof(ownerindex) ||
        snprintf(data, sizeof(data), "%s/data", target) >= (int)sizeof(data)) return 5;
    setenv("GIT_CONFIG_NOSYSTEM", "1", 1); setenv("GIT_CONFIG_GLOBAL", "/dev/null", 1); setenv("GIT_TERMINAL_PROMPT", "0", 1);
    char *hash_args[] = {"/usr/bin/git", "-C", (char *)repo, "hash-object", "--no-filters", data, NULL};
    char *index_args[] = {"/usr/bin/git", "-C", (char *)repo, "read-tree", "HEAD", NULL};
    char *checkout_args[] = {"/usr/bin/git", "-C", (char *)repo, "--work-tree", checkout, "checkout-index", "-a", NULL};
    char *graph_args[] = {(char *)node, (char *)graph, (char *)project, workspace, "graph", "init", "{\"op\":\"init\",\"baseline\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"baselineRef\":\"synthetic\",\"slices\":[{\"id\":\"slice\",\"depends\":[]}]}", NULL};
    setenv("GIT_INDEX_FILE", index, 1); int normal_hash = run(hash_args), normal_index = run(index_args), normal_checkout = run(checkout_args), normal_graph = run(graph_args);
    printf("READY\n"); fflush(stdout); if (wait_line()) return 6;
    setenv("GIT_INDEX_FILE", index, 1); int swapped_hash = run(hash_args), swapped_index = run(index_args);
    setenv("GIT_INDEX_FILE", ownerindex, 1); int swapped_checkout = run(checkout_args), swapped_graph = run(graph_args);
    printf("{\"normalHash\":%d,\"normalIndex\":%d,\"normalCheckout\":%d,\"normalGraph\":%d,\"swappedHash\":%d,\"swappedIndex\":%d,\"swappedCheckout\":%d,\"swappedGraph\":%d}\n", normal_hash, normal_index, normal_checkout, normal_graph, swapped_hash, swapped_index, swapped_checkout, swapped_graph);
    close(root); return 0;
  }
  return 2;
}
