export type RiskLevel = "safe" | "check" | "destructive";

export type RiskClassification = {
  risk: RiskLevel;
  riskLabel: string;
  before: string;
};

const SENSITIVE_CLIP_RULES: Array<{ pattern: RegExp; label: string }> = [
  {
    pattern: /-----BEGIN (?:OPENSSH |RSA |DSA |EC |PGP )?PRIVATE KEY-----/i,
    label: "Private key",
  },
  {
    pattern:
      /\b[A-Z0-9_-]*(?:PASSWORD|PASSWD|PWD|SECRET|TOKEN|API[_-]?KEY|ACCESS[_-]?KEY|PRIVATE[_-]?KEY)[A-Z0-9_-]*\s*=\s*['"]?[^'"\s]{8,}/i,
    label: "Secret assignment",
  },
  {
    pattern: /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/,
    label: "GitHub token",
  },
  {
    pattern: /\bAKIA[0-9A-Z]{16}\b/,
    label: "AWS access key",
  },
  {
    pattern: /\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{16,}\b/,
    label: "API key",
  },
];

export function detectSensitiveClip(text: string) {
  return SENSITIVE_CLIP_RULES.find((rule) => rule.pattern.test(text))?.label;
}

export function classifyRisk(text: string): RiskClassification {
  const trimmed = text.trim();
  const sensitiveMatch = detectSensitiveClip(text);

  if (sensitiveMatch) {
    return {
      risk: "check",
      riskLabel: sensitiveMatch,
      before: "Do not paste secrets into prompts, logs, tickets, or shared docs.",
    };
  }

  if (/^docker\s+compose\s+down\b.*--volumes/.test(trimmed)) {
    return {
      risk: "destructive",
      riskLabel: "Deletes volumes",
      before: "Check project and volume names before copying.",
    };
  }

  if (/^rm\s+(-[a-zA-Z]*r[a-zA-Z]*f|-rf|-fr)\b/.test(trimmed)) {
    return {
      risk: "destructive",
      riskLabel: "Recursive delete",
      before: "Run pwd and ls target first. Confirm the path is not empty.",
    };
  }

  if (/^git\s+(reset\s+--hard|clean\s+-)/.test(trimmed)) {
    return {
      risk: "destructive",
      riskLabel: "Working tree reset",
      before: "Check git status and stash or commit important changes first.",
    };
  }

  if (/^(mv|cp)\b.*(\.env|id_rsa|secret|token|password)/i.test(trimmed)) {
    return {
      risk: "check",
      riskLabel: "Sensitive path",
      before:
        "Confirm source, destination, and whether secrets should be copied.",
    };
  }

  if (/^sudo\b|^curl\b.*\|\s*(sh|bash)/.test(trimmed)) {
    return {
      risk: "check",
      riskLabel: "Privilege or remote script",
      before: "Read the command source before copying.",
    };
  }

  return {
    risk: "safe",
    riskLabel: "Safe",
    before: "Ready to copy. Paste manually with Command+V.",
  };
}
