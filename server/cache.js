import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const CACHE_DIR = path.join(__dirname, ".index_cache");

// Ensure cache directory exists
async function ensureCacheDir() {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch {}
}

export function getRepoCacheKey(repoPath) {
  return crypto.createHash("sha256").update(repoPath.trim().toLowerCase()).digest("hex").slice(0, 16);
}

export function getCacheFilePath(repoPath) {
  const key = getRepoCacheKey(repoPath);
  return path.join(CACHE_DIR, `${key}.json`);
}

/**
 * Load cached repository index and embeddings from disk if available.
 */
export async function loadCachedIndex(repoPath) {
  try {
    const file = getCacheFilePath(repoPath);
    const raw = await fs.readFile(file, "utf8");
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.commits)) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Save repository history and indexed embeddings to disk.
 * Security notice: keeps storage local to this machine.
 */
export async function saveCachedIndex(repoPath, { history, vectors, scanLimit = 150 }) {
  await ensureCacheDir();
  const file = getCacheFilePath(repoPath);

  // Map each commit with its vector (if available)
  const vectorMap = new Map();
  if (Array.isArray(vectors)) {
    history.commits.forEach((c, idx) => {
      if (vectors[idx]) vectorMap.set(c.hash, vectors[idx]);
    });
  }

  const payload = {
    version: 1,
    repoPath: history.path,
    repoName: history.name,
    savedAt: new Date().toISOString(),
    headCommit: history.commits[0]?.hash || null,
    scanLimit,
    warning: "Local index stored on machine. May contain sensitive historical code. Do not commit or share.",
    commits: history.commits.map((c) => ({
      hash: c.hash,
      date: c.date,
      author: c.author,
      subject: c.subject,
      patch: c.patch,
      vector: vectorMap.get(c.hash) || null,
    })),
    deleted: history.deleted || [],
    files: history.files || [],
  };

  await fs.writeFile(file, JSON.stringify(payload), "utf8");
  return {
    cachedAt: payload.savedAt,
    indexedCommitsCount: vectorMap.size,
    totalCommits: payload.commits.length,
  };
}

/**
 * Read cache metadata without loading full patches/vectors.
 */
export async function getCacheMetadata(repoPath) {
  try {
    const file = getCacheFilePath(repoPath);
    const stat = await fs.stat(file);
    const raw = await fs.readFile(file, "utf8");
    const partial = JSON.parse(raw);
    const indexedCount = partial.commits.filter((c) => Array.isArray(c.vector)).length;
    return {
      exists: true,
      sizeBytes: stat.size,
      savedAt: partial.savedAt,
      headCommit: partial.headCommit,
      scanLimit: partial.scanLimit || 150,
      totalCommits: partial.commits.length,
      indexedCount,
    };
  } catch {
    return { exists: false };
  }
}
