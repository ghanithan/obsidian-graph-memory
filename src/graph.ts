/**
 * In-memory graph engine.
 * Builds an adjacency list from vault notes + wikilinks.
 * Provides BFS, shortest path, hub/orphan/cluster queries.
 */

import { listAllNotes, readNote } from "./obsidian-api.js";

export interface GraphNode {
  path: string;    // "Infrastructure/Obsidian Stack - Reference.md"
  name: string;    // "Obsidian Stack - Reference"
  folder: string;  // "Infrastructure"
  tags: string[];
  hasContent: boolean;
}

export interface Graph {
  nodes: Map<string, GraphNode>;          // name → node
  edges: Map<string, Set<string>>;        // name → outgoing linked names
  reverseEdges: Map<string, Set<string>>; // name → incoming linked names
  lastRefresh: Date;
}

let graph: Graph = {
  nodes: new Map(),
  edges: new Map(),
  reverseEdges: new Map(),
  lastRefresh: new Date(0),
};

/** Extract note name from path: "Infrastructure/Foo.md" → "Foo" */
function nameFromPath(path: string): string {
  const basename = path.split("/").pop() || path;
  return basename.replace(/\.md$/, "");
}

/** Extract folder from path: "Infrastructure/Foo.md" → "Infrastructure" */
function folderFromPath(path: string): string {
  const parts = path.split("/");
  return parts.length > 1 ? parts.slice(0, -1).join("/") : "";
}

/** Parse wikilinks from markdown content. Returns array of link targets. */
function parseWikilinks(content: string): string[] {
  const regex = /\[\[([^\]|#]+)(?:[|#][^\]]+)?\]\]/g;
  const links: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    links.push(match[1].trim());
  }
  return links;
}

/** Parse tags from markdown content (both inline #tag and frontmatter tags). */
function parseTags(content: string): string[] {
  const tags = new Set<string>();

  // Frontmatter tags (YAML)
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (fmMatch) {
    const fm = fmMatch[1];
    // tags: [tag1, tag2] or tags:\n  - tag1\n  - tag2
    const tagsLineMatch = fm.match(/^tags:\s*\[([^\]]*)\]/m);
    if (tagsLineMatch) {
      tagsLineMatch[1].split(",").forEach((t) => {
        const cleaned = t.trim().replace(/^["']|["']$/g, "").replace(/^#/, "");
        if (cleaned) tags.add(cleaned);
      });
    }
    // YAML list form
    const yamlListMatch = fm.match(/^tags:\s*\n((?:\s+-\s+.+\n?)*)/m);
    if (yamlListMatch) {
      yamlListMatch[1].match(/-\s+(.+)/g)?.forEach((line) => {
        const cleaned = line.replace(/^-\s+/, "").trim().replace(/^["']|["']$/g, "").replace(/^#/, "");
        if (cleaned) tags.add(cleaned);
      });
    }
  }

  // Inline tags: #tag (not inside code blocks or links)
  const bodyContent = fmMatch ? content.slice(fmMatch[0].length) : content;
  const inlineTagRegex = /(?:^|\s)#([a-zA-Z][a-zA-Z0-9_/-]*)/g;
  let match: RegExpExecArray | null;
  while ((match = inlineTagRegex.exec(bodyContent)) !== null) {
    tags.add(match[1]);
  }

  return [...tags];
}

/**
 * Build (or rebuild) the graph from the vault.
 */
export async function buildGraph(): Promise<Graph> {
  const newNodes = new Map<string, GraphNode>();
  const newEdges = new Map<string, Set<string>>();
  const newReverseEdges = new Map<string, Set<string>>();

  const paths = await listAllNotes();

  // Read all notes in parallel (batched to avoid overwhelming the API)
  const BATCH_SIZE = 20;
  const noteContents = new Map<string, string>();

  for (let i = 0; i < paths.length; i += BATCH_SIZE) {
    const batch = paths.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (p) => ({ path: p, content: await readNote(p) }))
    );
    for (const result of results) {
      if (result.status === "fulfilled") {
        noteContents.set(result.value.path, result.value.content);
      }
    }
  }

  // Build nodes
  for (const path of paths) {
    const name = nameFromPath(path);
    const content = noteContents.get(path) || "";
    newNodes.set(name, {
      path,
      name,
      folder: folderFromPath(path),
      tags: parseTags(content),
      hasContent: content.trim().length > 0,
    });
    newEdges.set(name, new Set());
    newReverseEdges.set(name, new Set());
  }

  // Build edges from wikilinks
  for (const [path, content] of noteContents) {
    const sourceName = nameFromPath(path);
    const links = parseWikilinks(content);
    for (const target of links) {
      // Only add edge if target exists in vault
      if (newNodes.has(target)) {
        newEdges.get(sourceName)!.add(target);
        if (!newReverseEdges.has(target)) {
          newReverseEdges.set(target, new Set());
        }
        newReverseEdges.get(target)!.add(sourceName);
      }
    }
  }

  graph = {
    nodes: newNodes,
    edges: newEdges,
    reverseEdges: newReverseEdges,
    lastRefresh: new Date(),
  };

  return graph;
}

export function getGraph(): Graph {
  return graph;
}

/**
 * BFS to find notes within N hops of a start note.
 * Follows both outgoing and incoming links (undirected traversal).
 */
export function queryRelated(startName: string, depth: number): { name: string; path: string; distance: number }[] {
  const results: { name: string; path: string; distance: number }[] = [];
  const visited = new Set<string>();
  const queue: { name: string; dist: number }[] = [{ name: startName, dist: 0 }];
  visited.add(startName);

  while (queue.length > 0) {
    const { name, dist } = queue.shift()!;
    if (dist > 0) {
      const node = graph.nodes.get(name);
      if (node) {
        results.push({ name, path: node.path, distance: dist });
      }
    }
    if (dist < depth) {
      // Follow both outgoing and incoming links
      const outgoing = graph.edges.get(name) || new Set();
      const incoming = graph.reverseEdges.get(name) || new Set();
      for (const neighbor of new Set([...outgoing, ...incoming])) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push({ name: neighbor, dist: dist + 1 });
        }
      }
    }
  }

  return results;
}

/**
 * BFS shortest path between two notes.
 * Returns the path as an array of note names, or null if no path.
 */
export function findPath(fromName: string, toName: string): string[] | null {
  if (fromName === toName) return [fromName];
  if (!graph.nodes.has(fromName) || !graph.nodes.has(toName)) return null;

  const visited = new Set<string>();
  const parent = new Map<string, string>();
  const queue: string[] = [fromName];
  visited.add(fromName);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const outgoing = graph.edges.get(current) || new Set();
    const incoming = graph.reverseEdges.get(current) || new Set();
    for (const neighbor of new Set([...outgoing, ...incoming])) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        parent.set(neighbor, current);
        if (neighbor === toName) {
          // Reconstruct path
          const path: string[] = [toName];
          let node = toName;
          while (parent.has(node)) {
            node = parent.get(node)!;
            path.unshift(node);
          }
          return path;
        }
        queue.push(neighbor);
      }
    }
  }

  return null;
}

/**
 * Get the most connected notes (by total in + out links).
 */
export function getHubs(topN: number): { name: string; path: string; outgoing: number; incoming: number; total: number }[] {
  const hubs: { name: string; path: string; outgoing: number; incoming: number; total: number }[] = [];

  for (const [name, node] of graph.nodes) {
    const outgoing = graph.edges.get(name)?.size || 0;
    const incoming = graph.reverseEdges.get(name)?.size || 0;
    hubs.push({ name, path: node.path, outgoing, incoming, total: outgoing + incoming });
  }

  hubs.sort((a, b) => b.total - a.total);
  return hubs.slice(0, topN);
}

/**
 * Get notes with zero links (both in and out).
 */
export function getOrphans(): { name: string; path: string }[] {
  const orphans: { name: string; path: string }[] = [];

  for (const [name, node] of graph.nodes) {
    const outgoing = graph.edges.get(name)?.size || 0;
    const incoming = graph.reverseEdges.get(name)?.size || 0;
    if (outgoing === 0 && incoming === 0) {
      orphans.push({ name, path: node.path });
    }
  }

  return orphans;
}

/**
 * Group notes by folder or tag.
 */
export function getClusters(by: "folder" | "tag"): { cluster: string; notes: { name: string; path: string }[] }[] {
  const groups = new Map<string, { name: string; path: string }[]>();

  for (const [name, node] of graph.nodes) {
    if (by === "folder") {
      const key = node.folder || "(root)";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push({ name, path: node.path });
    } else {
      // tag — a note can appear in multiple clusters
      if (node.tags.length === 0) {
        if (!groups.has("(untagged)")) groups.set("(untagged)", []);
        groups.get("(untagged)")!.push({ name, path: node.path });
      } else {
        for (const tag of node.tags) {
          if (!groups.has(tag)) groups.set(tag, []);
          groups.get(tag)!.push({ name, path: node.path });
        }
      }
    }
  }

  return [...groups.entries()]
    .map(([cluster, notes]) => ({ cluster, notes }))
    .sort((a, b) => b.notes.length - a.notes.length);
}

/**
 * Vault-wide statistics.
 */
export function getStats(): {
  totalNotes: number;
  totalLinks: number;
  totalTags: number;
  orphanCount: number;
  avgLinksPerNote: number;
  lastRefresh: string;
  folders: number;
} {
  let totalLinks = 0;
  const allTags = new Set<string>();
  const folders = new Set<string>();

  for (const [name, node] of graph.nodes) {
    totalLinks += graph.edges.get(name)?.size || 0;
    for (const tag of node.tags) allTags.add(tag);
    if (node.folder) folders.add(node.folder);
  }

  const totalNotes = graph.nodes.size;
  return {
    totalNotes,
    totalLinks,
    totalTags: allTags.size,
    orphanCount: getOrphans().length,
    avgLinksPerNote: totalNotes > 0 ? Math.round((totalLinks / totalNotes) * 100) / 100 : 0,
    lastRefresh: graph.lastRefresh.toISOString(),
    folders: folders.size,
  };
}
