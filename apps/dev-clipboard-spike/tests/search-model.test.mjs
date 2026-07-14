import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDevSearchText,
  detectMatchField,
  detectMatchReason,
  matchesSearchFilters,
  sourceApp,
} from "../.test-dist/searchModel.js";

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

test("detects direct match fields before metadata reasons", () => {
  assert.equal(detectMatchField(baseClip, "generated artifacts"), "Description");
  assert.equal(detectMatchReason(baseClip, "generated artifacts"), undefined);
});

test("returns metadata reason for developer synonym matches", () => {
  assert.equal(detectMatchField(baseClip, "再帰的に削除"), undefined);
  assert.equal(
    detectMatchReason(baseClip, "再帰的に削除"),
    'Dev metadata maps "再帰的に削除" to Recursive delete',
  );
});

test("matches selected safety, vault, type, media, and app filters", () => {
  assert.equal(
    matchesSearchFilters(baseClip, [
      { category: "Safety", label: "Risk", value: "risk" },
      { category: "Vault", label: "Terminal", value: "terminal" },
      { category: "Type", label: "Command", value: "command" },
    ]),
    true,
  );
  assert.equal(
    matchesSearchFilters(baseClip, [
      { category: "Safety", label: "Safe", value: "safe" },
    ]),
    false,
  );
  assert.equal(
    matchesSearchFilters(
      {
        ...baseClip,
        type: "Image",
      },
      [{ category: "Media", label: "Image", value: "image" }],
    ),
    true,
  );
});

test("uses captured source app metadata before content fallback", () => {
  assert.deepEqual(
    sourceApp({
      ...baseClip,
      sourceAppName: "Finder",
      sourceAppBundleId: "com.apple.finder",
    }),
    { label: "Fi", name: "Finder", className: "source-finder" },
  );
  assert.deepEqual(
    sourceApp({
      ...baseClip,
      sourceAppName: "Zed",
      sourceAppBundleId: "dev.zed.Zed",
    }),
    { label: "Z", name: "Zed", className: "source-dev" },
  );
});
