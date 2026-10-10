import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { resolveRoleRoute } from "./role-routing.ts";
import { accessSync, constants, realpathSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { Type } from "typebox";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { SubagentLoadout } from "../../vendor/pi-interactive-subagents/pi-extension/subagents/session.ts";

// Pi's loader retains the installed symlink path. Resolve the source entry
// before locating repo-bundled modules and the worker control extension.
const SOURCE = pathToFileURL(realpathSync(fileURLToPath(import.meta.url)));
const vendorPath = (name: string) => fileURLToPath(new URL(`../../vendor/pi-interactive-subagents/pi-extension/subagents/${name}`, SOURCE));

const CONTROLS = ["subagent", "subagent_message", "subagents_list"] as const;
const ENTRY = "delivery-tmux-owned-v1";
const CAPABILITIES = [...CONTROLS, "developer", "scout"];
const TEAM_ROLES = ["builder", "validator", "reviewer"] as const;
type Workflow = { kind: "team" } | { kind: "developer"; approvalRef: string; packetRef: string } |
  { kind: "scout"; discoveryAuthorityRef: string };
const nonempty = (value: unknown): value is string => typeof value === "string" && !!value.trim() && !value.includes("\0");
const isWorkflow = (value: unknown): value is Workflow => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return v.kind === "scout" ? Object.keys(v).length === 2 && nonempty(v.discoveryAuthorityRef) :
    v.kind === "team" ? Object.keys(v).length === 1 : v.kind === "developer" &&
    Object.keys(v).length === 3 && nonempty(v.approvalRef) && nonempty(v.packetRef);
};
const PACKET_FIELDS = ["purpose", "scope", "allowedPaths", "projectRules", "baseline", "validation", "acceptance", "task"] as const;
const reference = () => Type.String({ minLength: 1 });

// Optional declarations bind an assignment before its first launch. They are
// instruction metadata, not authenticated approval or measured active effort.
const AssignmentParams = Type.Object({
  id: reference(), scopeRef: reference(), approvalRef: reference(), packetRef: reference(),
  effortMinutes: Type.Number({ exclusiveMinimum: 0 }), repairAttempts: Type.Integer({ minimum: 0 }),
}, { additionalProperties: false });
const EscalationParams = Type.Object({
  from: reference(), runId: reference(),
  reason: Type.Union([Type.Literal("reasoning-complexity"), Type.Literal("failed-bounded-repair")]),
  partialSources: Type.Array(Type.Object({ path: reference(), sha256: Type.String({ pattern: "^[a-f0-9]{64}$" }) }, { additionalProperties: false }), { minItems: 1 }),
  findingsRef: reference(), failureEvidenceRef: reference(), remainingCriteria: reference(),
  remainingEffortMinutes: Type.Number({ exclusiveMinimum: 0 }), remainingRepairAttempts: Type.Integer({ minimum: 0 }),
  terminalState: Type.Union([Type.Literal("completed"), Type.Literal("cancelled"), Type.Literal("error")]),
  resourcesReleased: Type.Literal(true), resourceEvidenceRef: reference(),
}, { additionalProperties: false });
type Assignment = { id: string; scopeRef: string; approvalRef: string; packetRef: string; effortMinutes: number; repairAttempts: number };
type Escalation = { from: string; runId: string; reason: string; partialSources: Array<{path: string; sha256: string}>;
  findingsRef: string; failureEvidenceRef: string; remainingCriteria: string; remainingEffortMinutes: number;
  remainingRepairAttempts: number; terminalState: State; resourcesReleased: true; resourceEvidenceRef: string };
type Lineage = { version: 1; parent: string; rootName: string; role: string; workflow: Workflow;
  assignment: Assignment; authority: string; consumed: boolean; replacementName?: string; handoff?: Escalation };
const LINEAGE_ENTRY = "delivery-tmux-lineage-v1";
const exactKeys = (v: any, keys: string[]) => v && typeof v === "object" && !Array.isArray(v) &&
  Object.keys(v).length === keys.length && keys.every(key => Object.hasOwn(v, key));
const isAssignment = (v: any): v is Assignment => exactKeys(v, ["id", "scopeRef", "approvalRef", "packetRef", "effortMinutes", "repairAttempts"]) &&
  ["id", "scopeRef", "approvalRef", "packetRef"].every(k => nonempty(v[k])) &&
  Number.isFinite(v.effortMinutes) && v.effortMinutes > 0 && Number.isSafeInteger(v.repairAttempts) && v.repairAttempts >= 0;
const isEscalation = (v: any): v is Escalation => exactKeys(v, ["from", "runId", "reason", "partialSources", "findingsRef", "failureEvidenceRef",
  "remainingCriteria", "remainingEffortMinutes", "remainingRepairAttempts", "terminalState", "resourcesReleased", "resourceEvidenceRef"]) &&
  ["from", "runId", "findingsRef", "failureEvidenceRef", "remainingCriteria", "resourceEvidenceRef"].every(k => nonempty(v[k])) &&
  ["reasoning-complexity", "failed-bounded-repair"].includes(v.reason) &&
  ["completed", "cancelled", "error"].includes(v.terminalState) && v.resourcesReleased === true &&
  Number.isFinite(v.remainingEffortMinutes) && v.remainingEffortMinutes > 0 &&
  Number.isSafeInteger(v.remainingRepairAttempts) && v.remainingRepairAttempts >= 0 &&
  Array.isArray(v.partialSources) && v.partialSources.length > 0 && v.partialSources.every((s: any) =>
    exactKeys(s, ["path", "sha256"]) && nonempty(s.path) && typeof s.sha256 === "string" && /^[a-f0-9]{64}$/.test(s.sha256));

const DeveloperParams = Type.Object({
  selection: Type.Literal("Developer"), approvalRef: reference(), packetRef: reference(),
  assignment: Type.Optional(AssignmentParams), escalation: Type.Optional(EscalationParams),
  model: Type.Optional(Type.Union([Type.Literal("openai/gpt-5.6-terra"), Type.Literal("openai/gpt-5.6-sol")])),
  thinking: Type.Optional(Type.Union([Type.Literal("medium"), Type.Literal("high")])),
  packet: Type.Object(Object.fromEntries(PACKET_FIELDS.map(key => [key, reference()])), { additionalProperties: false }),
  name: Type.Optional(Type.String({ minLength: 1, maxLength: 80 })),
}, { additionalProperties: false });
const SCOUT_FIELDS = ["question", "rules", "exclusions", "budget", "resultContract"] as const;
const ScoutParams = Type.Object({
  assignment: Type.Optional(AssignmentParams), escalation: Type.Optional(EscalationParams),
  discoveryAuthorityRef: reference(),
  taskKind: Type.Optional(Type.Union([Type.Literal("lookup"), Type.Literal("analysis")])),
  profile: Type.Optional(Type.Union([Type.Literal("start"), Type.Literal("strong")])),
  model: Type.Optional(Type.Literal("openai/gpt-5.6-terra")),
  thinking: Type.Optional(Type.Union(["low", "medium"].map(level => Type.Literal(level)))),
  ...Object.fromEntries(SCOUT_FIELDS.map(key => [key, reference()])),
  sources: Type.Array(reference(), { minItems: 1 }),
  name: Type.Optional(Type.String({ minLength: 1, maxLength: 80 })),
}, { additionalProperties: false });
const TIMEOUT_MS = 20 * 60 * 1000;
const RESOURCES = { control: pathToFileURL(vendorPath("subagent-done.ts")).href,
  deny: ["extensions", "mcp", "skills", "prompt-templates", "themes", "context-files"] };
type State = "running" | "paused" | "completed" | "cancelled" | "error";
interface Owned {
  version: 1;
  parent: string;
  name: string;
  id: string;
  sessionFile: string;
  loadout: SubagentLoadout;
  state: State;
  resources: typeof RESOURCES;
  /** Absent on accepted v1 records means legacy Team, never Developer or Scout. */
  workflow?: Workflow;
  assignmentRoot?: string;
}

/** Opt-in current-session lead. No factory resources and no generic entry point. */
export default async function deliveryTmux(pi: ExtensionAPI) {
  const { registerDeliveryRuntime, hasDeliveryRun, cancelDeliveryRun } = await import(vendorPath("index.ts"));
  const { hasOwnedSurfaces } = await import(vendorPath("surface-ownership.ts"));
  const { DELIVERY_TOOLS, isSubagentLoadout, readSubagentLoadout } = await import(vendorPath("session.ts"));
  let context: ExtensionContext | undefined;
  let parent = "";
  let initialized = false;
  let reserved = false;
  let active: string | undefined;
  let failed = false;
  let launchWorkflow: Workflow | undefined;
  let launchRoot: string | undefined;
  const lineages = new Map<string, Lineage>();
  const persistLineage = (lineage: Lineage) => {
    try { pi.appendEntry(LINEAGE_ENTRY, lineage); }
    catch (error) { failed = true; throw error; }
    lineages.set(lineage.assignment.id, lineage);
  };
  const owned = new Map<string, Owned>();
  const knownRuns = new Set<string>();
  const shutdown: Array<(event: any, ctx: ExtensionContext) => unknown> = [];

  const persist = (record: Owned) => {
    try { pi.appendEntry(ENTRY, record); }
    catch (error) { failed = true; throw error; }
    owned.set(record.name, record);
  };
  const identity = (ctx: ExtensionContext) => `${ctx.sessionManager.getSessionId()}:${ctx.sessionManager.getSessionFile()}`;
  const assertContext = (ctx: ExtensionContext) => {
    if (!initialized || failed || identity(ctx) !== parent) throw new Error("Delivery runtime unavailable or ownership reconciliation required; no launch/control permitted");
  };
  const assertPinned = (record: Owned) => {
    const snapshot = readSubagentLoadout(record.sessionFile);
    if (!snapshot || JSON.stringify(snapshot) !== JSON.stringify(record.loadout)) {
      throw new Error("Owned saved loadout missing, changed, or invalid; refusing resume/control");
    }
  };

  pi.on("session_start", (event, ctx) => {
    // Public action APIs are bound here, not in the extension factory. Check
    // before initializing vendor reload/abort/ownership hooks or registering tools.
    if (!initialized) {
      const collisions = pi.getAllTools().filter(tool => CAPABILITIES.includes(tool.name as any));
      if (collisions.length) throw new Error(`Delivery control collision: ${collisions.map(tool => tool.name).join(", ")}; existing runtime left untouched`);
    }
    context = ctx;
    parent = identity(ctx);
    owned.clear(); lineages.clear(); active = undefined; reserved = false; failed = false;
    // Consumption is resource authority, not branch-sensitive conversation state.
    // Read only this parent session, including abandoned branches; never scan sessions.
    for (const entry of ctx.sessionManager.getEntries?.() ?? []) {
      if (entry.type !== "custom" || entry.customType !== LINEAGE_ENTRY) continue;
      const l = entry.data as Lineage;
      const previous = l?.assignment && lineages.get(l.assignment.id);
      if (!l || !exactKeys(l, ["version", "parent", "rootName", "role", "workflow", "assignment", "authority", "consumed", ...(l.consumed ? ["replacementName", "handoff"] : [])]) ||
          l.version !== 1 || l.parent !== parent || !isAssignment(l.assignment) || !isWorkflow(l.workflow) ||
          !nonempty(l.rootName) || !nonempty(l.authority) || !Object.hasOwn(DELIVERY_TOOLS, l.role) ||
          (l.workflow.kind === "developer" && (l.role !== "builder" || l.assignment.approvalRef !== l.workflow.approvalRef || l.assignment.packetRef !== l.workflow.packetRef)) ||
          (l.workflow.kind === "scout" && (l.role !== "scout" || l.assignment.approvalRef !== l.workflow.discoveryAuthorityRef || l.assignment.packetRef !== l.workflow.discoveryAuthorityRef)) ||
          ((l.role === "scout") !== (l.workflow.kind === "scout")) ||
          typeof l.consumed !== "boolean" || (l.consumed && (!nonempty(l.replacementName) || l.replacementName === l.rootName || !isEscalation(l.handoff) ||
            l.handoff.from !== l.rootName || l.handoff.remainingEffortMinutes > l.assignment.effortMinutes ||
            l.assignment.repairAttempts < 1 || l.handoff.remainingRepairAttempts > l.assignment.repairAttempts - 1)) ||
          (!l.consumed && (Object.hasOwn(l, "replacementName") || Object.hasOwn(l, "handoff"))) ||
          (previous && (previous.consumed || JSON.stringify({...previous, consumed: true, replacementName: l.replacementName, handoff: l.handoff}) !== JSON.stringify(l)))) {
        failed = true; continue;
      }
      lineages.set(l.assignment.id, l);
    }
    const boundNames = new Set([...lineages.values()].flatMap(l => [l.rootName, l.replacementName].filter(nonempty)));
    const isBoundOwned = (entry: any) => entry.type === "custom" && entry.customType === ENTRY &&
      (Object.hasOwn(entry.data ?? {}, "assignmentRoot") || boundNames.has(entry.data?.name));
    // Declared assignments are resource authority across this parent's branches.
    // Legacy/unbound ownership retains the accepted branch-scoped behavior.
    const ownershipEntries = [
      ...ctx.sessionManager.getBranch().filter(entry => !isBoundOwned(entry)),
      ...(ctx.sessionManager.getEntries?.() ?? []).filter(isBoundOwned),
    ];
    for (const entry of ownershipEntries) {
      if (entry.type !== "custom" || entry.customType !== ENTRY) continue;
      const record = entry.data as Owned;
      if (!record || record.version !== 1 || record.parent !== parent ||
          typeof record.name !== "string" || !record.name || typeof record.id !== "string" ||
          typeof record.sessionFile !== "string" || !isSubagentLoadout(record.loadout) ||
          !record.loadout.deliveryRole || record.loadout.agent !== record.loadout.deliveryRole ||
          (Object.hasOwn(record, "workflow") && (!isWorkflow(record.workflow) ||
            (record.workflow.kind === "developer" && record.loadout.deliveryRole !== "builder") ||
            (record.workflow.kind === "scout" && record.loadout.deliveryRole !== "scout"))) ||
          ([...lineages.values()].some(l => [l.rootName, l.replacementName].includes(record.name) && record.assignmentRoot !== l.assignment.id)) ||
          (Object.hasOwn(record, "assignmentRoot") && (!nonempty(record.assignmentRoot) ||
            !lineages.has(record.assignmentRoot) ||
            ![lineages.get(record.assignmentRoot)?.rootName, lineages.get(record.assignmentRoot)?.replacementName].includes(record.name) ||
            lineages.get(record.assignmentRoot)?.role !== record.loadout.deliveryRole ||
            JSON.stringify(lineages.get(record.assignmentRoot)?.workflow) !== JSON.stringify(record.workflow))) ||
          ((record.loadout.deliveryRole === "scout") !== (record.workflow?.kind === "scout")) ||
          JSON.stringify(record.resources) !== JSON.stringify(RESOURCES) ||
          !["running", "paused", "completed", "cancelled", "error"].includes(record.state)) {
        failed = true; continue;
      }
      owned.set(record.name, record);
    }
    for (const record of owned.values()) {
      if (record.state === "running" || record.state === "paused") {
        if (active) failed = true;
        active = record.name; // Unknown/crashed workers are never silently adopted/released.
      }
    }
    if (initialized) return;

    const proxy = new Proxy(pi, {
      get(target, key) {
        if (key === "on") return (name: string, handler: any) => {
          if (name === "session_shutdown") { shutdown.push(handler); return () => {}; }
          if (name === "session_start") { handler(event, ctx); return target.on(name, handler); }
          return target.on(name as any, handler);
        };
        if (key === "sendMessage") return (message: any, options: any) => target.sendMessage({
          ...message,
          content: typeof message.content === "string" ? message.content.slice(0, 16000) : message.content,
          details: message.details ? { ...message.details, task: undefined } : undefined,
        }, options);
        if (key === "registerTool") return (tool: any) => {
          if (!CONTROLS.includes(tool.name)) throw new Error("Unexpected delivery control");
          const description = tool.name === "subagent" ? "Team-only: after explicit Team selection and actual Agreement approval, launch one fixed delivery builder, validator, or reviewer in tmux. Role defaults or explicit model/thinking selection, optional strong initial profile; exact available model and supported effort required before allocation. Optional assignment binding declares original authority/scope/allowance; escalation requires one terminal same-role root and cited partial-source/findings/remaining allowance handoff, consumed before allocation even on failure. No automatic retries, budget reset, parallel workers or nesting. Results arrive automatically; completion is not acceptance." : tool.name === "subagents_list" ? "Inspect the four fixed bundled profiles (Team builder/validator/reviewer and separate read-only Scout). No project/global overrides. Explicit inspection only, not completion polling." : "Control or resume an owned delivery session by exact name. Matching runId/questionId replies release waiting, not pause. Pause preserves the pane; rearm requires new work; stop cancels. Saved resume replays pinned grants. Scout new work requires its original discoveryAuthorityRef. Developer new work requires the original approvalRef and packetRef; replies/pause/stop do not grant new work. Results arrive automatically.";
          const parameters = tool.name === "subagent" ? { ...tool.parameters,
            properties: { ...Object.fromEntries(Object.entries(tool.parameters.properties).filter(([name]) => name !== "cwd")),
              assignment: Type.Optional(AssignmentParams), escalation: Type.Optional(EscalationParams),
              profile: Type.Optional(Type.Union([Type.Literal("start"), Type.Literal("strong")])),
              thinking: Type.Optional(Type.Union(["none", "off", "minimal", "low", "medium", "high", "xhigh", "max"].map(level => Type.Literal(level)))) },
            additionalProperties: false } : tool.name === "subagent_message" ? { ...tool.parameters,
              properties: { ...tool.parameters.properties, approvalRef: reference(), packetRef: reference(), discoveryAuthorityRef: reference() },
              additionalProperties: false } : tool.parameters;
          const execute = async (id: string, params: any, signal: any, update: any, callCtx: ExtensionContext, workflow?: Workflow, authority = "") => {
              assertContext(callCtx);
              const launch = tool.name === "subagent";
              const control = tool.name === "subagent_message";
              let takingSlot = launch;
              let record: Owned | undefined;
              let nextLineage: Lineage | undefined;
              if (launch) {
                if (!(workflow?.kind === "scout" ? params.agent === "scout" : TEAM_ROLES.includes(params.agent)) || !Object.hasOwn(DELIVERY_TOOLS, params.agent) || Object.keys(params).some(key => !["agent", "task", "name", "model", "thinking", "profile", "taskKind", "assignment", "escalation"].includes(key))) throw new Error("Only fixed delivery roles and model/thinking selection are permitted");
                if (params.name && owned.has(params.name.trim())) throw new Error("Delivery name already owned; use owned resume");
                if (params.name && (!params.name.trim() || params.name.length > 80)) throw new Error("Delivery name must be nonempty and bounded to 80 characters");
                const route = resolveRoleRoute(params.agent, params, callCtx.modelRegistry, workflow?.kind === "developer" || workflow?.kind === "scout");
                if (params.assignment !== undefined || params.escalation !== undefined) {
                  if (typeof callCtx.sessionManager.getEntries !== "function" || !isAssignment(params.assignment) || !nonempty(params.name)) throw new Error("Declared assignment requires complete binding, fresh name and durable session entries");
                  const binding = params.assignment as Assignment;
                  const wf = workflow ?? { kind: "team" };
                  if ((wf.kind === "developer" && (binding.approvalRef !== wf.approvalRef || binding.packetRef !== wf.packetRef)) ||
                      (wf.kind === "scout" && (binding.approvalRef !== wf.discoveryAuthorityRef || binding.packetRef !== wf.discoveryAuthorityRef))) throw new Error("Assignment must retain original workflow authority references");
                  // Developer/Scout retain immutable scope-bearing packet fields.
                  // Team declares actual Agreement/packet and scope refs explicitly.
                  authority = authority || binding.scopeRef;
                  const root = lineages.get(binding.id);
                  if (params.escalation === undefined) {
                    if (root) throw new Error("Assignment already declared; no fresh replay or budget reset");
                    nextLineage = { version: 1, parent, rootName: params.name.trim(), role: params.agent, workflow: wf, assignment: binding, authority, consumed: false };
                  } else {
                    const h = params.escalation as Escalation;
                    if (!isEscalation(h) || !root || root.consumed) throw new Error("Escalation requires declared provenance and one unconsumed root");
                    const original = owned.get(h.from);
                    if (!original || original.parent !== parent || original.assignmentRoot !== binding.id ||
                        original.name !== root.rootName || original.id !== h.runId ||
                        original.loadout.deliveryRole !== params.agent || root.role !== params.agent ||
                        JSON.stringify(root.assignment) !== JSON.stringify(binding) ||
                        JSON.stringify(root.workflow) !== JSON.stringify(wf) || root.authority !== authority) throw new Error("Escalation role, scope, parent, run or original approved references changed");
                    assertPinned(original);
                    if (original.state !== h.terminalState || hasDeliveryRun(original.name, original.id) ||
                        !["completed", "cancelled", "error"].includes(original.state)) throw new Error("Escalation requires reconciled terminal worker; active/waiting/paused refused");
                    if (h.remainingEffortMinutes > binding.effortMinutes || binding.repairAttempts < 1 ||
                        h.remainingRepairAttempts > binding.repairAttempts - 1) throw new Error("Escalation cannot reset or exceed remaining effort/repair allowance");
                    for (const source of h.partialSources) {
                      const actual = createHash("sha256").update(readFileSync(resolve(callCtx.cwd, source.path))).digest("hex");
                      if (actual !== source.sha256) throw new Error("Escalation partial source identity changed: " + source.path);
                    }
                    nextLineage = { ...root, consumed: true, replacementName: params.name.trim(), handoff: h };
                  }
                }
                const { profile, taskKind, assignment, escalation, ...launchParams } = params;
                if (nextLineage) launchParams.task += "\\nDeclared assignment (no budget reset): " + JSON.stringify(nextLineage);
                params = { ...launchParams, name: params.name?.trim(), cwd: callCtx.cwd, ...route };
              }
              if (control) {
                if (Object.keys(params).some(key => !["name", "message", "runId", "questionId", "action", "approvalRef", "packetRef", "discoveryAuthorityRef"].includes(key))) throw new Error("Only owned delivery control fields are permitted");
                // A correlated answer releases waiting, never interruption. Reject
                // ambiguous reply/rearm before touching either worker's state.
                const correlated = Object.hasOwn(params, "runId") || Object.hasOwn(params, "questionId");
                if (params.action === "rearm" && correlated) throw new Error("Correlated reply and rearm must be separate requests");
                // Presence cannot exempt ordinary work from its authority checks.
                // Validate before transport, saved resume, or any slot/state mutation;
                // the fixed runtime still checks exact pending run/question IDs.
                if (correlated && (!Object.hasOwn(params, "runId") || !Object.hasOwn(params, "questionId") ||
                    !nonempty(params.runId) || !nonempty(params.questionId))) {
                  throw new Error("Correlation requires both nonempty runId and questionId strings; malformed replies refused");
                }
                record = owned.get(params.name?.trim());
                if (!record || record.parent !== parent) throw new Error("Target is not owned by this delivery session; registry adoption refused");
                assertPinned(record);
                const newWork = params.action !== "pause" && params.action !== "stop" && !correlated;
                if (newWork && record.assignmentRoot && lineages.get(record.assignmentRoot)?.consumed &&
                    lineages.get(record.assignmentRoot)?.replacementName !== record.name) throw new Error("Consumed assignment root cannot resume new work; use its pinned replacement");
                if (record.workflow?.kind === "developer" && newWork &&
                    (params.approvalRef !== record.workflow.approvalRef || params.packetRef !== record.workflow.packetRef)) {
                  throw new Error("Developer new work requires original approved packet and approval references; no Team authority substitution");
                }
                if (record.workflow?.kind === "scout" && newWork &&
                    params.discoveryAuthorityRef !== record.workflow.discoveryAuthorityRef) {
                  throw new Error("Scout new work requires original discovery authority reference; no Team/Developer substitution");
                }
                if (record.workflow?.kind !== "scout" && Object.hasOwn(params, "discoveryAuthorityRef")) {
                  throw new Error("Scout authority cannot convert legacy/Team/Developer ownership");
                }
                const lineage = record.assignmentRoot && lineages.get(record.assignmentRoot);
                if (lineage && record.workflow?.kind === "team" && newWork &&
                    (params.approvalRef !== lineage.assignment.approvalRef || params.packetRef !== lineage.assignment.packetRef)) {
                  throw new Error("Declared Team new work requires original approved assignment references");
                }
                if (record.workflow?.kind !== "developer" && !(lineage && record.workflow?.kind === "team") &&
                    (Object.hasOwn(params, "approvalRef") || Object.hasOwn(params, "packetRef"))) {
                  throw new Error("Developer authority cannot convert legacy/Team ownership");
                }
                const live = hasDeliveryRun(record.name, record.id);
                takingSlot = !live;
                if (!live && record.state === "paused" && params.action === "stop") {
                  cancelDeliveryRun(record.name, record.id, "explicit stop of preserved paused pane");
                  if (owned.get(record.name)?.state !== "cancelled") throw new Error("Paused ownership unresolved; shutdown reconciliation required");
                  return { content: [{ type: "text", text: "Preserved paused worker cancelled." }], details: { status: "cancelled", name: record.name } };
                }
                if (takingSlot && (record.state === "running" || record.state === "paused")) throw new Error("Owned worker is unresolved/paused without a live watcher; reconcile shutdown before saved resume");
              }
              if (takingSlot) {
                if (reserved || active) throw new Error("One delivery worker already active/reserved (paused and waiting hold the slot)");
                if (hasOwnedSurfaces()) throw new Error("Owned pane cleanup unresolved; refusing another worker until teardown succeeds");
                // Persist reservation/consumption BEFORE runtime allocation. Never roll
                // it back on transport, persistence, teardown or provider failure.
                if (nextLineage) persistLineage(nextLineage);
                launchRoot = nextLineage?.assignment.id ?? record?.assignmentRoot;
                reserved = true; // Synchronous, before the first await, including sibling calls.
                launchWorkflow = workflow ?? record?.workflow ?? { kind: "team" };
              }
              try {
                const result = await tool.execute(id, params, signal, update, callCtx);
                if (control && record && !result.details?.error) {
                  if (params.action === "pause") persist({ ...record, state: "paused" });
                  else if (params.action === "rearm" && !takingSlot) persist({ ...record, state: "running" });
                }
                if (result.details?.error) throw new Error(result.details.error);
                return result;
              } catch (error) {
                if (takingSlot && active) {
                  const launched = owned.get(active);
                  if (launched && !hasDeliveryRun(launched.name, launched.id)) {
                    persist({ ...launched, state: "cancelled" }); active = undefined;
                  }
                }
                throw error;
              } finally { if (takingSlot) { reserved = false; launchWorkflow = undefined; launchRoot = undefined; } }
          };
          target.registerTool({ ...tool, parameters, description, promptSnippet: description,
            exposure: "model-only", executionMode: "sequential", execute });
          if (tool.name === "subagent") {
            const scoutDescription = "Scripts first for deterministic extraction/counting. Launch ONE fixed read-only Scout for bounded discovery/analysis or execution investigation; optional taskKind lookup, omitted or analysis uses Terra/low; profile strong uses Terra/medium, with narrow candidate model/thinking choices validated before allocation without Developer/Team selection. Require discoveryAuthorityRef, focused question, accessible supplied local sources, rules, exclusions, budget and cited resultContract. Lead verifies actual permission: declaration metadata does not authenticate consent or grant unrestricted private-data access. Only read/grep/find/ls/codemode/ask_question; no shell, mutation, web, nesting, process control or acceptance. Shares the owned reserved/active slot, including waiting/paused workers. Results arrive automatically; control by exact owned name through subagent_message. Optional assignment and escalation bind one fresh same-role replacement to original discovery authority, terminal teardown evidence, partial source hashes and remaining allowance; no automatic retry or budget reset.";
            target.registerTool({ name: "scout", label: "Scout", description: scoutDescription,
              promptSnippet: scoutDescription, parameters: ScoutParams,
              exposure: "model-only", executionMode: "sequential",
              async execute(id, params: any, signal, update, callCtx) {
                assertContext(callCtx);
                if (!params || Object.keys(params).some(key => !["discoveryAuthorityRef", ...SCOUT_FIELDS, "sources", "name", "taskKind", "profile", "model", "thinking", "assignment", "escalation"].includes(key)) ||
                    !nonempty(params.discoveryAuthorityRef) || !SCOUT_FIELDS.every(key => nonempty(params[key])) ||
                    !Array.isArray(params.sources) || !params.sources.length || !params.sources.every(nonempty) ||
                    (Object.hasOwn(params, "name") && (!nonempty(params.name) || params.name.length > 80))) {
                  throw new Error("Scout requires explicit discovery authority and a complete bounded supplied-source packet; no overrides");
                }
                // Accessibility is a preflight check, not authorization of private data.
                const sources = params.sources.map((path: string) => resolve(callCtx.cwd, path));
                for (const path of sources) {
                  try { accessSync(path, constants.R_OK); }
                  catch { throw new Error("Scout supplied source inaccessible: " + path); }
                }
                const task = "Read-only Scout: investigate only this bounded packet. Lead verifies actual permission; metadata is not authenticated consent. No Developer or Team selection required. No acceptance authority.\nDiscovery authority: " + params.discoveryAuthorityRef +
                  "\nSources:\n" + sources.join("\n") +
                  SCOUT_FIELDS.map(key => "\n## " + key + "\n" + params[key]).join("\n");
                return execute(id, { agent: "scout", name: params.name, task, assignment: params.assignment, escalation: params.escalation, taskKind: params.taskKind, profile: params.profile, model: params.model, thinking: params.thinking }, signal, update, callCtx,
                  { kind: "scout", discoveryAuthorityRef: params.discoveryAuthorityRef }, JSON.stringify([params.question, sources, params.rules, params.exclusions, params.budget, params.resultContract]));
              },
            });
            const developerDescription = "Only after explicit user Developer selection and compact task approval, launch ONE fixed builder in tmux. Supply approval/packet references and full purpose, scope/allowed paths, project rules, baseline, validation and acceptance. References are instruction-based declarations, not authentication of user consent. No Team documents required; no role/cwd/tool/CLI overrides. New launches use builder role defaults or optional independent model/thinking restricted to candidate builder profiles, validated before allocation. Saved sessions retain pinned model/thinking. Shares Team's owned slot; results arrive automatically. Parent inspects changes/evidence and alone accepts; completion is not acceptance. Control through subagent_message. Optional assignment and escalation bind one fresh builder replacement to original approval/packet/scope, terminal teardown evidence, partial source hashes and remaining allowance; consumption persists even on launch failure, never automatic retry or budget reset.";
            target.registerTool({ name: "developer", label: "Developer", description: developerDescription,
              promptSnippet: developerDescription, parameters: DeveloperParams,
              exposure: "model-only", executionMode: "sequential",
              async execute(id, params: any, signal, update, callCtx) {
                if (!params || Object.keys(params).some(key => !["selection", "approvalRef", "packetRef", "packet", "name", "model", "thinking", "assignment", "escalation"].includes(key)) ||
                    params.selection !== "Developer" || !nonempty(params.approvalRef) || !nonempty(params.packetRef) ||
                    !params.packet || typeof params.packet !== "object" || Array.isArray(params.packet) ||
                    Object.keys(params.packet).length !== PACKET_FIELDS.length ||
                    !PACKET_FIELDS.every(key => nonempty(params.packet[key])) ||
                    (Object.hasOwn(params, "name") && (!nonempty(params.name) || params.name.length > 80))) {
                  throw new Error("Developer requires explicit selection, approval/packet references and a complete bounded packet; no overrides");
                }
                const workflow: Workflow = { kind: "developer", approvalRef: params.approvalRef, packetRef: params.packetRef };
                const task = `Standalone Developer: implement only this approved compact packet. No Team artifact set is required. Parent alone inspects and accepts. Approval metadata is not authenticated user consent.\nApproval: ${params.approvalRef}\nPacket revision: ${params.packetRef}\n` +
                  PACKET_FIELDS.map(key => `\n## ${key}\n${params.packet[key]}`).join("\n");
                return execute(id, { agent: "builder", name: params.name, task, model: params.model, thinking: params.thinking, assignment: params.assignment, escalation: params.escalation }, signal, update, callCtx, workflow,
                  JSON.stringify(["purpose", "scope", "allowedPaths", "projectRules", "validation", "acceptance"].map(key => params.packet[key])));
              },
            });
          }
        };
        return Reflect.get(target, key);
      },
    });
    registerDeliveryRuntime(proxy, {
      get timeoutMs() {
        const lineage = launchRoot && lineages.get(launchRoot);
        const minutes = lineage ? (lineage.handoff?.remainingEffortMinutes ?? lineage.assignment.effortMinutes) : 20;
        return Math.min(TIMEOUT_MS, minutes * 60 * 1000);
      },
      onLaunch(record) {
        if (!context || !reserved) throw new Error("Unreserved delivery launch refused");
        const next: Owned = { ...record, version: 1, parent, state: "running", resources: RESOURCES,
          workflow: launchWorkflow ?? { kind: "team" }, ...(launchRoot ? { assignmentRoot: launchRoot } : {}) };
        persist(next); knownRuns.add(record.id); active = record.name;
      },
      onTerminal(name, id, state) {
        const record = owned.get(name);
        if (!record || record.id !== id) { failed = true; return; }
        if (state !== "paused") active = undefined;
        try { persist({ ...record, state }); } catch { /* Fail closed until reconciliation. */ }
      },
      resolveSession(name) {
        const record = owned.get(name);
        if (!record) return undefined;
        assertPinned(record);
        return { sessionFile: record.sessionFile, sessionId: null };
      },
    });
    initialized = true;
  });

  pi.on("session_shutdown", async (event, ctx) => {
    if (!initialized) return;
    // Intent before I/O; isolate failures so every owned cleanup gets a chance.
    const errors: unknown[] = [];
    for (const record of owned.values()) if (record.state === "running" || record.state === "paused") {
      if (!knownRuns.has(record.id)) { errors.push(new Error("Saved active worker ownership unresolved; cannot prove teardown")); continue; }
      try { cancelDeliveryRun(record.name, record.id, "parent teardown"); } catch (error) { errors.push(error); }
    }
    for (const handler of shutdown) {
      try { await handler(event, ctx); } catch (error) { errors.push(error); }
    }
    if (!errors.length) {
      for (const record of owned.values()) if (record.state === "running" || record.state === "paused") {
        try { persist({ ...record, state: "cancelled" }); } catch (error) { errors.push(error); }
      }
    }
    if (errors.length) { failed = true; throw new AggregateError(errors, "Delivery teardown incomplete; ownership retained for reconciliation"); }
    active = undefined; reserved = false;
  });
}
