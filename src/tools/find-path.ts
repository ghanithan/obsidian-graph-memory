import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getGraph, findPath } from "../graph.js";

const schema = {
  from: z.string().describe("Starting note name"),
  to: z.string().describe("Target note name"),
};

export function registerFindPath(server: McpServer) {
  server.tool(
    "graph_find_path",
    "Find the shortest path between two notes via wikilinks. Use to discover connections — \"how does A relate to B?\"",
    schema,
    async ({ from, to }) => {
      const graph = getGraph();

      // Case-insensitive name resolution
      function resolve(name: string): string | null {
        if (graph.nodes.has(name)) return name;
        const match = [...graph.nodes.keys()].find(
          (k) => k.toLowerCase() === name.toLowerCase()
        );
        return match || null;
      }

      const resolvedFrom = resolve(from);
      const resolvedTo = resolve(to);

      if (!resolvedFrom) {
        return { content: [{ type: "text" as const, text: `Note "${from}" not found in graph.` }] };
      }
      if (!resolvedTo) {
        return { content: [{ type: "text" as const, text: `Note "${to}" not found in graph.` }] };
      }

      const path = findPath(resolvedFrom, resolvedTo);

      if (!path) {
        return {
          content: [{ type: "text" as const, text: `No path found between "${resolvedFrom}" and "${resolvedTo}". They are in disconnected parts of the graph.` }],
        };
      }

      const pathWithDetails = path.map((name) => {
        const node = graph.nodes.get(name);
        return `${name} (${node?.path || "?"})`;
      });

      const text = `Shortest path (${path.length - 1} hop${path.length - 1 !== 1 ? "s" : ""}):\n\n${pathWithDetails.join("\n  → ")}`;
      return { content: [{ type: "text" as const, text }] };
    }
  );
}
