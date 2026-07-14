import assert from "node:assert/strict";
import test from "node:test";

import { buildDevSearchText } from "../.test-dist/searchModel.js";

const baseClip = {
  body: "rm -rf dist",
  title: "Clean build output",
  vault: "Terminal",
  type: "Command",
  riskLabel: "Recursive delete",
  description: "Remove generated artifacts.",
  whenToUse: "Only after checking the target directory.",
  before: "Run pwd first.",
  risk: "destructive",
};

test("builds search text from body, metadata, notes, and risk fields", () => {
  const searchText = buildDevSearchText(baseClip);

  assert.match(searchText, /rm -rf dist/);
  assert.match(searchText, /Clean build output/);
  assert.match(searchText, /Terminal/);
  assert.match(searchText, /Recursive delete/);
  assert.match(searchText, /Remove generated artifacts/);
  assert.match(searchText, /Run pwd first/);
  assert.match(searchText, /destructive/);
});

test("adds developer synonyms for risky command searches", () => {
  const searchText = buildDevSearchText(baseClip);

  assert.match(searchText, /再帰的に削除/);
  assert.match(searchText, /dist削除/);
  assert.match(searchText, /remove delete/);
});

test("adds secret-related metadata without mutating the original text", () => {
  const searchText = buildDevSearchText({
    ...baseClip,
    body: "OPENAI_API_TOKEN=example",
    title: "Token assignment",
    risk: "check",
  });

  assert.match(searchText, /OPENAI_API_TOKEN=example/);
  assert.match(searchText, /機密情報/);
  assert.match(searchText, /secret token password env/);
});
