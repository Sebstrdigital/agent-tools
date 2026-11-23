// Experimental direct-tool guard. This is not a sandbox or a complete mutation guard.
export default function orchestratorWriteGuard(pi) {
  pi.on("tool_call", (event, ctx) => {
    if (event.toolName !== "edit" && event.toolName !== "write") return;

    // Unknown session identity must not be treated as permission to mutate.
    if (ctx.agent?.kind === "sub") return;
    if (event.toolName === "write" && typeof event.input?.path === "string" &&
        /^agent:\/\/[A-Za-z0-9_.-]+$/.test(event.input.path)) return;

    return {
      block: true,
      reason: "Experimental orchestrator guard: delegate direct file changes to a worker. Shell, eval, and external tools are not covered; this is not a sandbox.",
    };
  });
}
