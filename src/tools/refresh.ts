import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { buildGraph, getStats } from "../graph.js";

export function registerRefresh(server: McpServer) {
  server.tool(
    "graph_refresh",
    "Manually trigger a graph rebuild from the vault. Use after batch changes to notes.",
    {},
    async () => {
      const startTime = Date.now();
      await buildGraph();
      const elapsed = Date.now() - startTime;
      const stats = getStats();

      const text = [
        `Graph refreshed in ${elapsed}ms.`,
        "",
        `- Notes: ${stats.totalNotes}`,
        `- Links: ${stats.totalLinks}`,
        `- Tags: ${stats.totalTags}`,
      ].join("\n");

      return { content: [{ type: "text" as const, text }] };
    }
  );
}
