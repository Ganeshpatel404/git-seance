export const demo = {
  name: "lantern/lantern",
  mode: "demo",
  scope:
    "Fictional sample repository. All commits, authors, and answers are illustrative—not real project history.",
  commits: [
    {
      hash: "a8e31f209db76b050aefe415c2a8a09e2e8731c2",
      date: "2024-10-28T10:30:00Z",
      author: "Ada Chen",
      subject: "Remove legacy session cache after Redis migration",
      patch:
        "diff --git a/src/cache/memory-cache.js b/src/cache/memory-cache.js\ndeleted file mode 100644\n-// Keep sessions alive when the Redis connection drops.\n-export const sessions = new Map();\n-export function remember(id, session) { sessions.set(id, session); }\n-// Temporary fallback until the Redis migration is complete.",
    },
    {
      hash: "7c9d402e823fc1a495f44af208a8f3e5d40b17c2",
      date: "2024-09-14T08:10:00Z",
      author: "Sam Rivera",
      subject: "Wait for Redis readiness before accepting requests",
      patch:
        "diff --git a/src/server.js b/src/server.js\n@@ -12,2 +12,4 @@\n+await redis.connect();\n+await redis.ping();\n+server.listen(port);\n-// TODO: retire the in-memory session fallback after rollout.",
    },
    {
      hash: "e42b7d1953b7e6d094c71805b0ca41a3e6c82109",
      date: "2024-08-02T12:00:00Z",
      author: "Ada Chen",
      subject: "Add temporary session fallback during Redis rollout",
      patch:
        "diff --git a/src/cache/memory-cache.js b/src/cache/memory-cache.js\nnew file mode 100644\n+// Keep sessions alive when the Redis connection drops.\n+export const sessions = new Map();\n+export function remember(id, session) { sessions.set(id, session); }\n+// Temporary fallback until the Redis migration is complete.",
    },
    {
      hash: "b031a79c5fb86cbb8be1ec5daa28c75f156e82d0",
      date: "2024-10-20T12:00:00Z",
      author: "Sam Rivera",
      subject: "Remove unused debug logger",
      patch:
        "diff --git a/src/utils/debug.js b/src/utils/debug.js\ndeleted file mode 100644\n-export const debug = (...args) => console.log(...args);",
    },
  ],
  deleted: [
    {
      file: "src/cache/memory-cache.js",
      hash: "a8e31f209db76b050aefe415c2a8a09e2e8731c2",
      date: "2024-10-28T10:30:00Z",
      author: "Ada Chen",
      subject: "Remove legacy session cache after Redis migration",
    },
    {
      file: "src/utils/debug.js",
      hash: "b031a79c5fb86cbb8be1ec5daa28c75f156e82d0",
      date: "2024-10-20T12:00:00Z",
      author: "Sam Rivera",
      subject: "Remove unused debug logger",
    },
  ],
  files: [
    {
      file: "src/cache/memory-cache.js",
      status: "deleted",
      introduced: "2024-08-02T12:00:00Z",
      lastTouched: "2024-10-28T10:30:00Z",
      commitsCount: 3,
      author: "Ada Chen",
      summary: "In-memory session fallback map created during Redis rollout and removed once migration settled.",
    },
    {
      file: "src/utils/debug.js",
      status: "deleted",
      introduced: "2024-06-12T09:00:00Z",
      lastTouched: "2024-10-20T12:00:00Z",
      commitsCount: 1,
      author: "Sam Rivera",
      summary: "Console logging wrapper removed after becoming unused across the codebase.",
    },
    {
      file: "src/server.js",
      status: "active",
      introduced: "2024-05-10T14:20:00Z",
      lastTouched: "2024-09-14T08:10:00Z",
      commitsCount: 2,
      author: "Sam Rivera",
      summary: "Core HTTP listener that establishes connection verification and readiness ping to Redis.",
    },
  ],
};

export function demoExplainFile(filePath) {
  const norm = filePath.toLowerCase().trim();
  if (norm.includes("cache") || norm.includes("memory-cache")) {
    const sources = [
      demo.commits[2], // e42b7d1
      demo.commits[1], // 7c9d402
      demo.commits[0], // a8e31f2
    ];
    return {
      file: "src/cache/memory-cache.js",
      status: "deleted",
      timeline: [
        {
          stage: "CREATED",
          stageLabel: "CREATED",
          date: "Aug 2",
          year: "2024",
          fullDate: "Aug 2, 2024",
          hash: "e42b7d1",
          author: "Ada Chen",
          title: "Temporary cache added",
          description: "Temporary session fallback during Redis rollout",
          commit: sources[0],
        },
        {
          stage: "CHANGED",
          stageLabel: "CHANGED",
          date: "Sep 14",
          year: "2024",
          fullDate: "Sep 14, 2024",
          hash: "7c9d402",
          author: "Sam Rivera",
          title: "Redis readiness added",
          description: "Wait for Redis readiness before accepting requests",
          commit: sources[1],
        },
        {
          stage: "DELETED",
          stageLabel: "DELETED",
          date: "Oct 28",
          year: "2024",
          fullDate: "Oct 28, 2024",
          hash: "a8e31f2",
          author: "Ada Chen",
          title: "Legacy cache removed",
          description: "Remove legacy session cache after Redis migration",
          commit: sources[2],
        },
      ],
      firstCommit: {
        hash: sources[0].hash,
        date: sources[0].date,
        author: sources[0].author,
        subject: sources[0].subject,
      },
      lastCommit: {
        hash: sources[2].hash,
        date: sources[2].date,
        author: sources[2].author,
        subject: sources[2].subject,
      },
      whatTheFileDid:
        "The file implemented an in-memory session storage layer (`export const sessions = new Map()`, `remember(id, session)`) to preserve user login sessions in local process memory if the primary Redis database connection dropped.",
      howItChanged:
        "• Introduced in [e42b7d1] by Ada Chen as an interim safety net while Redis rollout was underway.\n• Referenced in [7c9d402] where Sam Rivera added readiness gates (`redis.ping()`) and marked this fallback for retirement.\n• Deleted in [a8e31f2] after the Redis cluster migration successfully concluded.",
      whatHistoryExplicitlySays:
        "Commits explicitly record that this was a temporary mechanism:\n• Patch comment in [e42b7d1]: 'Keep sessions alive when the Redis connection drops.'\n• Patch comment in [e42b7d1]: 'Temporary fallback until the Redis migration is complete.'\n• Commit message in [a8e31f2]: 'Remove legacy session cache after Redis migration.'",
      whatRemainsUnknown:
        "The Git history does not document:\n• The frequency or root cause of Redis disconnects during the rollout.\n• How many concurrent sessions the process Map held in production.\n• Whether users lost sessions on server restarts before Redis stabilized.",
      // Backwards compatibility with previous field names
      whatItDoes:
        "The file implemented an in-memory session storage layer (`export const sessions = new Map()`, `remember(id, session)`) to preserve user login sessions in local process memory if the primary Redis database connection dropped.",
      whenIntroduced:
        "Introduced on August 2, 2024 by Ada Chen in commit [e42b7d1] ('Add temporary session fallback during Redis rollout'). It was created specifically as an interim safety net while the infrastructure team migrated backend sessions.",
      importantChanges:
        "• Aug 2, 2024: Created as a temporary in-memory fallback [e42b7d1].\n• Sep 14, 2024: Redis readiness check added [7c9d402].\n• Oct 28, 2024: Deleted once Redis migration settled [a8e31f2].",
      explicitReasons:
        "Commits explicitly record that this was a temporary mechanism:\n• Patch comment in [e42b7d1]: 'Keep sessions alive when the Redis connection drops.'\n• Patch comment in [e42b7d1]: 'Temporary fallback until the Redis migration is complete.'\n• Commit message in [a8e31f2]: 'Remove legacy session cache after Redis migration.'",
      whatIsUnknown:
        "The Git history does not document:\n• The frequency or root cause of Redis disconnects during the rollout.\n• How many concurrent sessions the process Map held in production.\n• Whether users lost sessions on server restarts before Redis stabilized.",
      renameNotice:
        "Git’s rename detection is heuristic, not a perfect record of file identity.",
      sources,
      citations: [
        sources[0].hash.slice(0, 7),
        sources[1].hash.slice(0, 7),
        sources[2].hash.slice(0, 7),
      ],
      mode: "demo",
    };
  }

  if (norm.includes("debug") || norm.includes("logger")) {
    const sources = [demo.commits[3]]; // b031a79
    return {
      file: "src/utils/debug.js",
      status: "deleted",
      timeline: [
        {
          stage: "CREATED",
          stageLabel: "CREATED",
          date: "Jun 12",
          year: "2024",
          fullDate: "Jun 12, 2024",
          hash: "b031a79",
          author: "Sam Rivera",
          title: "Initial logger wrapper",
          description: "Console logging wrapper introduced for local debugging",
          commit: sources[0],
        },
        {
          stage: "DELETED",
          stageLabel: "DELETED",
          date: "Oct 20",
          year: "2024",
          fullDate: "Oct 20, 2024",
          hash: "b031a79",
          author: "Sam Rivera",
          title: "Unused logger removed",
          description: "Remove unused debug logger",
          commit: sources[0],
        },
      ],
      firstCommit: {
        hash: sources[0].hash,
        date: "2024-06-12T09:00:00Z",
        author: "Sam Rivera",
        subject: "Initial debug logger utility",
      },
      lastCommit: {
        hash: sources[0].hash,
        date: sources[0].date,
        author: sources[0].author,
        subject: sources[0].subject,
      },
      whatTheFileDid:
        "A lightweight debugging wrapper (`export const debug = (...args) => console.log(...args);`) designed to standardize console logging across modules during development.",
      howItChanged:
        "The file was created early in development and remained untouched until commit [b031a79] by Sam Rivera, where it was deleted entirely after an audit of unused utility exports.",
      whatHistoryExplicitlySays:
        "The commit subject explicitly states: 'Remove unused debug logger' [b031a79]. No other rationale or ticket number is provided.",
      whatRemainsUnknown:
        "The Git record leaves several aspects unknown:\n• Why it fell out of use (whether replaced by a structured logger, linters, or silence).\n• Whether debug logs leaked sensitive data in earlier releases.\n• The original pull request discussion.",
      whatItDoes:
        "A lightweight debugging wrapper (`export const debug = (...args) => console.log(...args);`) designed to standardize console logging across modules during development.",
      whenIntroduced:
        "Created during initial setup as a simple wrapper around standard output.",
      importantChanges:
        "Removed entirely in commit [b031a79] by Sam Rivera after the team audited unused utility imports.",
      explicitReasons:
        "The commit subject explicitly states: 'Remove unused debug logger' [b031a79]. No other rationale or ticket number is provided.",
      whatIsUnknown:
        "The Git record leaves several aspects unknown:\n• Why it fell out of use (whether replaced by a structured logger, linters, or silence).\n• Whether debug logs leaked sensitive data in earlier releases.\n• The original pull request discussion.",
      renameNotice:
        "Git’s rename detection is heuristic, not a perfect record of file identity.",
      sources,
      citations: [sources[0].hash.slice(0, 7)],
      mode: "demo",
    };
  }

  if (norm.includes("server")) {
    const sources = [demo.commits[2], demo.commits[1]];
    return {
      file: "src/server.js",
      status: "active",
      timeline: [
        {
          stage: "CREATED",
          stageLabel: "CREATED",
          date: "May 10",
          year: "2024",
          fullDate: "May 10, 2024",
          hash: "e42b7d1",
          author: "Sam Rivera",
          title: "Initial server listener",
          description: "Core HTTP listener that binds ports and handles traffic",
          commit: sources[0],
        },
        {
          stage: "CHANGED",
          stageLabel: "CHANGED",
          date: "Sep 14",
          year: "2024",
          fullDate: "Sep 14, 2024",
          hash: "7c9d402",
          author: "Sam Rivera",
          title: "Redis readiness added",
          description: "Wait for Redis readiness before accepting requests",
          commit: sources[1],
        },
      ],
      firstCommit: {
        hash: sources[0].hash,
        date: sources[0].date,
        author: sources[0].author,
        subject: sources[0].subject,
      },
      lastCommit: {
        hash: sources[1].hash,
        date: sources[1].date,
        author: sources[1].author,
        subject: sources[1].subject,
      },
      whatTheFileDid:
        "The HTTP entry point that starts the network listener, binds ports, and validates downstream connections before serving user requests.",
      howItChanged:
        "• May 10, 2024: Initial HTTP server set up.\n• Sep 14, 2024: Sam Rivera added explicit readiness gates (`await redis.connect()`, `await redis.ping()`) prior to `server.listen(port)` in commit [7c9d402].",
      whatHistoryExplicitlySays:
        "Commits record the requirement that the service must guarantee storage availability before listening to external HTTP traffic [7c9d402].",
      whatRemainsUnknown:
        "Unknown from Git evidence:\n• Server port binding configuration or TLS termination.\n• How crash restarts or unhandled errors are supervised by systemd or Docker.",
      whatItDoes:
        "The HTTP entry point that starts the network listener, binds ports, and validates downstream connections before serving user requests.",
      whenIntroduced:
        "Core service listener introduced at the inception of the repository.",
      importantChanges:
        "Added explicit readiness gates (`await redis.connect()`, `await redis.ping()`) prior to `server.listen(port)` in commit [7c9d402].",
      explicitReasons:
        "Commits record the requirement that the service must guarantee storage availability before listening to external HTTP traffic [7c9d402].",
      whatIsUnknown:
        "Unknown from Git evidence:\n• Server port binding configuration or TLS termination.\n• How crash restarts or unhandled errors are supervised by systemd or Docker.",
      renameNotice:
        "Git’s rename detection is heuristic, not a perfect record of file identity.",
      sources,
      citations: [sources[0].hash.slice(0, 7), sources[1].hash.slice(0, 7)],
      mode: "demo",
    };
  }

  // Generic fallback for unmodeled demo queries
  return {
    file: filePath,
    status: "unknown",
    firstCommit: null,
    lastCommit: null,
    whatItDoes: `This fictional demo contains explicit historical evidence for 'src/cache/memory-cache.js', 'src/utils/debug.js', and 'src/server.js'.`,
    whenIntroduced:
      "Connect a local Git repository to have Gemma inspect the complete commit tree of any file.",
    importantChanges: [],
    explicitReasons:
      "No commit evidence available for this file in the fictional demonstration.",
    whatIsUnknown:
      "All historical details for unindexed paths remain outside the demo realm.",
    sources: [],
    citations: [],
    mode: "demo",
  };
}

/**
 * Demo handler for "Ask about a symbol or function".
 * Covers: sessions, remember, redis.ping, debug, server.listen
 */
export function demoExplainSymbol(symbol, snippet) {
  const norm = (symbol + " " + (snippet || "")).toLowerCase();

  if (/session|remember|sessions/.test(norm)) {
    const sources = [demo.commits[2], demo.commits[1], demo.commits[0]];
    return {
      symbol,
      snippet: snippet || null,
      answer: `**What this does**\n\`sessions\` is a \`Map\` used as an in-process store for user session objects. \`remember(id, session)\` inserts a session keyed by session ID [e42b7d1].\n\n**When it was introduced**\nIntroduced by Ada Chen on 2024-08-02 in [e42b7d1] ('Add temporary session fallback during Redis rollout'). The commit comment reads: 'Keep sessions alive when the Redis connection drops.'\n\n**Why it works this way**\nThe Map was chosen as a zero-dependency, zero-latency fallback. No commit explains why a Map was preferred over a WeakMap or LRU cache—this is undocumented [e42b7d1].\n\n**Recent changes**\nThe most recent commit to touch this code was the DELETION commit [a8e31f2] by Ada Chen ('Remove legacy session cache after Redis migration'). The last modification before deletion was the introduction commit itself—no intermediate changes appear in the evidence.\n\n**What is still unexplained**\nThe evidence does not record: how long sessions persisted in the Map before Redis recovered, whether expired entries were ever evicted, or why a process restart was considered acceptable session loss.`,
      sources,
      citations: ["e42b7d1", "7c9d402", "a8e31f2"],
      blameNote:
        "The blame commit [a8e31f2] only shows deletion—the meaningful origin is [e42b7d1]. The ghost followed the chain.",
      mode: "demo",
    };
  }

  if (/redis\.ping|redis\.connect|readiness|500ms|wait/.test(norm)) {
    const sources = [demo.commits[1]];
    return {
      symbol,
      snippet: snippet || null,
      answer: `**What this does**\n\`await redis.ping()\` is a readiness check that blocks the HTTP server from accepting connections until Redis responds. \`await redis.connect()\` precedes it to establish the connection [7c9d402].\n\n**When it was introduced**\nAdded by Sam Rivera on 2024-09-14 in [7c9d402] ('Wait for Redis readiness before accepting requests').\n\n**Why it works this way**\nThe commit removes a TODO comment: '// TODO: retire the in-memory session fallback after rollout.' This establishes the readiness gate as the replacement strategy for the fallback Map—but the specific choice of \`ping()\` over a health-check endpoint is not documented [7c9d402].\n\n**Recent changes**\nThe blame commit IS the origin commit here [7c9d402]. No later commit has modified these lines.\n\n**What is still unexplained**\nThe commit does not document: what timeout is configured for the ping, whether the server retries on ping failure, or why blocking startup was preferred over a circuit-breaker pattern.`,
      sources,
      citations: ["7c9d402"],
      blameNote:
        "Blame and origin coincide here—[7c9d402] is both the introducing and last-touching commit.",
      mode: "demo",
    };
  }

  if (/debug|console\.log|logger/.test(norm)) {
    const sources = [demo.commits[3]];
    return {
      symbol,
      snippet: snippet || null,
      answer: `**What this does**\n\`debug\` is a variadic wrapper over \`console.log\`: \`export const debug = (...args) => console.log(...args);\`. It provided a single named export for standardised diagnostic output [b031a79].\n\n**When it was introduced**\nThe deletion patch [b031a79] shows its removal, but not its creation. The demo has no creation commit—this is a real gap in the fictional evidence.\n\n**Why it works this way**\nNo commit documents why \`console.log\` was wrapped instead of imported directly. This is undocumented.\n\n**Recent changes**\nThe blame commit [b031a79] is the DELETION commit ('Remove unused debug logger'), not a functional change. Following the chain backward, no earlier commits in this demo record the function's creation.\n\n**What is still unexplained**\nWhy \`debug\` became unused, whether it was replaced by a structured logger, and when it was originally created are all absent from the available evidence.`,
      sources,
      citations: ["b031a79"],
      blameNote:
        "The blame commit [b031a79] shows only the removal—the ghost cannot find an earlier creation commit in this demo's evidence.",
      mode: "demo",
    };
  }

  // Generic fallback
  return {
    symbol,
    snippet: snippet || null,
    answer: `This fictional demo contains evidence for the symbols \`sessions\`, \`remember\`, \`redis.ping()\`, and \`debug\`. For "${symbol}", no matching evidence exists in the demo realm.\n\nConnect a local repository to ask Gemma about real symbols from your own codebase.`,
    sources: [],
    citations: [],
    blameNote: null,
    mode: "demo",
  };
}

/**
 * Demo handler for "What replaced this deleted file?" tombstone upgrade.
 */
export function demoTombstoneReplacement(filePath) {
  const norm = filePath.toLowerCase().trim();

  if (norm.includes("cache") || norm.includes("memory-cache")) {
    const deletionCommit = demo.commits[0]; // a8e31f2
    const replacementCandidate = demo.commits[1]; // 7c9d402 — redis readiness
    return {
      file: "src/cache/memory-cache.js",
      deletionCommit,
      oldCode:
        "export const sessions = new Map();\nexport function remember(id, session) { sessions.set(id, session); }\n// Keep sessions alive when the Redis connection drops.\n// Temporary fallback until the Redis migration is complete.",
      candidates: [
        {
          ...replacementCandidate,
          matchedOn: "sessions",
          relationshipNote:
            "This commit removed the TODO referencing the fallback and replaced blocking startup with Redis readiness pinging—functionally replacing the in-process session recovery with a proper startup gate.",
        },
      ],
      identifiers: ["sessions", "remember", "memory-cache"],
      answer: `**What the deleted file did**\n\`src/cache/memory-cache.js\` kept user sessions alive inside the Node.js process memory when Redis was unavailable. It exported a \`Map\` named \`sessions\` and a \`remember(id, session)\` function [a8e31f2].\n\n**Why it was deleted**\nThe commit message [a8e31f2] states: 'Remove legacy session cache after Redis migration.' A comment in the code confirmed this was always temporary: 'Temporary fallback until the Redis migration is complete.'\n\n**What replaced it** (evidence-supported)\nCommit [7c9d402] introduced \`await redis.connect()\` and \`await redis.ping()\` before \`server.listen()\`. This replaced the "survive Redis loss" strategy with a "don't start until Redis is available" strategy. The TODO in [7c9d402]'s patch — '// TODO: retire the in-memory session fallback after rollout' — is a direct reference to this deleted file.\n\n**Confidence**: High. The TODO comment in [7c9d402] explicitly references the retirement of this fallback. The deletion [a8e31f2] followed three months later.`,
      citations: ["a8e31f2", "7c9d402"],
      hasReplacement: true,
      mode: "demo",
    };
  }

  if (norm.includes("debug")) {
    const deletionCommit = demo.commits[3]; // b031a79
    return {
      file: "src/utils/debug.js",
      deletionCommit,
      oldCode: "export const debug = (...args) => console.log(...args);",
      candidates: [],
      identifiers: ["debug"],
      answer: `**What the deleted file did**\n\`src/utils/debug.js\` exported a single function \`debug\` that forwarded all arguments to \`console.log\` [b031a79].\n\n**Why it was deleted**\nThe commit message [b031a79] states: 'Remove unused debug logger.' No further rationale is recorded.\n\n**What replaced it**\nNo replacement evidence was found in the scanned history. The deletion patch shows no references to an alternative logger being imported elsewhere in the same commit. If a structured logging library (e.g. pino, winston) replaced it, that change either occurred outside the 150-commit scan window or was not recorded in this repository.\n\n**Confidence**: No replacement evidence found. This may have been a dead removal, or the replacement may exist outside scanned history.`,
      citations: ["b031a79"],
      hasReplacement: false,
      mode: "demo",
    };
  }

  // Generic fallback
  return {
    file: filePath,
    deletionCommit: null,
    oldCode: null,
    candidates: [],
    identifiers: [],
    answer: `This fictional demo only has replacement evidence for 'src/cache/memory-cache.js' and 'src/utils/debug.js'. Connect a real local repository to investigate replacements for any deleted file.`,
    citations: [],
    hasReplacement: false,
    mode: "demo",
  };
}

/**
 * Demo answer handler providing the three clearly separated verification sections:
 * 1. Evidence: what the commits directly establish.
 * 2. Interpretation: what the model infers.
 * 3. Unknown: what the history does not explain.
 */
export function getDemoAskAnswer(question, commitHash, isEpitaph = false) {
  const norm = (question + " " + (commitHash || "")).toLowerCase();

  if (/cache|redis|session|fallback|7c9d402|e42b7d1|a8e31f2/.test(norm)) {
    const sources = demo.commits.slice(0, 3);
    const evidence =
      "Commit [e42b7d1] ('Add temporary session fallback during Redis rollout') introduced `src/cache/memory-cache.js` on 2024-08-02 by Ada Chen. Patch comments explicitly state: '// Keep sessions alive when the Redis connection drops.' and '// Temporary fallback until the Redis migration is complete.' In [7c9d402], Sam Rivera added Redis readiness ping checks. Finally, in [a8e31f2], Ada Chen deleted the file once Redis migration completed.";
    const interpretation =
      "The in-memory session cache was designed strictly as a temporary safety net during the Redis rollout. Once Redis startup verification proved reliable, the temporary fallback was retired.";
    const unknown =
      "The Git history does not document how often Redis disconnects happened, the memory usage of the Map, or whether user sessions were lost on restarts before migration completed.";
    const fullAnswer = `### Evidence\n${evidence}\n\n### Interpretation\n${interpretation}\n\n### Unknown\n${unknown}`;
    return {
      sources,
      answer: isEpitaph
        ? `Creative epitaph: “A small lantern, set down when the path grew clear.”\n\n${fullAnswer}`
        : fullAnswer,
      evidence,
      interpretation,
      unknown,
      citations: ["e42b7d1", "7c9d402", "a8e31f2"],
    };
  }

  if (/debug|logger|b031a79/.test(norm)) {
    const sources = [demo.commits[3]];
    const evidence =
      "Commit [b031a79] by Sam Rivera on 2024-10-20 deleted `src/utils/debug.js` with the subject: 'Remove unused debug logger.' The removed code was: `export const debug = (...args) => console.log(...args);`.";
    const interpretation =
      "The wrapper was an early debugging helper that became redundant as the codebase matured or switched to standard logging.";
    const unknown =
      "The repository history does not show when `debug.js` was first introduced, nor why it was left unused across the codebase.";
    const fullAnswer = `### Evidence\n${evidence}\n\n### Interpretation\n${interpretation}\n\n### Unknown\n${unknown}`;
    return {
      sources,
      answer: isEpitaph
        ? `Creative epitaph: “Silent at last, after thousands of forgotten logs.”\n\n${fullAnswer}`
        : fullAnswer,
      evidence,
      interpretation,
      unknown,
      citations: ["b031a79"],
    };
  }

  const sources = [];
  const evidence =
    "No commit evidence matching this question exists in the fictional demo realm.";
  const interpretation =
    "The demo repository only models the session cache and debug logger historical scenarios.";
  const unknown =
    "All details outside these two illustrated features are unknown in the sample realm. Connect a local repository to query real commits.";
  const fullAnswer = `### Evidence\n${evidence}\n\n### Interpretation\n${interpretation}\n\n### Unknown\n${unknown}`;
  return {
    sources,
    answer: fullAnswer,
    evidence,
    interpretation,
    unknown,
    citations: [],
  };
}


