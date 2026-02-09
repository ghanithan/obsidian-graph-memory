# obsidian-graph-memory

An [MCP](https://modelcontextprotocol.io/) server that exposes your Obsidian vault's graph structure as queryable tools for AI agents. It connects to the [Obsidian Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) plugin, builds an in-memory graph of notes and wikilinks, and lets agents traverse relationships, find paths, discover hubs, and more.

## Installation

### As an MCP server (recommended)

Add to your Claude Code config (`~/.claude.json`):

```json
{
  "mcpServers": {
    "graph-memory": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "obsidian-graph-memory"],
      "env": {
        "OBSIDIAN_API_KEY": "your-api-key",
        "OBSIDIAN_HOST": "http://localhost:27124"
      }
    }
  }
}
```

### Global install

```bash
npm install -g obsidian-graph-memory
```

### Run directly

```bash
npx obsidian-graph-memory
```

## Prerequisites

- [Obsidian](https://obsidian.md/) with the [Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) plugin enabled
- The REST API key from the plugin settings

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `OBSIDIAN_API_KEY` | Yes | — | API key from the Local REST API plugin |
| `OBSIDIAN_HOST` | No | `http://localhost:27123` | URL of the Obsidian REST API |
| `GRAPH_REFRESH_INTERVAL` | No | `5m` | Auto-refresh interval (e.g. `30s`, `5m`, `1h`) |

## Tools

### `graph_query_related`

Find notes within N hops of a given note via wikilinks. Use for context expansion — "what's related to X?"

| Parameter | Type | Required | Description |
|---|---|---|---|
| `note` | string | Yes | Name of the note (without `.md` extension) |
| `depth` | number | No | How many hops to traverse (1-3, default: 1) |

### `graph_find_path`

Find the shortest path between two notes via wikilinks. Use to discover connections — "how does A relate to B?"

| Parameter | Type | Required | Description |
|---|---|---|---|
| `from` | string | Yes | Starting note name |
| `to` | string | Yes | Target note name |

### `graph_get_hubs`

Get the most connected notes in the vault. Use to find central knowledge — "what are the key topics?"

| Parameter | Type | Required | Description |
|---|---|---|---|
| `topN` | number | No | Number of top hubs to return (1-50, default: 10) |

### `graph_get_orphans`

Get notes with zero links (neither linking to nor linked from any other note). Use to find gaps — "what's disconnected?"

No parameters.

### `graph_get_clusters`

Group notes by folder or tag. Use for topic overview — "what topics exist in the vault?"

| Parameter | Type | Required | Description |
|---|---|---|---|
| `by` | string | No | Group by `folder` or `tag` (default: `folder`) |

### `graph_get_stats`

Get vault-wide statistics: note count, link count, tags, orphans, etc. Quick status check.

No parameters.

### `graph_refresh`

Manually trigger a graph rebuild from the vault. Use after batch changes to notes.

No parameters.

## How It Works

1. On startup, the server fetches all markdown files from your vault via the Obsidian REST API
2. It parses each note for `[[wikilinks]]` and `#tags` (both frontmatter and inline)
3. An in-memory directed graph is built — nodes are notes, edges are wikilinks
4. Graph queries use BFS traversal following both outgoing and incoming links
5. The graph auto-refreshes on a configurable interval (default: 5 minutes)

## License

MIT
