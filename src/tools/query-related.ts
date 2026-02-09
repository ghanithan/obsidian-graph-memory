import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getGraph, queryRelated } from "../graph.js";

const schema = {
  note: z.string().describe("Name of the note (without .md extension)"),
  depth: z.number().min(1).max(3).default(1).describe("How many hops to traverse (1-3)"),
};

export function registerQueryRelated(server: McpServer) {
  server.tool(
    "graph_query_related",
    "Find notes within N hops of a given note via wikilinks. Use for context expansion — \"what's related to X?\"",
    schema,
    async ({ note, depth }) => {
      const graph = getGraph();
      if (!graph.nodes.has(note)) {
        // Try case-insensitive match
        const match = [...graph.nodes.keys()].find(
          (k) => k.toLowerCase() === note.toLowerCase()
        );
        if (!match) {
          return {
            content: [{ type: "text" as const, text: `Note "${note}" not found in graph. Available notes: ${[...graph.nodes.keys()].slice(0, 20).join(", ")}${graph.nodes.size > 20 ? "..." : ""}` }],
          };
        }
        note = match;
      }

      const related = queryRelated(note, depth);
      if (related.length === 0) {
        return {
          content: [{ type: "text" as const, text: `No related notes found within ${depth} hop(s) of "${note}".` }],
        };
      }

      const grouped = new Map<number, typeof related>();
      for (const r of related) {
        if (!grouped.has(r.distance)) grouped.set(r.distance, []);
        grouped.get(r.distance)!.push(r);
      }

      let text = `Notes related to "${note}" (depth ${depth}):\n\n`;
      for (const [dist, notes] of [...grouped.entries()].sort((a, b) => a[0] - b[0])) {
        text += `**${dist} hop${dist > 1 ? "s" : ""}:**\n`;
        for (const n of notes) {
          text += `- ${n.name} (${n.path})\n`;
        }
        text += "\n";
      }

      return { content: [{ type: "text" as const, text }] };
    }
  );
}
