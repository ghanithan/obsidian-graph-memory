/**
 * Obsidian Local REST API client.
 * Lists vault files recursively and reads note content.
 */

const OBSIDIAN_HOST = process.env.OBSIDIAN_HOST || "http://localhost:27123";
const OBSIDIAN_API_KEY = process.env.OBSIDIAN_API_KEY || "";

const headers = {
  Authorization: `Bearer ${OBSIDIAN_API_KEY}`,
  Accept: "application/json",
};

export interface VaultFile {
  path: string;
  isDirectory: boolean;
}

/**
 * List files in a vault directory. Directories end with '/'.
 */
async function listDir(dirPath: string): Promise<VaultFile[]> {
  const url = `${OBSIDIAN_HOST}/vault/${encodeURIComponent(dirPath).replace(/%2F/g, "/")}`;
  const urlWithSlash = url.endsWith("/") ? url : url + "/";
  const res = await fetch(urlWithSlash, { headers });
  if (!res.ok) {
    throw new Error(`Failed to list ${dirPath}: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as { files: string[] };
  const prefix = dirPath ? (dirPath.endsWith("/") ? dirPath : dirPath + "/") : "";
  return data.files.map((f) => ({
    path: f.endsWith("/") ? prefix + f.slice(0, -1) : prefix + f,
    isDirectory: f.endsWith("/"),
  }));
}

/**
 * Recursively list all markdown files in the vault.
 */
export async function listAllNotes(): Promise<string[]> {
  const notes: string[] = [];
  const queue: string[] = [""];

  while (queue.length > 0) {
    const dir = queue.shift()!;
    const entries = await listDir(dir);
    for (const entry of entries) {
      if (entry.isDirectory) {
        queue.push(entry.path);
      } else if (entry.path.endsWith(".md")) {
        notes.push(entry.path);
      }
    }
  }

  return notes;
}

/**
 * Read a note's content by vault-relative path.
 */
export async function readNote(path: string): Promise<string> {
  const url = `${OBSIDIAN_HOST}/vault/${encodeURIComponent(path).replace(/%2F/g, "/")}`;
  const res = await fetch(url, {
    headers: { ...headers, Accept: "text/markdown" },
  });
  if (!res.ok) {
    throw new Error(`Failed to read ${path}: ${res.status} ${res.statusText}`);
  }
  return res.text();
}
