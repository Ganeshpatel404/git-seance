# Git Séance 👻
### The ghost of your codebase remembers.

A local-first Git-history explorer with commit-grounded answers from Gemma through Ollama. Ask about a workaround, inspect the evidence, and write an epitaph for a deleted file.

## Quick start
Requires Node.js 20+, Git, and [Ollama](https://ollama.com). The demo runs without AI models or API keys.

```sh
npm ci
npm run seance
```
Open **http://localhost:3001** for the fictional demo.

### Connect your own repository
```sh
ollama pull gemma3:4b
# Optional: semantic retrieval
ollama pull embeddinggemma
# If the Ollama app is not running, start it with: ollama serve
npm run doctor
ENABLE_LOCAL_REPOS=true npm run seance
```
In Windows PowerShell: `$env:ENABLE_LOCAL_REPOS="true"; npm run seance`.

1. Choose **Connect repository**, enter an absolute path to a trusted Git repository, and open the circle.
2. Ask a question using a filename, symbol, or commit phrase. Keyword retrieval works immediately.
3. For semantic search, install the embedding model, restart the app to refresh its status, and click **Enable semantic search**. Indexing is explicit so you control when repository text is processed.
4. Open the source chips to inspect author, timestamp, full hash, and patch excerpt.
5. In **Code graveyard**, filter deleted files, open a tombstone, and choose **Write an epitaph from this evidence**.

Use **Memory archive** to search commit subjects, authors, and hashes. Escape closes dialogs.

## Architecture
```text
React UI → Express API → read-only Git operations
                              ↓
                    bounded commit/patch corpus
                              ↓
                keyword or hybrid semantic retrieval
                              ↓
                       local Ollama / Gemma
                              ↓
                citation hash checks → evidence UI
```
- Git: up to 150 commits reachable from local refs; patch excerpts capped at 18,000 characters per commit.
- Keyword search: subject and patch scoring, stop-word filtering, and abstention on zero matches.
- Optional semantic search: Ollama embeddings for subject/patch excerpts, in-memory vectors, cosine similarity plus lexical rank bonus. No cloud database.
- Answer context: up to five commits, with patch excerpts capped at 7,000 characters each. Exact-commit context is used for epitaphs.
- Citations: bracketed 7–40-character hashes must identify exactly one supplied commit. Answers containing unknown or ambiguous bracketed hashes are withheld. Missing citations are prominently flagged. These checks do **not** prove that claims are supported; inspect the patch.
- Model-generated epitaphs are creative output, not historical evidence. Generated answers are session-only and not saved.

## Demo integrity
The public demo is a **fictional repository**, not an analysis of a famous open-source project. It contains two rule-based stories (Redis session cache and unused debug logger); unrelated questions receive an explicit lack-of-evidence response. Demo epitaph text is a fixed illustration. No demo response is presented as Gemma output.

## Configuration
| Variable | Default | Purpose |
|---|---|---|
| `ENABLE_LOCAL_REPOS` | disabled | Allow repository paths on the server machine |
| `HOST` | `127.0.0.1` | Bind address; use `0.0.0.0` only for public demo/preview |
| `PORT` | `3001` | HTTP port |
| `OLLAMA_URL` | `http://127.0.0.1:11434` | Trusted Ollama endpoint |
| `OLLAMA_MODEL` | `gemma3:4b` | Generation model |
| `EMBEDDING_MODEL` | `embeddinggemma` | Embedding model |
| `NODE_ENV` | development | Set `production` to serve built frontend |

Gemma and embedding model weights have their own licenses. MIT covers this application code only.

## Security and privacy
Local repository access is **off by default**. Local runs bind to loopback. Never enable repository access on an internet-facing instance. The app is single-user and has no authentication. Cross-origin API requests are rejected, but this is not a replacement for authentication, firewalling, or host restrictions.

Git operations are read-only, external diff/textconv execution is disabled for patch reads, and Git operations have a 30-second blocked-operation timeout. Use trusted, reasonably sized repositories only: output is truncated after extraction, not streamed with a hard memory bound. Deleted-file paths use Git's default quoting, so unusual filenames may display escaped. Merge history can require manual inspection.

Repository patches can contain secrets and hostile prompt text. The model is told to treat them as untrusted evidence, but prompt injection is not solved. Only use a trusted local Ollama endpoint. No repository text is sent to a cloud model by the default configuration. History and embeddings live in process memory; restarting discards them. Switching repository clears the semantic index. Expensive API operations are serialized.

## Validation
```sh
npm test                 # Five unit/integration tests
npm run build            # Production frontend
npm audit                # Dependency advisories
npm run doctor           # Actual local Ollama/model checks
```
Tests cover real temporary Git repositories, deleted-file extraction, keyword abstention, vector math, citation validation, and a local API flow against a **controlled Ollama test double** (embeddings, responses, rejection of bad hashes, epitaph context, origin checks).

Browser checks (start the app first with local access disabled):
```sh
npx playwright install --with-deps chromium
npm run test:browser
```
The browser script checks relevant demo answers, patch dialogs, tombstone filtering, epitaph flow, unrelated-question abstention, public access restrictions, mobile overflow, and browser exceptions. It writes desktop/mobile screenshots under `tests/`.

**Not yet verified:** real Gemma generation and real embedding model inference on local hardware. A passing test-double integration does not establish model quality, runtime performance, or factual accuracy. Do not publish benchmark claims until measured on real repositories. GitHub Actions runs backend tests and the production build; browser checks are manual.

## Deploy the public demo on Render
A `render.yaml` Blueprint is included. Build: `npm ci && npm run build`. Start: `npm start`. Set `NODE_ENV=production` and `HOST=0.0.0.0`. Leave `ENABLE_LOCAL_REPOS` unset. The fictional demo needs no Ollama process, persistent disk, or secret API key.

Deployment has not been performed in a user-owned Render account. Push this folder to a GitHub repository and create a Render Blueprint from it. Never enable local repository access there.

## Remaining challenge work
- Test real Gemma/embedding inference; collect a small, manually verified question/evidence set.
- Add a real, licensed repository showcase rather than treating fictional examples as history.
- Function-level deletion analysis, dangling commit recovery, persistent sqlite vectors, ElevenLabs, and Atlas are **not implemented**.
- Verify official challenge dates, tags, sponsor requirements, and eligibility before submission.
- Record a demo and write the DEV article with honest results; no unmeasured accuracy figures.

Keep a dated build log and clearly identify post-deadline changes. No challenge eligibility or sponsor usage is asserted by this repository.

## License
MIT. See [LICENSE](LICENSE).
