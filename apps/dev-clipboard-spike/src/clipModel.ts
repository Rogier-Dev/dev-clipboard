export type Vault = "Chat" | "Editor" | "Terminal";

export type SourceApplication = {
  name: string;
  bundleId: string;
};

export function estimateTokens(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

export function countLines(text: string) {
  return text.length === 0 ? 0 : text.split(/\r\n|\r|\n/).length;
}

export function detectVault(text: string): Vault {
  const trimmed = text.trim();

  if (
    /^(rm|mv|cp|mkdir|pnpm|npm|yarn|bun|git|docker|cargo|brew|sudo|curl)\b/.test(
      trimmed,
    )
  ) {
    return "Terminal";
  }

  if (/```|^#\s|prompt|system:|user:|assistant:|要約|レビュー/i.test(trimmed)) {
    return "Chat";
  }

  return "Editor";
}

export function detectType(text: string, vault: Vault) {
  const trimmed = text.trim();

  if (vault === "Terminal") return "Command";
  if (/^#[0-9a-f]{3,8}$/i.test(trimmed) || /^rgba?\(/i.test(trimmed)) {
    return "Color";
  }
  if (/^#|```|\n[-*]\s/.test(trimmed)) return "Markdown";
  if (/^https?:\/\//i.test(trimmed)) return "URL";
  if (/[{};]/.test(trimmed) || /<\/?[a-z][\s\S]*>/i.test(trimmed)) {
    return "Code";
  }

  return "Text";
}

export function makeTitle(text: string, type: string) {
  const firstLine = text.trim().split(/\r\n|\r|\n/)[0] || "Untitled clip";
  const compact = firstLine.replace(/\s+/g, " ").slice(0, 58);

  if (type === "Command") {
    if (/rm\s+/.test(firstLine)) return "Clean build output";
    if (/docker\s+compose\s+down/.test(firstLine)) return "Stop Docker stack";
    if (/git\s+/.test(firstLine)) return "Git workflow command";
  }

  return compact;
}
