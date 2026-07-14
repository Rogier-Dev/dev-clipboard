import assert from "node:assert/strict";
import test from "node:test";

import {
  countLines,
  detectType,
  detectVault,
  estimateTokens,
  makeTitle,
} from "../.test-dist/clipModel.js";

test("counts lines and estimates tokens predictably", () => {
  assert.equal(countLines(""), 0);
  assert.equal(countLines("one"), 1);
  assert.equal(countLines("one\ntwo\r\nthree"), 3);
  assert.equal(estimateTokens("a"), 1);
  assert.equal(estimateTokens("abcd"), 1);
  assert.equal(estimateTokens("abcde"), 2);
});

test("detects the intended vault for common clipboard text", () => {
  assert.equal(detectVault("git status --short"), "Terminal");
  assert.equal(detectVault("npm run build"), "Terminal");
  assert.equal(detectVault("# Prompt notes"), "Chat");
  assert.equal(detectVault("const enabled = true;"), "Editor");
});

test("detects clip type from text and vault", () => {
  assert.equal(detectType("rm -rf dist", "Terminal"), "Command");
  assert.equal(detectType("#36C5F0", "Editor"), "Color");
  assert.equal(detectType("rgb(100, 100, 100)", "Editor"), "Color");
  assert.equal(detectType("https://example.com/docs", "Chat"), "URL");
  assert.equal(detectType("const value = { ok: true };", "Editor"), "Code");
});

test("makes compact and command-specific titles", () => {
  assert.equal(makeTitle("rm -rf dist", "Command"), "Clean build output");
  assert.equal(
    makeTitle("docker compose down --volumes", "Command"),
    "Stop Docker stack",
  );
  assert.equal(makeTitle("git reset --hard HEAD", "Command"), "Git workflow command");
  assert.equal(makeTitle("", "Text"), "Untitled clip");
  assert.equal(makeTitle("one    two    three", "Text"), "one two three");
});
