import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getOrphans } from "../graph.js";

export function registerGetOrphans(server: McpServer) {
  server.tool(
    "graph_get_orphans",
    "Get notes with zero links (neither linking to nor linked from any other note). Use to find gaps — \"what's disconnected?\"",
    {},
    async () => {
      const orphans = getOrphans();

      if (orphans.length === 0) {
        return { content: [{ type: "text" as const, text: "No orphan notes found — all notes have at least one link." }] };
      }

      let text = `${orphans.length} orphan note${orphans.length !== 1 ? "s" : ""} (no links in or out):\n\n`;
      for (const o of orphans) {
        text += `- ${o.name} (${o.path})\n`;
      }

      return { content: [{ type: "text" as const, text }] };
    }
  );
}
