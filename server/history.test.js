import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { simpleGit } from "simple-git";
import { readHistory, retrieve, validCitations } from "./history.js";
test("real Git repository: retrieve history and deleted file", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "seance-"));
  try {
    const git = simpleGit(dir);
    await git.init();
    await git.addConfig("user.name", "Test Ghost");
    await git.addConfig("user.email", "ghost@example.com");
    await writeFile(
      path.join(dir, "cache.js"),
      "export const cache = new Map();",
    );
    await git.add(".");
    await git.commit("Add temporary cache");
    await git.rm("cache.js");
    await git.commit("Remove obsolete cache");
    const h = await readHistory(dir);
    assert.equal(h.commits.length, 2);
    assert.equal(h.deleted[0].file, "cache.js");
    assert.equal(h.deleted[0].author, "Test Ghost");
    assert.ok(
      retrieve(h.commits, "temporary cache")[0].subject.includes("temporary"),
    );
    assert.deepEqual(validCitations("[abcdef0]", h.commits), []);
    assert.equal(
      validCitations(`[${h.commits[0].hash.slice(0, 7)}]`, h.commits).length,
      1,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
