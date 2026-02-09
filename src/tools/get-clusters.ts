import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getClusters } from "../graph.js";

const schema = {
  by: z.enum(["folder", "tag"]).default("folder").describe("Group notes by folder or tag"),
};

export function registerGetClusters(server: McpServer) {
  server.tool(
    "graph_get_clusters",
    "Group notes by folder or tag. Use for topic overview — \"what topics exist in the vault?\"",
    schema,
    async ({ by }) => {
      const clusters = getClusters(by);

      if (clusters.length === 0) {
        return { content: [{ type: "text" as const, text: "No notes found in graph." }] };
      }

      let text = `Notes grouped by ${by} (${clusters.length} groups):\n\n`;
      for (const c of clusters) {
        text += `**${c.cluster}** (${c.notes.length} note${c.notes.length !== 1 ? "s" : ""}):\n`;
        for (const n of c.notes) {
          text += `  - ${n.name}\n`;
        }
        text += "\n";
      }

      return { content: [{ type: "text" as const, text }] };
    }
  );
}
