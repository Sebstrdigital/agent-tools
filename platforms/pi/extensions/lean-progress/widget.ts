import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";
import { counts, replayBranch, type TodoItem } from "../../vendor/pify-todo/src/todo.ts";
import { visibleWindow, type ThemeLike } from "../../vendor/pify-todo/src/widget.ts";

// Keep a scratchpad compact even with unusually long descriptions. /todos
// exposes full persisted text; this is only the editor-side projection.
export const MAX_ITEM_LINES = 3;

export function buildResponsiveWidgetLines(items: TodoItem[], theme: ThemeLike, width: number): string[] {
  if (items.length === 0 || items.every(item => item.status === "completed")) return [];
  width = Math.max(0, Math.floor(width));
  if (!width) return [];
  const dim = (text: string) => theme.fg("dim", text);
  const { completed, total } = counts(items);
  const { shown, before, after } = visibleWindow(items);
  const mark = (item: TodoItem) => item.status === "completed" ? "✔" : item.status === "in_progress" ? "▸" : "◻";
  // At very narrow widths a box would consume all available text columns.
  if (width < 8) return [dim(truncateToWidth(`todo ${completed}/${total}`, width, "")),
    ...shown.map(item => truncateToWidth(`${mark(item)} ${item.content}`, width, ""))];

  const inner = width - 2;
  const title = truncateToWidth(` todos ${completed}/${total} `, inner, "");
  const hint = inner >= visibleWidth(title) + visibleWidth(" /todos ") + 1 ? " /todos " : "";
  const lines = [dim(`╭${title}${"─".repeat(inner - visibleWidth(title) - visibleWidth(hint))}${hint}╮`)];
  const informationalRow = (text: string) => {
    const content = truncateToWidth(text, inner, "…");
    lines.push(dim(`│${content}${" ".repeat(inner - visibleWidth(content))}│`));
  };
  if (before) informationalRow(` … +${before} above`);
  const contentWidth = width - 6; // │ + space + marker + space + text + space + │
  for (const item of shown) {
    // Treat host wrapping as a best-effort helper, not a frame-width guarantee
    // (control whitespace and host versions can differ). Bound every physical
    // line before adding padding or the three-line preview limit.
    const wrapped = wrapTextWithAnsi(item.content, contentWidth)
      .map(line => truncateToWidth(line, contentWidth, ""));
    const textLines = wrapped.slice(0, MAX_ITEM_LINES);
    if (wrapped.length > MAX_ITEM_LINES) {
      textLines[MAX_ITEM_LINES - 1] = truncateToWidth(textLines[MAX_ITEM_LINES - 1], contentWidth - 1, "") + "…";
    }
    for (const [index, text] of textLines.entries()) {
      const marker = index === 0 ? mark(item) : " ";
      const padding = " ".repeat(Math.max(0, contentWidth - visibleWidth(text)));
      if (item.status === "completed") lines.push(dim(`│ ${marker} ${text}${padding} │`));
      else lines.push(`${dim("│ ")}${item.status === "in_progress" ? theme.fg("warning", marker) : marker} ${item.status === "in_progress" ? theme.bold(text) : text}${padding}${dim(" │")}`);
    }
  }
  if (after) informationalRow(` … +${after} more`);
  lines.push(dim(`╰${"─".repeat(inner)}╯`));
  return lines;
}

/** Adapt only the native todo widget. Native state writes, validation,
 * branch replay, restoration and commands stay in the pinned controller.
 */
export function responsiveTodoContext<T extends ExtensionContext>(ctx: T): T {
  if (!ctx.hasUI) return ctx;
  return {
    ...ctx,
    ui: {
      ...ctx.ui,
      setWidget(key, content, options) {
        if (key !== "todo" || typeof content !== "function") {
          ctx.ui.setWidget(key, content, options);
          return;
        }
        // The native controller has already persisted/replayed its snapshot
        // before rendering. Use that branch, never a parallel state store.
        const items = replayBranch(ctx.sessionManager.getBranch());
        if (!items.length || items.every(item => item.status === "completed")) {
          ctx.ui.setWidget(key, undefined, options);
          return;
        }
        ctx.ui.setWidget(key, (_tui, theme) => ({
          render: width => buildResponsiveWidgetLines(items, theme, width),
          invalidate() {}, // Stateless: theme helpers and width run afresh each render.
        }), options);
      },
    },
  };
}
