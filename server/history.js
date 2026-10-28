import { simpleGit } from "simple-git";
import fs from "node:fs/promises";

export async function readHistory(repoPath) {
  const path = await fs.realpath(repoPath);
  const git = simpleGit({
    baseDir: path,
    maxConcurrentProcesses: 4,
    timeout: { block: 30000 },
  });
  if (!(await git.checkIsRepo()))
    throw new Error("This directory is not a Git repository.");
  const log = await git.log(["--all", "--max-count=150", "--date=iso-strict"]);
  const commits = await Promise.all(
    log.all.map(async (c) => ({
      hash: c.hash,
      date: c.date,
      author: c.author_name,
      subject: c.message,
      patch: (
        await git.show([
          c.hash,
          "--format=",
          "--no-ext-diff",
          "--no-renames",
          "--no-textconv",
          "--unified=3",
        ])
      ).slice(0, 18000),
    })),
  );
  const deleted = [];
  for (const c of commits) {
    const files = await git
      .raw([
        "diff-tree",
        "--no-ext-diff",
        "--root",
        "--no-commit-id",
        "--name-only",
        "--diff-filter=D",
        "-r",
        c.hash,
      ])
      .catch(() => "");
    for (const file of files.trim().split("\n").filter(Boolean))
      deleted.push({
        file,
        hash: c.hash,
        date: c.date,
        author: c.author,
        subject: c.subject,
      });
  }

  // Aggregate active and departed files
  const filesMap = new Map();
  for (const d of deleted) {
    if (!filesMap.has(d.file)) {
      filesMap.set(d.file, {
        file: d.file,
        status: "deleted",
        lastTouched: d.date,
        author: d.author,
        summary: `Deleted in commit ${d.hash.slice(0, 7)}: "${d.subject}"`,
        commitsCount: 1,
      });
    } else {
      const entry = filesMap.get(d.file);
      entry.commitsCount++;
    }
  }

  try {
    const rawTracked = await git.raw(["ls-files"]);
    const trackedList = rawTracked.trim().split(/\r?\n/).filter(Boolean);
    for (const file of trackedList) {
      if (!filesMap.has(file)) {
        filesMap.set(file, {
          file,
          status: "active",
          lastTouched: null,
          author: null,
          summary: "Tracked active file in current branch repository tree.",
          commitsCount: 1,
        });
      }
    }
  } catch {}

  const files = Array.from(filesMap.values()).sort((a, b) =>
    a.file.localeCompare(b.file),
  );

  return {
    path,
    name: path.split(/[/\\]/).pop(),
    commits,
    deleted,
    files,
    mode: "local",
    scope:
      "Up to 150 commits reachable from local refs; patches capped at 18,000 characters. Deleted files, not function-level tombstones. Dangling commits are not scanned.",
  };
}

export async function getFileCommits(repoPath, filePath) {
  const path = await fs.realpath(repoPath);
  const git = simpleGit({
    baseDir: path,
    maxConcurrentProcesses: 4,
    timeout: { block: 30000 },
  });
  if (!(await git.checkIsRepo()))
    throw new Error("This directory is not a Git repository.");

  const log = await git.log([
    "--follow",
    "--max-count=20",
    "--date=iso-strict",
    "--",
    filePath,
  ]);

  if (!log.all.length) return [];

  const fileCommits = await Promise.all(
    log.all.map(async (c) => {
      let patch = "";
      try {
        patch = await git.show([
          c.hash,
          "--format=",
          "--no-ext-diff",
          "--no-renames",
          "--no-textconv",
          "--unified=3",
          "--",
          filePath,
        ]);
      } catch {
        patch = await git
          .show([
            c.hash,
            "--format=",
            "--no-ext-diff",
            "--no-renames",
            "--no-textconv",
            "--unified=3",
          ])
          .catch(() => "");
      }
      return {
        hash: c.hash,
        date: c.date,
        author: c.author_name,
        subject: c.message,
        patch: patch.slice(0, 10000),
      };
    }),
  );

  return fileCommits;
}

/**
 * Find commits that added OR removed a given symbol/snippet using git pickaxe (-S),
 * then supplement with subject-grep and patch-text fallback from the in-memory corpus.
 *
 * Returns up to 10 commits ordered newest→oldest, each with a focused patch excerpt.
 */
export async function getSymbolCommits(repoPath, symbol, commits) {
  const path = await fs.realpath(repoPath);
  const git = simpleGit({
    baseDir: path,
    maxConcurrentProcesses: 4,
    timeout: { block: 30000 },
  });
  if (!(await git.checkIsRepo()))
    throw new Error("This directory is not a Git repository.");

  const seen = new Set();
  const results = [];

  // 1. Pickaxe search: commits that added/removed lines containing the symbol
  const symbolTerm = symbol.trim();
  if (symbolTerm.length >= 3) {
    try {
      const pickaxeLog = await git.raw([
        "log",
        "--all",
        "--max-count=20",
        "--date=iso-strict",
        `--format=%H|%aI|%an|%s`,
        `-S${symbolTerm}`,
        "--no-textconv",
      ]);
      for (const line of pickaxeLog.trim().split("\n").filter(Boolean)) {
        const [hash, date, author, ...subjectParts] = line.split("|");
        if (!hash || seen.has(hash)) continue;
        seen.add(hash);
        let patch = "";
        try {
          patch = await git.show([
            hash,
            "--format=",
            "--no-ext-diff",
            "--no-renames",
            "--no-textconv",
            "--unified=5",
          ]);
        } catch {}
        results.push({
          hash,
          date,
          author,
          subject: subjectParts.join("|"),
          patch: patch.slice(0, 8000),
          source: "pickaxe",
        });
      }
    } catch {}
  }

  // 2. Grep the subject lines from the preloaded commit corpus for the symbol
  const lc = symbolTerm.toLowerCase();
  for (const c of commits) {
    if (seen.has(c.hash)) continue;
    const subjectHit = c.subject.toLowerCase().includes(lc);
    const patchHit = c.patch.toLowerCase().includes(lc);
    if (subjectHit || patchHit) {
      seen.add(c.hash);
      results.push({ ...c, source: subjectHit ? "subject" : "patch" });
    }
    if (results.length >= 12) break;
  }

  return results.slice(0, 10);
}

/**
 * For a deleted file, look at commits that came AFTER the deletion commit
 * and search for references to the same identifiers extracted from the deleted patch.
 * Returns evidence of potential replacements or an empty array if none found.
 */
export async function getDeletedFileReplacement(
  repoPath,
  deletedFile,
  deletionHash,
  deletionPatch,
  allCommits,
) {
  const path = await fs.realpath(repoPath);
  const git = simpleGit({
    baseDir: path,
    maxConcurrentProcesses: 4,
    timeout: { block: 30000 },
  });
  if (!(await git.checkIsRepo()))
    throw new Error("This directory is not a Git repository.");

  // Extract meaningful identifiers from deleted patch (function names, exports, class names)
  const identifiers = [];
  const namePattern =
    /(?:function\s+|export\s+(?:function|const|class)\s+|class\s+|const\s+|let\s+|var\s+)([A-Za-z_$][A-Za-z0-9_$]{2,})/g;
  let m;
  const searchText = deletionPatch || "";
  while ((m = namePattern.exec(searchText)) !== null) {
    const name = m[1];
    if (!identifiers.includes(name) && identifiers.length < 5)
      identifiers.push(name);
  }

  // Also extract the base filename without extension as a search term
  const baseName = deletedFile
    .split(/[/\\]/)
    .pop()
    .replace(/\.[^.]+$/, "");
  if (
    baseName &&
    baseName.length >= 3 &&
    !identifiers.includes(baseName)
  )
    identifiers.unshift(baseName);

  if (!identifiers.length) return { candidates: [], identifiers: [] };

  // Find the deletion commit date for ordering
  const deletionCommit = allCommits.find((c) => c.hash === deletionHash);
  const deletionDate = deletionCommit ? new Date(deletionCommit.date) : null;

  // Search commits AFTER the deletion for each identifier using pickaxe
  const seen = new Set([deletionHash]);
  const candidates = [];

  for (const identifier of identifiers.slice(0, 3)) {
    if (identifier.length < 3) continue;
    try {
      const pickaxeLog = await git.raw([
        "log",
        "--all",
        "--max-count=10",
        "--date=iso-strict",
        `--format=%H|%aI|%an|%s`,
        `-S${identifier}`,
        "--no-textconv",
      ]);
      for (const line of pickaxeLog.trim().split("\n").filter(Boolean)) {
        const [hash, date, author, ...subjectParts] = line.split("|");
        if (!hash || seen.has(hash)) continue;
        // Only include commits AFTER the deletion
        if (deletionDate && new Date(date) <= deletionDate) continue;
        seen.add(hash);
        let patch = "";
        try {
          patch = await git.show([
            hash,
            "--format=",
            "--no-ext-diff",
            "--no-renames",
            "--no-textconv",
            "--unified=5",
          ]);
        } catch {}
        candidates.push({
          hash,
          date,
          author,
          subject: subjectParts.join("|"),
          patch: patch.slice(0, 6000),
          matchedOn: identifier,
        });
      }
    } catch {}
    if (candidates.length >= 5) break;
  }

  // Supplement with corpus scan of commits after deletion
  for (const c of allCommits) {
    if (seen.has(c.hash)) continue;
    if (deletionDate && new Date(c.date) <= deletionDate) continue;
    const combined = `${c.subject} ${c.patch}`.toLowerCase();
    const matchedOn = identifiers.find(
      (id) => id.length >= 3 && combined.includes(id.toLowerCase()),
    );
    if (matchedOn) {
      seen.add(c.hash);
      candidates.push({ ...c, matchedOn });
    }
    if (candidates.length >= 8) break;
  }

  candidates.sort((a, b) => new Date(a.date) - new Date(b.date));

  return { candidates: candidates.slice(0, 6), identifiers };
}

export function retrieve(commits, question) {
  const stop = new Set([
    "why",
    "what",
    "was",
    "the",
    "did",
    "does",
    "this",
    "that",
    "how",
    "and",
    "for",
    "with",
    "file",
    "exist",
  ]);
  const words = (
    question.toLowerCase().match(/[a-z0-9_./-]{3,}/g) || []
  ).filter((w) => !stop.has(w));
  return commits
    .map((c) => ({
      ...c,
      score: words.reduce(
        (n, w) =>
          n +
          (c.subject.toLowerCase().includes(w) ? 4 : 0) +
          (c.patch.toLowerCase().includes(w) ? 1 : 0),
        0,
      ),
    }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

export function validCitations(text, commits) {
  return [...new Set(text.match(/\b[0-9a-f]{7,40}\b/g) || [])].filter((h) =>
    commits.some((c) => c.hash.startsWith(h)),
  );
}
