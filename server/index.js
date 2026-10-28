import express from "express";
import {
  readHistory,
  retrieve,
  getFileCommits,
  getSymbolCommits,
  getDeletedFileReplacement,
} from "./history.js";
import {
  demo,
  demoExplainFile,
  demoExplainSymbol,
  demoTombstoneReplacement,
  getDemoAskAnswer,
} from "./demo.js";
import {
  status,
  embed,
  cosine,
  chat,
  inspectCitations,
  explainFile,
  explainSymbol,
  explainReplacement,
  parseAnswerSections,
} from "./ai.js";
import {
  loadCachedIndex,
  saveCachedIndex,
  getCacheMetadata,
} from "./cache.js";

const app = express();
app.use(express.json({ limit: "32kb" }));

// Browsers may only invoke the API from the same origin. No permissive CORS.
app.use("/api", (req, res, next) => {
  const origin = req.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== req.get("host"))
        return res
          .status(403)
          .json({ error: "Cross-origin repository access is not permitted." });
    } catch {
      return res.status(403).json({ error: "Invalid origin." });
    }
  }
  next();
});

const localEnabled = process.env.ENABLE_LOCAL_REPOS?.trim() === "true";
let history = demo,
  vectors = null,
  indexing = false,
  generating = false,
  indexingProgress = {
    active: false,
    current: 0,
    total: 0,
    scanLimit: 150,
    message: "Ready",
  };

const publicHistory = () => ({
  ...history,
  localEnabled,
  retrieval: vectors ? "hybrid" : "keyword",
  scanLimit: 150,
  headCommit: history.commits?.[0]?.hash || null,
  indexedCommitsCount: vectors ? vectors.filter(Boolean).length : 0,
});

app.get("/api/history", (_, res) => res.json(publicHistory()));

app.post("/api/repository", async (req, res) => {
  if (!localEnabled)
    return res
      .status(403)
      .json({
        error:
          "Local repository access is disabled. Run locally with ENABLE_LOCAL_REPOS=true.",
      });
  if (indexing || generating)
    return res
      .status(409)
      .json({ error: "Another operation is active. Please wait." });
  indexing = true;
  try {
    if (typeof req.body.path !== "string" || !req.body.path.trim())
      throw Error("Enter a repository path.");
    const repoPath = req.body.path.trim();

    // Check if we already have a persistent index on disk
    const cached = await loadCachedIndex(repoPath);
    if (cached && !req.body.forceFresh) {
      history = {
        path: cached.repoPath,
        name: cached.repoName,
        commits: cached.commits.map(({ vector, ...c }) => c),
        deleted: cached.deleted || [],
        files: cached.files || [],
        mode: "local",
        scope: `Restored persistent local index (${cached.commits.length} commits, saved ${new Date(cached.savedAt).toLocaleDateString()}). Scan limit: ${cached.scanLimit || 150}.`,
        lastIndexedAt: cached.savedAt,
      };
      const hasVectors = cached.commits.some((c) => Array.isArray(c.vector));
      if (hasVectors) {
        vectors = cached.commits.map((c) => c.vector || null);
      } else {
        vectors = null;
      }
      return res.json({
        ...publicHistory(),
        restoredFromCache: true,
        lastIndexedAt: cached.savedAt,
      });
    }

    const loaded = await readHistory(repoPath);
    history = loaded;
    vectors = null;
    await saveCachedIndex(repoPath, { history, vectors: null, scanLimit: 150 });
    res.json(publicHistory());
  } catch (e) {
    res.status(400).json({ error: e.message });
  } finally {
    indexing = false;
  }
});

app.post("/api/demo", (_, res) => {
  if (indexing || generating)
    return res
      .status(409)
      .json({ error: "Please wait for the active operation." });
  history = demo;
  vectors = null;
  res.json(publicHistory());
});

app.get("/api/status", async (_, res) =>
  res.json({
    ...(await status()),
    indexing,
    generating,
    indexingProgress,
    scanLimit: 150,
    headCommit: history.commits?.[0]?.hash || null,
  }),
);

// ── Incremental Indexing ────────────────────────────────────────────────────
app.post("/api/index", async (req, res) => {
  if (!localEnabled || history.mode !== "local")
    return res.status(400).json({ error: "Connect a local repository first." });
  if (indexing || generating)
    return res.status(409).json({ error: "An operation is already active." });
  indexing = true;
  const scanLimit = req.body.scanLimit || 150;
  try {
    // Preserve any existing embeddings (incremental indexing)
    const existingVectorMap = new Map();
    if (Array.isArray(vectors)) {
      history.commits.forEach((c, idx) => {
        if (vectors[idx]) existingVectorMap.set(c.hash, vectors[idx]);
      });
    }

    const unindexedCommits = history.commits.filter((c) => !existingVectorMap.has(c.hash));
    indexingProgress = {
      active: true,
      current: 0,
      total: unindexedCommits.length,
      scanLimit,
      message: unindexedCommits.length === 0
        ? "All commits already indexed."
        : `Embedding ${unindexedCommits.length} commits...`,
    };

    let processed = 0;
    for (let i = 0; i < unindexedCommits.length; i += 8) {
      const batch = unindexedCommits.slice(i, i + 8);
      indexingProgress.current = processed;
      indexingProgress.message = `Embedding commits ${processed + 1}–${Math.min(processed + batch.length, unindexedCommits.length)} of ${unindexedCommits.length}…`;
      const embeddings = await embed(
        batch.map((c) => `${c.subject}\n${c.patch.slice(0, 6000)}`),
      );
      if (embeddings.length !== batch.length)
        throw Error("Incomplete embedding batch");
      batch.forEach((c, bIdx) => {
        existingVectorMap.set(c.hash, embeddings[bIdx]);
      });
      processed += batch.length;
      indexingProgress.current = processed;
    }

    // Align vectors with history.commits
    vectors = history.commits.map((c) => existingVectorMap.get(c.hash) || null);

    // Save to persistent cache
    const saveMeta = await saveCachedIndex(history.path, { history, vectors, scanLimit });
    indexingProgress.message = `Successfully saved ${vectors.filter(Boolean).length} embeddings to local cache.`;

    res.json({
      indexed: vectors.filter(Boolean).length,
      newlyIndexed: unindexedCommits.length,
      totalCommits: history.commits.length,
      retrieval: "hybrid",
      savedAt: saveMeta.cachedAt,
      scanLimit,
      warning: "Index stored locally. May contain sensitive historical code.",
    });
  } catch (e) {
    res.status(503).json({
      error: `Semantic index failed: ${e.message}. Keyword search is still available.`,
    });
  } finally {
    indexing = false;
    indexingProgress.active = false;
  }
});

// ── Refresh Repository History (Incremental) ────────────────────────────────
app.post("/api/refresh", async (_, res) => {
  if (!localEnabled || history.mode !== "local")
    return res.status(400).json({ error: "Connect a local repository first." });
  if (indexing || generating)
    return res.status(409).json({ error: "An operation is already active." });
  indexing = true;
  try {
    const freshHistory = await readHistory(history.path);
    const existingHashes = new Set(history.commits.map((c) => c.hash));
    const newCommits = freshHistory.commits.filter((c) => !existingHashes.has(c.hash));

    // Preserve embeddings for previously indexed commits
    const existingVectorMap = new Map();
    if (Array.isArray(vectors)) {
      history.commits.forEach((c, idx) => {
        if (vectors[idx]) existingVectorMap.set(c.hash, vectors[idx]);
      });
    }

    history = freshHistory;
    vectors = freshHistory.commits.map((c) => existingVectorMap.get(c.hash) || null);

    // Persist to local cache
    const saveMeta = await saveCachedIndex(history.path, { history, vectors, scanLimit: 150 });

    res.json({
      ...publicHistory(),
      newCommitsCount: newCommits.length,
      totalCommits: freshHistory.commits.length,
      lastIndexedAt: saveMeta.cachedAt,
      message: newCommits.length
        ? `Found ${newCommits.length} new commit(s). Index refreshed.`
        : "Repository is up to date. No new commits found.",
    });
  } catch (e) {
    res.status(400).json({ error: `Refresh failed: ${e.message}` });
  } finally {
    indexing = false;
  }
});

// ── Ask the Ghost (Commune) ─────────────────────────────────────────────────
app.post("/api/ask", async (req, res) => {
  const question = req.body.question;
  if (
    typeof question !== "string" ||
    !question.trim() ||
    question.length > 2000
  )
    return res
      .status(400)
      .json({ error: "Ask a question between 1 and 2,000 characters." });
  if (indexing || generating)
    return res
      .status(409)
      .json({ error: "Another operation is active. Please wait." });

  // Revision metadata for export and tracking
  const revision = {
    repoName: history.name,
    headCommit: history.commits?.[0]?.hash || null,
    headSubject: history.commits?.[0]?.subject || null,
    analyzedAt: new Date().toISOString(),
  };

  if (history.mode === "demo") {
    const demoResult = getDemoAskAnswer(
      question,
      req.body.commitHash,
      req.body.epitaph === true,
    );
    const checks = inspectCitations(demoResult.answer, demoResult.sources);
    return res.json({
      mode: "demo",
      question,
      answer: demoResult.answer,
      evidence: demoResult.evidence,
      interpretation: demoResult.interpretation,
      unknown: demoResult.unknown,
      sources: demoResult.sources,
      ...checks,
      retrieval: "demo",
      revision,
      warning:
        "Illustrative, rule-based demo—not model output or real repository history.",
    });
  }

  generating = true;
  try {
    let sources = retrieve(history.commits, question),
      retrieval = "keyword";
    if (req.body.commitHash) {
      const found = history.commits.find((c) => c.hash === req.body.commitHash);
      if (!found) return res.status(400).json({ error: "Unknown commit." });
      sources = [found];
      retrieval = "exact commit";
    } else if (vectors) {
      const [query] = await embed([question]);
      const lexical = retrieve(history.commits, question);
      const lexicalRank = new Map(lexical.map((c, i) => [c.hash, i]));
      sources = history.commits
        .map((c, i) => ({
          ...c,
          score:
            cosine(vectors[i], query) +
            (lexicalRank.has(c.hash)
              ? 0.12 / (lexicalRank.get(c.hash) + 1)
              : 0),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
      retrieval = "hybrid";
    }

    if (!sources.length)
      return res.json({
        mode: "local",
        question,
        answer:
          "No matching evidence was found. Try a filename, symbol, or a phrase from the commit message.",
        evidence: "No commits in the scanned range matched this query.",
        interpretation: "The queried topic may not have been altered within the current scan limit.",
        unknown: "All facts regarding this query remain outside the available evidence scope.",
        sources: [],
        citations: [],
        retrieval,
        revision,
      });

    const rawAnswer = await chat(question, sources, {
      epitaph: req.body.epitaph === true,
    });
    const checks = inspectCitations(rawAnswer, sources);
    if (checks.invalidCitations.length)
      return res
        .status(502)
        .json({
          error:
            "The model returned a citation not uniquely present in the supplied evidence. The answer was withheld. Please try again.",
        });

    const sections = parseAnswerSections(rawAnswer);

    res.json({
      mode: "local",
      question,
      answer: rawAnswer,
      evidence: sections.evidence,
      interpretation: sections.interpretation,
      unknown: sections.unknown,
      sources,
      ...checks,
      retrieval,
      revision,
      warning: checks.hasCitations
        ? "Hashes match retrieved commits; factual support still requires patch review."
        : "This response has no validated citations. Treat it as unverified, not repository history.",
    });
  } catch (e) {
    res
      .status(503)
      .json({
        error: `Could not reach the ghost: ${e.message}. Check Ollama and installed models.`,
      });
  } finally {
    generating = false;
  }
});
app.post("/api/explain-file", async (req, res) => {
  const filePath = req.body.file;
  if (typeof filePath !== "string" || !filePath.trim())
    return res.status(400).json({ error: "Specify a file path to explain." });
  if (indexing || generating)
    return res
      .status(409)
      .json({ error: "Another operation is active. Please wait." });

  const getRevision = () => ({
    repoName: history.name,
    headCommit: history.commits?.[0]?.hash || null,
    headSubject: history.commits?.[0]?.subject || null,
    analyzedAt: new Date().toISOString(),
  });

  if (history.mode === "demo") {
    const explanation = demoExplainFile(filePath);
    return res.json({
      ...explanation,
      revision: getRevision(),
      warning:
        "Illustrative, rule-based demo—not model output or real repository history.",
    });
  }

  generating = true;
  try {
    const repoPath = history.path;
    let fileCommits = [];
    if (repoPath) {
      fileCommits = await getFileCommits(repoPath, filePath);
    }
    if (!fileCommits.length) {
      fileCommits = history.commits.filter(
        (c) =>
          c.patch.toLowerCase().includes(filePath.toLowerCase()) ||
          c.subject.toLowerCase().includes(filePath.toLowerCase()),
      );
    }
    if (!fileCommits.length) {
      return res.status(404).json({
        error: `No commit evidence found for "${filePath}" in the scanned history.`,
      });
    }

    const rawExplanation = await explainFile(filePath, fileCommits);
    const checks = inspectCitations(rawExplanation, fileCommits);

    const parseSection = (pattern) => {
      const match = rawExplanation.match(pattern);
      return match ? match[1].trim() : "";
    };

    const whatTheFileDid =
      parseSection(/###\s*(?:1\.\s*)?What the file (?:did|does)\s*([\s\S]*?)(?=###|$)/i) ||
      rawExplanation.slice(0, 300);
    const howItChanged =
      parseSection(/###\s*(?:2\.\s*)?How it changed\s*([\s\S]*?)(?=###|$)/i) ||
      parseSection(/###\s*(?:3\.\s*)?Important changes\s*([\s\S]*?)(?=###|$)/i) ||
      "";
    const whatHistoryExplicitlySays =
      parseSection(/###\s*(?:3\.\s*)?What the history explicitly says\s*([\s\S]*?)(?=###|$)/i) ||
      parseSection(/###\s*(?:4\.\s*)?Reasons explicitly recorded[^\n]*\n([\s\S]*?)(?=###|$)/i) ||
      "";
    const whatRemainsUnknown =
      parseSection(/###\s*(?:4\.\s*)?What remains unknown\s*([\s\S]*?)(?=###|$)/i) ||
      parseSection(/###\s*(?:5\.\s*)?What is still unknown\s*([\s\S]*?)(?=###|$)/i) ||
      "";

    const isDeleted = history.deleted?.some((d) => d.file === filePath);
    const firstCommit = fileCommits[fileCommits.length - 1] || null;
    const lastCommit = fileCommits[0] || null;

    // Build chronological timeline: oldest to newest
    const chronologicalCommits = [...fileCommits].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    const timeline = chronologicalCommits.map((c, idx) => {
      let stage = "CHANGED";
      if (idx === 0) {
        stage = "CREATED";
      } else if (idx === chronologicalCommits.length - 1 && isDeleted) {
        stage = "DELETED";
      } else if (
        c.subject.toLowerCase().includes("rename") ||
        c.patch.toLowerCase().includes("rename from")
      ) {
        stage = "RENAMED";
      }

      const d = new Date(c.date);
      const shortDate = isNaN(d.getTime())
        ? "Unknown date"
        : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const fullDate = isNaN(d.getTime())
        ? "Unknown date"
        : d.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          });

      return {
        stage,
        stageLabel: stage,
        date: shortDate,
        fullDate,
        year: isNaN(d.getTime()) ? "" : String(d.getFullYear()),
        hash: c.hash.slice(0, 7),
        author: c.author,
        title: c.subject.slice(0, 60),
        description: c.subject,
        commit: c,
      };
    });

    res.json({
      file: filePath,
      status: isDeleted ? "deleted" : "active",
      timeline,
      whatTheFileDid,
      howItChanged,
      whatHistoryExplicitlySays,
      whatRemainsUnknown,
      // Backward compatibility fields
      whatItDoes: whatTheFileDid,
      whenIntroduced: timeline[0]
        ? `Introduced in [${timeline[0].hash}] by ${timeline[0].author} on ${timeline[0].fullDate}: ${timeline[0].title}`
        : "",
      importantChanges: howItChanged,
      explicitReasons: whatHistoryExplicitlySays,
      whatIsUnknown: whatRemainsUnknown,
      firstCommit,
      lastCommit,
      rawExplanation,
      sources: fileCommits,
      renameNotice:
        "Git’s rename detection is heuristic, not a perfect record of file identity.",
      ...checks,
      mode: "local",
      revision: getRevision(),
      warning: checks.hasCitations
        ? "Citations validated against retrieved commits. Factual verification requires patch inspection."
        : "No bracketed citations validated. Treat as unverified summary.",
    });
  } catch (e) {
    res.status(503).json({
      error: `Could not explain file: ${e.message}. Check Ollama and installed models.`,
    });
  } finally {
    generating = false;
  }
});

// ── Ask about a symbol / function / snippet ─────────────────────────────────
app.post("/api/explain-symbol", async (req, res) => {
  const { symbol, snippet } = req.body;
  if (typeof symbol !== "string" || !symbol.trim() || symbol.length > 500)
    return res
      .status(400)
      .json({ error: "Provide a symbol name or code snippet (max 500 chars)." });
  if (indexing || generating)
    return res
      .status(409)
      .json({ error: "Another operation is active. Please wait." });

  const getRevision = () => ({
    repoName: history.name,
    headCommit: history.commits?.[0]?.hash || null,
    headSubject: history.commits?.[0]?.subject || null,
    analyzedAt: new Date().toISOString(),
  });

  if (history.mode === "demo") {
    return res.json({
      ...demoExplainSymbol(symbol, snippet),
      revision: getRevision(),
      warning:
        "Illustrative, rule-based demo—not model output or real repository history.",
    });
  }

  generating = true;
  try {
    const symbolCommits = await getSymbolCommits(
      history.path,
      symbol,
      history.commits,
    );
    if (!symbolCommits.length)
      return res.status(404).json({
        error: `No evidence found for "${symbol}" in the scanned history. Try a different symbol name, function, or keyword.`,
      });

    const answer = await explainSymbol(symbol, snippet || "", symbolCommits);
    const checks = inspectCitations(answer, symbolCommits);

    res.json({
      symbol,
      snippet: snippet || null,
      answer,
      sources: symbolCommits,
      ...checks,
      revision: getRevision(),
      blameNote:
        "git blame identifies the last commit to modify a line—not necessarily the commit explaining original purpose. The ghost checks earlier history where relevant.",
      mode: "local",
      warning: checks.hasCitations
        ? "Citations validated against retrieved commits."
        : "No validated citations—treat as unverified summary.",
    });
  } catch (e) {
    res
      .status(503)
      .json({
        error: `Could not reach the ghost: ${e.message}. Check Ollama and installed models.`,
      });
  } finally {
    generating = false;
  }
});

// ── Tombstone upgrade: what replaced a deleted file? ─────────────────────────
app.post("/api/tombstone-replacement", async (req, res) => {
  const { file } = req.body;
  if (typeof file !== "string" || !file.trim())
    return res.status(400).json({ error: "Specify a deleted file path." });
  if (indexing || generating)
    return res
      .status(409)
      .json({ error: "Another operation is active. Please wait." });

  const getRevision = () => ({
    repoName: history.name,
    headCommit: history.commits?.[0]?.hash || null,
    headSubject: history.commits?.[0]?.subject || null,
    analyzedAt: new Date().toISOString(),
  });

  if (history.mode === "demo") {
    return res.json({
      ...demoTombstoneReplacement(file),
      revision: getRevision(),
      warning:
        "Illustrative, rule-based demo—not model output or real repository history.",
    });
  }

  generating = true;
  try {
    const deletionRecord = history.deleted?.find((d) => d.file === file);
    if (!deletionRecord)
      return res.status(404).json({
        error: `"${file}" was not found among the scanned deleted files.`,
      });

    const deletionCommit = history.commits.find(
      (c) => c.hash === deletionRecord.hash,
    );
    if (!deletionCommit)
      return res.status(404).json({ error: "Deletion commit not found in history." });

    const { candidates, identifiers } = await getDeletedFileReplacement(
      history.path,
      file,
      deletionRecord.hash,
      deletionCommit.patch,
      history.commits,
    );

    const allSources = [deletionCommit, ...candidates];
    const answer = await explainReplacement(
      file,
      deletionCommit,
      candidates,
      identifiers,
    );
    const checks = inspectCitations(answer, allSources);

    // Extract the "old code" lines from the deletion patch (removed lines)
    const oldCodeLines = deletionCommit.patch
      .split("\n")
      .filter((l) => l.startsWith("-") && !l.startsWith("---"))
      .map((l) => l.slice(1))
      .join("\n")
      .slice(0, 3000);

    res.json({
      file,
      deletionCommit,
      oldCode: oldCodeLines || null,
      candidates,
      identifiers,
      answer,
      hasReplacement: candidates.length > 0,
      sources: allSources,
      ...checks,
      mode: "local",
      revision: getRevision(),
      warning:
        "Replacement relationships are inferred from shared identifiers—inspect patches before drawing conclusions.",
    });
  } catch (e) {
    res.status(503).json({
      error: `Could not investigate replacement: ${e.message}. Check Ollama and installed models.`,
    });
  } finally {
    generating = false;
  }
});

if (process.env.NODE_ENV === "production") app.use(express.static("dist"));
else {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    server: { middlewareMode: true, allowedHosts: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
app.use((err, req, res, next) =>
  res
    .status(400)
    .json({
      error:
        err.type === "entity.parse.failed"
          ? "Invalid JSON body."
          : "Request could not be processed.",
    }),
);
app.listen(process.env.PORT || 3001, process.env.HOST || "127.0.0.1", () =>
  console.log(
    `Git Séance listening on ${process.env.PORT || 3001}. Local repositories ${localEnabled ? "enabled" : "disabled"}.`,
  ),
);
