import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getHubs } from "../graph.js";

const schema = {
  topN: z.number().min(1).max(50).default(10).describe("Number of top hubs to return"),
};

export function registerGetHubs(server: McpServer) {
  server.tool(
    "graph_get_hubs",
    "Get the most connected notes in the vault. Use to find central knowledge — \"what are the key topics?\"",
    schema,
    async ({ topN }) => {
      const hubs = getHubs(topN);

      if (hubs.length === 0) {
        return { content: [{ type: "text" as const, text: "No notes found in graph." }] };
      }

      let text = `Top ${Math.min(topN, hubs.length)} hub notes:\n\n`;
      text += "| # | Note | Path | Out | In | Total |\n";
      text += "|---|------|------|-----|-----|-------|\n";
      hubs.forEach((h, i) => {
        text += `| ${i + 1} | ${h.name} | ${h.path} | ${h.outgoing} | ${h.incoming} | ${h.total} |\n`;
      });

      return { content: [{ type: "text" as const, text }] };
    }
  );
}
