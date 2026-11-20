#!/usr/bin/env node
// Reads Stop/SessionEnd hook payload on stdin, parses the Claude Code
// transcript, and appends a cumulative session token snapshot to
// ~/.context-mode/token-log.jsonl.
//
// Must be fast (<50ms), must never block the session, silent on any error.

import { readFileSync, mkdirSync, appendFileSync } from "node:fs";
import { join, basename } from "node:path";
import { homedir } from "node:os";

const LOG_DIR = join(homedir(), ".context-mode");
const LOG_FILE = join(LOG_DIR, "token-log.jsonl");

try {
  const raw = readFileSync(0, "utf8");
  const payload = JSON.parse(raw);
  const { session_id, transcript_path, cwd, hook_event_name } = payload;
  if (!session_id || !transcript_path) process.exit(0);

  const transcript = readFileSync(transcript_path, "utf8");
  let cum_input = 0;
  let cum_output = 0;
  let cum_cache_read = 0;
  let cum_cache_create = 0;
  let last_ts = null;
  let model = null;

  for (const line of transcript.split("\n")) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      if (entry.type !== "assistant" || !entry.message?.usage) continue;
      const u = entry.message.usage;
      cum_input += u.input_tokens || 0;
      cum_output += u.output_tokens || 0;
      cum_cache_read += u.cache_read_input_tokens || 0;
      cum_cache_create += u.cache_creation_input_tokens || 0;
      last_ts = entry.timestamp || last_ts;
      model = entry.message.model || model;
    } catch {
      // skip malformed line
    }
  }

  mkdirSync(LOG_DIR, { recursive: true });
  const project = cwd ? basename(cwd) : "unknown";
  const record = {
    type: "turn_snapshot",
    ts: new Date().toISOString(),
    last_turn_ts: last_ts,
    session_id,
    project,
    model,
    hook: hook_event_name,
    cum_input,
    cum_output,
    cum_cache_read,
    cum_cache_create,
  };
  appendFileSync(LOG_FILE, JSON.stringify(record) + "\n");
} catch {
  // Silent — hooks must never block the session
  process.exit(0);
}
