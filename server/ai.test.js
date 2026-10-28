import { test } from "node:test";
import assert from "node:assert/strict";
import { cosine, inspectCitations } from "./ai.js";
import { retrieve } from "./history.js";
const sources = [
  {
    hash: "abcdef0123456789",
    subject: "Redis cache",
    patch: "session fallback",
  },
];
test("cosine handles equal, orthogonal and empty vectors", () => {
  assert.equal(cosine([1, 0], [1, 0]), 1);
  assert.equal(cosine([1, 0], [0, 1]), 0);
  assert.equal(cosine([], []), 0);
});
test("only bracketed unique evidence hashes validate", () => {
  const r = inspectCitations(
    "Claim [abcdef0], invalid [1111111], bare abcdef0",
    sources,
  );
  assert.deepEqual(r.citations, ["abcdef0"]);
  assert.deepEqual(r.invalidCitations, ["1111111"]);
  assert.equal(
    inspectCitations("[abcdef0]", [...sources, { hash: "abcdef0999999999" }])
      .hasCitations,
    false,
  );
});
test("irrelevant retrieval abstains", () => {
  assert.equal(retrieve(sources, "Why did the unicorn dance?").length, 0);
  assert.equal(retrieve(sources, "Redis fallback").length, 1);
});
