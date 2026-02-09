import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getStats } from "../graph.js";

export function registerGetStats(server: McpServer) {
  server.tool(
    "graph_get_stats",
    "Get vault-wide statistics: note count, link count, tags, orphans, etc. Quick status check.",
    {},
    async () => {
      const stats = getStats();

      const text = [
        "Vault Statistics:",
        "",
        `- Total notes: ${stats.totalNotes}`,
        `- Total links: ${stats.totalLinks}`,
        `- Unique tags: ${stats.totalTags}`,
        `- Folders: ${stats.folders}`,
        `- Orphan notes: ${stats.orphanCount}`,
        `- Avg links/note: ${stats.avgLinksPerNote}`,
        `- Last refresh: ${stats.lastRefresh}`,
      ].join("\n");

      return { content: [{ type: "text" as const, text }] };
    }
  );
}
