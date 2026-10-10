import { getSupportedThinkingLevels } from "@earendil-works/pi-ai";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

export type DeliveryRole = "scout" | "builder" | "validator" | "reviewer";
export interface RouteChoice {
  model?: string;
  thinking?: string;
  profile?: "start" | "strong";
  taskKind?: "lookup" | "analysis";
}
// Unbenchmarked candidates, not an automatic retry ladder. No parent inheritance.
const TERRA = "openai/gpt-5.6-terra", SOL = "openai/gpt-5.6-sol";
const PROFILES = {
  scout: { start: [TERRA, "low"], strong: [TERRA, "medium"] },
  builder: { start: [SOL, "medium"], strong: [SOL, "high"] },
  validator: { start: [TERRA, "low"], strong: [SOL, "medium"] },
  reviewer: { start: [SOL, "medium"], strong: [SOL, "high"] },
} as const;
const narrow: Record<DeliveryRole, Record<string, readonly string[]>> = {
  scout: { [TERRA]: ["low", "medium"] },
  builder: { [TERRA]: ["medium"], [SOL]: ["medium", "high"] },
  validator: { [TERRA]: ["low"], [SOL]: ["medium"] },
  reviewer: { [SOL]: ["medium", "high", "xhigh"] },
};

/** Synchronous preflight against the host's authenticated availability snapshot.
 * Does not resolve credentials, call providers, allocate resources, or clamp effort.
 * Saved-session controls deliberately never call this new-launch resolver.
 */
export function resolveRoleRoute(role: DeliveryRole, choice: RouteChoice,
  registry: ExtensionContext["modelRegistry"], restricted = false) {
  if (!Object.hasOwn(PROFILES, role)) throw new Error("Unknown fixed delivery role");
  if (choice.profile !== undefined && !["start", "strong"].includes(choice.profile)) throw new Error("Invalid routing profile");
  if (choice.taskKind !== undefined && (role !== "scout" || !["lookup", "analysis"].includes(choice.taskKind))) throw new Error("Invalid Scout taskKind");
  for (const key of ["model", "thinking"] as const) {
    if (choice[key] !== undefined && (typeof choice[key] !== "string" || !choice[key]?.trim())) throw new Error("Invalid routing " + key);
  }
  const profile = choice.profile ?? "start";
  const defaults = PROFILES[role][profile];
  const model = choice.model ?? defaults[0];
  let thinking = choice.thinking ?? defaults[1];
  if (thinking === "none") thinking = "off";
  if (typeof model !== "string" || !/^[^/\s]+\/[^\s]+$/.test(model)) throw new Error("Model requires exact provider/model ID");
  if (/astra/i.test(model)) throw new Error("Astra is not permitted in delivery routing");
  if (restricted && !narrow[role][model]?.includes(thinking)) throw new Error("Model/thinking must match approved candidate " + role + " profiles");
  if (!registry || registry.getError()) throw new Error("Model registry unavailable: " + (registry?.getError() ?? "missing registry"));
  const slash = model.indexOf("/");
  const provider = model.slice(0, slash), id = model.slice(slash + 1);
  const found = registry.find(provider, id);
  if (!found || !registry.getAvailable().some(m => m.provider === provider && m.id === id)) {
    throw new Error("Model unavailable (unknown exact ID or authentication unavailable): " + model);
  }
  const supported = getSupportedThinkingLevels(found);
  if (!supported.includes(thinking as typeof supported[number])) throw new Error(`Unsupported thinking ${thinking} for ${model}; supported: ${supported.join(", ")}`);
  return { model, thinking };
}
