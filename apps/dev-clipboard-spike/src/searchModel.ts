export type SearchableClip = {
  body: string;
  title: string;
  vault: string;
  type: string;
  risk: "safe" | "check" | "destructive" | string;
  riskLabel: string;
  description: string;
  whenToUse: string;
  before: string;
  sourceAppName?: string;
  sourceAppBundleId?: string;
  matchField?: string;
  matchReason?: string;
};

export type SearchFilterCategory = "Safety" | "Vault" | "Type" | "Media" | "App";

export type SearchFilterToken = {
  category: SearchFilterCategory;
  label: string;
  value: string;
};

export type SourceAppDisplay = {
  label: string;
  name: string;
  className: string;
};

export const DEV_SEARCH_SYNONYMS: Array<[RegExp, string]> = [
  [
    /\brm\s+(-[a-zA-Z]*r[a-zA-Z]*f|-rf|-fr)\b/i,
    "再帰的に削除 再起的に削除 再帰削除 再起削除 削除 remove delete clean build output dist削除",
  ],
  [
    /docker\s+compose\s+down\b.*--volumes/i,
    "volume削除 ボリューム削除 docker停止 コンテナ削除",
  ],
  [/\bgit\s+reset\s+--hard\b/i, "変更破棄 git履歴 作業ツリー reset hard"],
  [/\bgit\s+clean\b/i, "未追跡ファイル削除 clean untracked"],
  [/\bsudo\b/i, "管理者権限 privilege 権限 root"],
  [
    /\bcurl\b.*\|\s*(sh|bash)/i,
    "remote script リモートスクリプト pipe install",
  ],
  [
    /\.env|token|secret|password|id_rsa/i,
    "機密情報 secret token password env 秘密鍵",
  ],
];

export function buildDevSearchText(clip: SearchableClip) {
  const synonyms = DEV_SEARCH_SYNONYMS.filter(([pattern]) =>
    pattern.test(clip.body),
  ).map(([, words]) => words);

  return [
    clip.body,
    clip.title,
    clip.vault,
    clip.type,
    clip.riskLabel,
    clip.description,
    clip.whenToUse,
    clip.before,
    clip.risk,
    ...synonyms,
  ].join(" ");
}

export function riskDisplayLabel(risk: SearchableClip["risk"]) {
  if (risk === "safe") return "Safe";
  if (risk === "check") return "Review";
  return "Risk";
}

export function previewType(clip: Pick<SearchableClip, "type">) {
  return clip.type.toLowerCase();
}

export function sourceApp(clip: SearchableClip): SourceAppDisplay {
  const sourceName = (clip.sourceAppName ?? "").trim();
  const sourceBundleId = (clip.sourceAppBundleId ?? "").toLowerCase();

  if (sourceBundleId === "com.apple.finder" || /finder/i.test(sourceName)) {
    return { label: "Fi", name: "Finder", className: "source-finder" };
  }
  if (/cursor/i.test(sourceName) || sourceBundleId.includes("todesktop")) {
    return { label: "Cu", name: "Cursor", className: "source-cursor" };
  }
  if (/figma/i.test(sourceName)) {
    return { label: "Fg", name: "Figma", className: "source-figma" };
  }
  if (/illustrator/i.test(sourceName)) {
    return { label: "Ai", name: "Illustrator", className: "source-ai" };
  }
  if (/chrome/i.test(sourceName)) {
    return { label: "Ch", name: "Chrome", className: "source-chrome" };
  }
  if (/textedit/i.test(sourceName)) {
    return { label: "Tx", name: "TextEdit", className: "source-textedit" };
  }

  if (clip.sourceAppName) {
    const label = clip.sourceAppName
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2);
    return {
      label: label || clip.sourceAppName.slice(0, 2),
      name: clip.sourceAppName,
      className: "source-dev",
    };
  }

  const type = previewType(clip);

  if (type === "illustrator")
    return { label: "Ai", name: "Illustrator", className: "source-ai" };
  if (clip.body.includes(".fig"))
    return { label: "Fg", name: "Figma", className: "source-figma" };
  if (type === "url")
    return { label: "Ch", name: "Chrome", className: "source-chrome" };
  if (type === "pdf")
    return { label: "Pr", name: "Preview", className: "source-preview" };
  if (type === "file")
    return { label: "Fi", name: "Finder", className: "source-finder" };
  if (type === "audio")
    return { label: "Vm", name: "Voice Memos", className: "source-voice" };
  if (type === "video")
    return { label: "Qt", name: "QuickTime", className: "source-quicktime" };
  if (type === "image")
    return { label: "Sc", name: "Screenshot", className: "source-screenshot" };
  if (["code", "markdown", "svg"].includes(type))
    return { label: "Cu", name: "Cursor", className: "source-cursor" };
  if (type === "color")
    return { label: "Fg", name: "Figma", className: "source-figma" };
  if (type === "text")
    return { label: "Tx", name: "TextEdit", className: "source-textedit" };

  return { label: "Dc", name: "Dev Clipboard", className: "source-dev" };
}

export function searchTerms(query: string) {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

export function valueMatchesQuery(value: string, query: string) {
  const terms = searchTerms(query);
  if (terms.length === 0) return false;

  const normalized = value.toLowerCase();
  return terms.every((term) => normalized.includes(term));
}

export function detectMatchField(clip: SearchableClip, query: string) {
  const fields = [
    ["Body", clip.body],
    ["Title", clip.title],
    ["Description", clip.description],
    ["When to use", clip.whenToUse],
    ["Risk", `${clip.risk} ${clip.riskLabel} ${riskDisplayLabel(clip.risk)}`],
    ["Before", clip.before],
    ["Type", clip.type],
    ["Vault", clip.vault],
  ] as const;

  return fields.find(([, value]) => valueMatchesQuery(value, query))?.[0];
}

export function detectMatchReason(clip: SearchableClip, query: string) {
  const direct = detectMatchField(clip, query);
  if (direct) return undefined;

  const q = query.trim().toLowerCase();
  const synonymMatch = DEV_SEARCH_SYNONYMS.find(
    ([pattern, words]) =>
      pattern.test(clip.body) && words.toLowerCase().includes(q),
  );

  if (synonymMatch) {
    return `Dev metadata maps "${query}" to ${clip.riskLabel}`;
  }

  return "Matched in search metadata";
}

export function shouldShowMatchReason(clip: SearchableClip) {
  return Boolean(clip.matchReason && clip.matchField === "Dev metadata");
}

export function matchesSearchFilters(
  clip: SearchableClip,
  filters: SearchFilterToken[],
) {
  if (filters.length === 0) return true;

  const groups = filters.reduce<Record<SearchFilterCategory, string[]>>(
    (current, filter) => {
      current[filter.category].push(filter.value);
      return current;
    },
    {
      Safety: [],
      Vault: [],
      Type: [],
      Media: [],
      App: [],
    },
  );
  const type = previewType(clip);
  const source = sourceApp(clip).name.toLowerCase();
  const riskValue =
    clip.risk === "safe" ? "safe" : clip.risk === "check" ? "review" : "risk";

  return (
    (groups.Safety.length === 0 || groups.Safety.includes(riskValue)) &&
    (groups.Vault.length === 0 ||
      groups.Vault.includes(clip.vault.toLowerCase())) &&
    (groups.Type.length === 0 || groups.Type.includes(type)) &&
    (groups.Media.length === 0 || groups.Media.includes(type)) &&
    (groups.App.length === 0 || groups.App.includes(source))
  );
}
