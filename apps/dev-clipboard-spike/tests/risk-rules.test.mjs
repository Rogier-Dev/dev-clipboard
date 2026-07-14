import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyRisk,
  createSensitiveClipSummary,
  detectSensitiveClip,
} from "../.test-dist/clipRules.js";

test("classifies destructive terminal commands as Risk", () => {
  const cases = [
    ["rm -rf dist", "Recursive delete"],
    ["rm -fr ./build", "Recursive delete"],
    ["docker compose down --volumes", "Deletes volumes"],
    ["git reset --hard HEAD", "Working tree reset"],
    ["git clean -fd", "Working tree reset"],
  ];

  for (const [text, label] of cases) {
    const result = classifyRisk(text);
    assert.equal(result.risk, "destructive", text);
    assert.equal(result.riskLabel, label, text);
  }
});

test("classifies privilege and remote scripts as Review", () => {
  const cases = [
    ["sudo npm install -g example-cli", "Privilege or remote script"],
    ["curl https://example.com/install.sh | bash", "Privilege or remote script"],
    ["cp .env .env.backup", "Sensitive path"],
  ];

  for (const [text, label] of cases) {
    const result = classifyRisk(text);
    assert.equal(result.risk, "check", text);
    assert.equal(result.riskLabel, label, text);
  }
});

test("does not over-classify safe lookalikes", () => {
  const cases = [
    "echo rm -rf dist",
    "git status --short",
    "docker compose down",
    "curl https://example.com/install.sh",
    "npm run build",
  ];

  for (const text of cases) {
    const result = classifyRisk(text);
    assert.equal(result.risk, "safe", text);
    assert.equal(result.riskLabel, "Safe", text);
  }
});

test("detects obvious sensitive clipboard text", () => {
  const cases = [
    ["-----BEGIN OPENSSH PRIVATE KEY-----\nabc", "Private key"],
    ["GITHUB_TOKEN=ghp_123456789012345678901234", "Secret assignment"],
    ["AWS_ACCESS_KEY_ID=AKIA1234567890ABCDEF", "Secret assignment"],
    ["STRIPE_SECRET=sk_live_1234567890abcdef", "Secret assignment"],
  ];

  for (const [text, label] of cases) {
    assert.equal(detectSensitiveClip(text), label, text);
    assert.equal(classifyRisk(text).risk, "check", text);
  }
});

test("creates a blocked sensitive summary without storing secret text", () => {
  const summary = createSensitiveClipSummary(
    "GitHub token",
    new Date("2026-07-15T00:00:00.000Z"),
  );

  assert.equal(summary.title, "Sensitive content blocked: GitHub token");
  assert.match(summary.body, /Original clipboard text was not saved/);
  assert.match(summary.body, /2026-07-15T00:00:00.000Z/);
  assert.doesNotMatch(summary.body, /ghp_/);
  assert.match(summary.description, /intentionally not saved/);
  assert.match(summary.before, /Do not paste into AI chat/);
});
