#!/usr/bin/env bash
# codex-review.sh — run a read-only Codex review detached, with liveness checks
# instead of a hard timeout.
#
#   codex-review.sh start <run-dir> <repo-dir>
#       Reads the review brief from <run-dir>/brief.md and launches
#       `codex exec` (read-only sandbox) in the background. Returns at once.
#   codex-review.sh check <run-dir>
#       Blocks for up to CHECK_SECS (default 300), then prints one status line:
#         DONE exit=<n>        codex finished; final message in <run-dir>/review.md
#         RUNNING log=<bytes>  still producing output; call check again
#         HUNG idle=<secs>     no new output for IDLE_LIMIT_SECS; process killed
#       Call it in a loop until the status is not RUNNING.
#
# Environment:
#   CODEX_REVIEW_MODEL   default gpt-6.2-sol
#   CODEX_REVIEW_EFFORT  default high
#   CHECK_SECS           default 300 (one check-in every 5 minutes)
#   IDLE_LIMIT_SECS      default 600 (hung = no output for 10 minutes)
#
# The event stream (--json) goes to <run-dir>/codex.log, so log growth is the
# liveness signal. The prompt is fed on stdin from brief.md, which also keeps
# codex from blocking on an interactive stdin.

set -u

cmd=${1:-}
run=${2:-}
[ -n "$cmd" ] && [ -n "$run" ] || { echo "usage: $0 start <run-dir> <repo-dir> | check <run-dir>" >&2; exit 2; }

case "$cmd" in
start)
  repo=${3:-}
  [ -n "$repo" ] || { echo "start needs <repo-dir>" >&2; exit 2; }
  [ -s "$run/brief.md" ] || { echo "missing or empty $run/brief.md" >&2; exit 2; }
  command -v codex >/dev/null || { echo "codex not on PATH" >&2; exit 127; }
  rm -f "$run/review.md" "$run/codex.log" "$run/exit" "$run/pid" "$run/last_size" "$run/last_change"
  nohup bash -c '
    codex exec -m "$1" -c model_reasoning_effort="$2" -s read-only -C "$3" \
      --json -o "$4/review.md" - < "$4/brief.md" > "$4/codex.log" 2>&1
    echo $? > "$4/exit"
  ' _ "${CODEX_REVIEW_MODEL:-gpt-6.2-sol}" "${CODEX_REVIEW_EFFORT:-high}" "$repo" "$run" \
    > /dev/null 2>&1 &
  echo $! > "$run/pid"
  date +%s > "$run/last_change"
  echo 0 > "$run/last_size"
  echo "STARTED pid=$(cat "$run/pid")"
  ;;
check)
  [ -f "$run/pid" ] || { echo "no run in $run (call start first)" >&2; exit 2; }
  check_secs=${CHECK_SECS:-300}
  idle_limit=${IDLE_LIMIT_SECS:-600}
  waited=0
  while [ "$waited" -lt "$check_secs" ]; do
    [ -f "$run/exit" ] && break
    sleep 10
    waited=$((waited + 10))
  done
  if [ -f "$run/exit" ]; then
    echo "DONE exit=$(cat "$run/exit")"
    exit 0
  fi
  size=$(wc -c < "$run/codex.log" 2>/dev/null | tr -d ' ')
  size=${size:-0}
  now=$(date +%s)
  if [ "$size" != "$(cat "$run/last_size")" ]; then
    echo "$size" > "$run/last_size"
    echo "$now" > "$run/last_change"
  fi
  idle=$((now - $(cat "$run/last_change")))
  if [ "$idle" -ge "$idle_limit" ]; then
    pid=$(cat "$run/pid")
    pkill -P "$pid" 2>/dev/null
    kill "$pid" 2>/dev/null
    echo "HUNG idle=${idle}s (killed pid $pid)"
    exit 0
  fi
  echo "RUNNING log=${size}B idle=${idle}s"
  ;;
*)
  echo "unknown command: $cmd" >&2; exit 2
  ;;
esac
