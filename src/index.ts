#!/usr/bin/env node

/**
 * obsidian-graph-memory — MCP server exposing Obsidian vault graph structure.
 *
 * Connects to the Obsidian Local REST API, builds an in-memory graph of notes
 * and wikilinks, and exposes graph query tools to AI agents via MCP.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildGraph } from "./graph.js";
import { registerQueryRelated } from "./tools/query-related.js";
import { registerFindPath } from "./tools/find-path.js";
import { registerGetHubs } from "./tools/get-hubs.js";
import { registerGetOrphans } from "./tools/get-orphans.js";
import { registerGetClusters } from "./tools/get-clusters.js";
import { registerGetStats } from "./tools/get-stats.js";
import { registerRefresh } from "./tools/refresh.js";

function parseInterval(value: string | undefined): number {
  if (!value) return 5 * 60 * 1000; // default 5 minutes
  const match = value.match(/^(\d+)(ms|s|m|h)$/);
  if (!match) return 5 * 60 * 1000;
  const num = parseInt(match[1], 10);
  switch (match[2]) {
    case "ms": return num;
    case "s": return num * 1000;
    case "m": return num * 60 * 1000;
    case "h": return num * 60 * 60 * 1000;
    default: return 5 * 60 * 1000;
  }
}

async function main() {
  const server = new McpServer({
    name: "obsidian-graph-memory",
    version: "1.0.0",
  });

  // Register all tools
  registerQueryRelated(server);
  registerFindPath(server);
  registerGetHubs(server);
  registerGetOrphans(server);
  registerGetClusters(server);
  registerGetStats(server);
  registerRefresh(server);

  // Build initial graph
  console.error("[graph-memory] Building initial graph...");
  try {
    await buildGraph();
    console.error("[graph-memory] Graph built successfully.");
  } catch (err) {
    console.error("[graph-memory] Failed to build initial graph:", err);
    console.error("[graph-memory] Server will start anyway — use graph_refresh to retry.");
  }

  // Schedule periodic refresh
  const interval = parseInterval(process.env.GRAPH_REFRESH_INTERVAL);
  console.error(`[graph-memory] Auto-refresh every ${interval / 1000}s`);
  setInterval(async () => {
    try {
      await buildGraph();
      console.error("[graph-memory] Graph refreshed.");
    } catch (err) {
      console.error("[graph-memory] Refresh failed:", err);
    }
  }, interval);

  // Start MCP stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[graph-memory] MCP server running on stdio.");
}

main().catch((err) => {
  console.error("[graph-memory] Fatal error:", err);
  process.exit(1);
});
