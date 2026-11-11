import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { realpathSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { validateRequest, validateResult } from "./validation.ts";

const SOURCE = pathToFileURL(realpathSync(fileURLToPath(import.meta.url)));

// One question UI, not an approval broker or a second engineering workflow.
export default async function askUser(pi: ExtensionAPI) {
  const { default: upstream } = await import(fileURLToPath(new URL("../../vendor/pi-ask-user/index.ts", SOURCE)));
  const capture = (events: ExtensionAPI["events"]) => {
    let tool: any;
    upstream({
      events,
      registerTool(definition: any) {
        if (tool || definition.name !== "ask_user") throw new Error("Unexpected vendored ask_user registration");
        tool = definition;
      },
    } as ExtensionAPI);
    if (!tool) throw new Error("Missing vendored ask_user registration");
    return tool;
  };
  const base = capture(pi.events);
  let registered = false;
  let ready = false;

  pi.on("session_start", async () => {
    if (!registered) {
      if (pi.getAllTools().some(tool => tool.name === "ask_user")) {
        throw new Error("Conflicting ask_user tool; load only one question provider");
      }
      pi.registerTool({
        ...base,
        exposure: "model-only",
        executionMode: "sequential",
        description: "Ask one genuine unresolved question, or 2-4 independent questions, using keyboard choices or custom text. Use for consequential decisions or missing permissions, not for repeating settled approvals or mandatory PACE phase gates. An answer applies only to the displayed question and scope; no automatic commit, installation, private-data access or release. Cancel, timeout, skipped or invalid answers are not approval. Do not batch this question with dependent mutation calls. Keep sensitive data out of questions.",
        promptSnippet: "Collect a genuine unresolved user decision with keyboard choices, multi-select or custom text",
        promptGuidelines: [
          "Use ask_user for genuinely unresolved consequential decisions or permissions; do not ask again when the existing request already authorizes the understood task.",
          "Show the exact proposed scope and exclusions before asking for approval. A selection is scoped decision evidence, not broad authority.",
          "No compulsory questions between PACE phases. Continue ordinary in-scope diagnosis and repair under existing authority.",
          "Ask dependent questions later. Never batch an unresolved permission question with dependent mutation calls.",
          "Cancel, timeout, skipped entries, invalid answers and tool errors are not consent. Freeform text requires interpretation; do not map it automatically to Yes.",
          "Do not include secrets or private data in questions/context. Question text is visible on the event bus; full answers remain in normal tool/session details.",
        ],
        async execute(id, params, signal, onUpdate, ctx) {
          if (!ready) throw new Error("ask_user has not passed session preflight");
          const prompts = validateRequest(params);
          // Buffer outcome events until results pass validation. Block/unblock
          // notifications still run immediately, including on errors/aborts.
          const outcomes: { name: string; payload: any }[] = [];
          const events = {
            ...pi.events,
            emit(name: string, payload: any) {
              if (name === "ask:answered" || name === "ask:cancelled") outcomes.push({ name, payload });
              else pi.events.emit(name, payload);
            },
          } as ExtensionAPI["events"];
          // A per-call capture avoids shared response buffers even if an API
          // caller violates the model-facing sequential execution contract.
          const raw = capture(events);
          let result = await raw.execute(id, params, signal, onUpdate, ctx);
          if (signal?.aborted && result.details?.cancelled !== true) {
            result = {
              ...result,
              content: [{ type: "text", text: "User cancelled the question(s)" }],
              details: params.questions != null
                ? { ...result.details, answers: [], cancelled: true }
                : { ...result.details, response: null, cancelled: true },
            };
            outcomes.forEach(event => { event.name = "ask:cancelled"; });
          }
          validateResult(params, prompts, result.details);
          for (const event of outcomes) {
            // Always redact even if upstream's full-event env flag is enabled.
            const payload: any = { question: event.payload.question };
            if (event.payload.batch) payload.batch = { ...event.payload.batch };
            if (event.name === "ask:answered") payload.response = { kind: event.payload.response.kind };
            pi.events.emit(event.name, payload);
          }
          return result;
        },
      });
      registered = true;
    }
    ready = true;
  });
  pi.on("session_shutdown", async () => { ready = false; });
}
