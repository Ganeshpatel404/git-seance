import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { simpleGit } from "simple-git";
test(
  "local API with controlled Ollama test double: repo, embeddings, answers, rejection, epitaph, origin",
  { timeout: 30000 },
  async () => {
    let hash,
      invalid = false;
    const mock = createServer(async (req, res) => {
      let text = "";
      for await (const chunk of req) text += chunk;
      const b = text ? JSON.parse(text) : {};
      res.setHeader("Content-Type", "application/json");
      if (req.url === "/api/tags")
        res.end(
          JSON.stringify({
            models: [{ name: "gemma3:4b" }, { name: "embeddinggemma" }],
          }),
        );
      else if (req.url === "/api/embed")
        res.end(JSON.stringify({ embeddings: b.input.map(() => [1, 0, 0]) }));
      else
        res.end(
          JSON.stringify({
            message: {
              content: `The cache was removed [${invalid ? "1111111" : hash.slice(0, 7)}].`,
            },
          }),
        );
    });
    await new Promise((resolve) => mock.listen(0, "127.0.0.1", resolve));
    const dir = await mkdtemp(path.join(tmpdir(), "seance-api-"));
    let child;
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
      await git.commit("Add cache");
      await git.rm("cache.js");
      await git.commit("Remove cache");
      hash = (await git.log()).latest.hash;
      const port = 3108;
      child = spawn(process.execPath, ["server/index.js"], {
        env: {
          ...process.env,
          NODE_ENV: "production",
          PORT: String(port),
          HOST: "127.0.0.1",
          ENABLE_LOCAL_REPOS: "true",
          OLLAMA_URL: `http://127.0.0.1:${mock.address().port}`,
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
      await new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(Error("API startup timeout")),
          10000,
        );
        child.stdout.on("data", (d) => {
          if (d.toString().includes("listening")) {
            clearTimeout(timer);
            resolve();
          }
        });
        child.on("exit", (code) => {
          clearTimeout(timer);
          reject(Error(`API exited ${code}`));
        });
      });
      async function call(endpoint, body, extra = {}) {
        const r = await fetch(`http://127.0.0.1:${port}/api/${endpoint}`, {
          method: body ? "POST" : "GET",
          headers: { "Content-Type": "application/json", ...extra },
          body: body ? JSON.stringify(body) : undefined,
        });
        return { status: r.status, data: await r.json() };
      }
      assert.equal(
        (await call("repository", { path: dir })).data.deleted.length,
        1,
      );
      assert.equal((await call("status")).data.installed, true);
      assert.equal((await call("index", {})).data.indexed, 2);
      const a = await call("ask", { question: "cache" });
      assert.equal(a.data.retrieval, "hybrid");
      assert.deepEqual(a.data.citations, [hash.slice(0, 7)]);
      const e = await call("ask", {
        question: "epitaph",
        epitaph: true,
        commitHash: hash,
      });
      assert.equal(e.data.retrieval, "exact commit");
      const fileExp = await call("explain-file", { file: "cache.js" });
      assert.equal(fileExp.status, 200);
      assert.equal(fileExp.data.file, "cache.js");
      assert.ok(fileExp.data.sources.length > 0);
      invalid = true;
      assert.equal((await call("ask", { question: "cache" })).status, 502);
      assert.equal((await call("ask", { question: "" })).status, 400);
      assert.equal(
        (
          await call(
            "repository",
            { path: dir },
            { Origin: "https://evil.example" },
          )
        ).status,
        403,
      );
    } finally {
      if (child) {
        child.kill();
        await new Promise((resolve) => {
          if (child.exitCode !== null) resolve();
          else child.once("exit", resolve);
        });
      }
      await new Promise((resolve) => mock.close(resolve));
      await rm(dir, { recursive: true, force: true });
    }
  },
);
