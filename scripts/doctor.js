import { execFileSync } from "node:child_process";
import { status } from "../server/ai.js";
console.log("Git Séance setup check\n");
console.log(`Node: ${process.version}`);
try {
  console.log(execFileSync("git", ["--version"], { encoding: "utf8" }).trim());
} catch {
  console.error("Git is missing");
  process.exitCode = 1;
}
const s = await status();
console.log(`Ollama: ${s.connected ? "connected" : "not reachable"}`);
console.log(
  `Chat model: ${s.model} — ${s.installed ? "installed" : "missing"}`,
);
console.log(
  `Embedding model: ${s.embeddingModel} — ${s.embeddingInstalled ? "installed" : "missing (keyword retrieval remains available)"}`,
);
if (!s.connected || !s.installed) {
  console.log(`\nStart Ollama and run: ollama pull ${s.model}`);
  process.exitCode = 1;
}
if (!s.embeddingInstalled)
  console.log(`Optional: ollama pull ${s.embeddingModel}`);
