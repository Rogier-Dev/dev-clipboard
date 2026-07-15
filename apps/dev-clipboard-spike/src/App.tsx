import { type MouseEvent, useEffect, useRef, useState } from "react";
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import Database from "@tauri-apps/plugin-sql";
import { invoke } from "@tauri-apps/api/core";
import {
  getCurrentWindow,
  currentMonitor,
  LogicalPosition,
  LogicalSize,
} from "@tauri-apps/api/window";
import {
  createBundledHighlighter,
  createSingletonShorthands,
} from "@shikijs/core";
import { createJavaScriptRegexEngine } from "@shikijs/engine-javascript";
import {
  classifyRisk,
  createSensitiveClipSummary,
  detectSensitiveClip,
  type RiskLevel,
} from "./clipRules";
import {
  countLines,
  detectType,
  detectVault,
  estimateTokens,
  makeTitle,
  type SourceApplication,
  type Vault,
} from "./clipModel";
import {
  buildDevSearchText,
  detectMatchField,
  detectMatchReason,
  matchesSearchFilters,
  previewType,
  riskDisplayLabel,
  shouldShowMatchReason,
  sourceApp,
  type SearchFilterToken,
} from "./searchModel";
import {
  ArrowDownUp,
  Check,
  AudioLines,
  Copy,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Columns3,
  Braces,
  Eye,
  FileCode2,
  FileText,
  FolderOpen,
  HardDrive,
  Image as ImageIcon,
  MessageSquare,
  Link,
  Maximize2,
  Palette,
  Pencil,
  PenTool,
  Play,
  RefreshCw,
  Rows3,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Square,
  Terminal,
  TriangleAlert,
  Trash2,
  Type as TypeIcon,
  Video,
  WrapText,
  X,
} from "lucide-react";
import "./App.css";

type NoteField = "description" | "whenToUse" | "before";
type CardSize = "compact" | "normal" | "large";
type SortMode = "recent" | "risk" | "used";
type ColorFormat = "hex" | "rgb" | "hsl" | "rgba";
type ThemeMode = "system" | "dark" | "light";
type ClipContextMenu = {
  clipId: string;
  x: number;
  y: number;
};
type ClipOperation = "copy" | "delete" | "restore" | "save";

type Clip = {
  id: string;
  body: string;
  title: string;
  vault: Vault;
  type: string;
  risk: RiskLevel;
  riskLabel: string;
  description: string;
  whenToUse: string;
  before: string;
  createdAt: string;
  lastUsedAt?: string;
  useCount: number;
  charCount: number;
  lineCount: number;
  tokenEstimate: number;
  isDemo: boolean;
  sourceAppName: string;
  sourceAppBundleId: string;
  matchField?: string;
  matchReason?: string;
};

type ClipRow = Omit<Clip, "matchField">;

const DB_PATH = "sqlite:dev-clipboard-spike.db";
const APP_BUNDLE_ID = "com.department.devclipboard";
const COMPACT_PANEL_WIDTH = 380;
const NORMAL_PANEL_WIDTH = 580;
const LARGE_PANEL_WIDTH = 700;
const DEFAULT_PANEL_WIDTH = NORMAL_PANEL_WIDTH;
const PANEL_LEFT_MARGIN = 20;
const PANEL_VERTICAL_PADDING = 20;
const PANEL_HIDDEN_X = -(LARGE_PANEL_WIDTH + PANEL_LEFT_MARGIN);
const RISK_ORDER: Record<RiskLevel, number> = {
  destructive: 0,
  check: 1,
  safe: 2,
};
const CARD_SIZES: Array<{
  icon: typeof Square;
  label: string;
  value: CardSize;
}> = [
  { icon: Square, label: "Compact", value: "compact" },
  { icon: Columns3, label: "Normal", value: "normal" },
  { icon: Maximize2, label: "Large", value: "large" },
];

const NOTE_FIELDS: Record<
  NoteField,
  { label: string; dbColumn: "description" | "when_to_use" | "before" }
> = {
  description: { label: "Description", dbColumn: "description" },
  whenToUse: { label: "When to use", dbColumn: "when_to_use" },
  before: { label: "Before", dbColumn: "before" },
};

const SORT_OPTIONS: Array<{ label: string; value: SortMode }> = [
  { label: "Recent", value: "recent" },
  { label: "Risk", value: "risk" },
  { label: "Used", value: "used" },
];

const THEME_OPTIONS: Array<{ label: string; value: ThemeMode }> = [
  { label: "System", value: "system" },
  { label: "Dark", value: "dark" },
  { label: "Light", value: "light" },
];

const THEME_STORAGE_KEY = "dev-clipboard-theme-mode";
const CARD_SIZE_STORAGE_KEY = "dev-clipboard-card-size";
const IGNORED_APPS_STORAGE_KEY = "dev-clipboard-ignored-apps";
const SHIKI_THEME = "github-dark" as const;
const SHIKI_LANGUAGES = [
  "bash",
  "shellscript",
  "typescript",
  "tsx",
  "javascript",
  "json",
  "markdown",
  "html",
  "css",
  "sql",
  "dotenv",
  "diff",
] as const;
type ShikiLanguage = (typeof SHIKI_LANGUAGES)[number];

const createDevClipboardHighlighter = createBundledHighlighter({
  langs: {
    bash: () => import("@shikijs/langs/bash"),
    shellscript: () => import("@shikijs/langs/shellscript"),
    typescript: () => import("@shikijs/langs/typescript"),
    tsx: () => import("@shikijs/langs/tsx"),
    javascript: () => import("@shikijs/langs/javascript"),
    json: () => import("@shikijs/langs/json"),
    markdown: () => import("@shikijs/langs/markdown"),
    html: () => import("@shikijs/langs/html"),
    css: () => import("@shikijs/langs/css"),
    sql: () => import("@shikijs/langs/sql"),
    dotenv: () => import("@shikijs/langs/dotenv"),
    diff: () => import("@shikijs/langs/diff"),
  },
  themes: {
    [SHIKI_THEME]: () => import("@shikijs/themes/github-dark"),
  },
  engine: () => createJavaScriptRegexEngine(),
});

const { codeToHtml: codeToHtmlLimited } = createSingletonShorthands(
  createDevClipboardHighlighter,
);

function isSqliteLockedError(error: unknown) {
  return /database is locked|code:\s*5/i.test(String(error));
}

function isClipboardTextUnavailable(error: unknown) {
  return /clipboard contents were not available|requested format|clipboard is empty/i.test(
    String(error),
  );
}

function isCapturedClipboardReadError(text: string) {
  return /^Clipboard read failed: .*clipboard contents were not available.*clipboard is empty\.?$/i.test(
    text.trim(),
  );
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function panelWidthForCardSize(size: CardSize) {
  if (size === "compact") return COMPACT_PANEL_WIDTH;
  if (size === "large") return LARGE_PANEL_WIDTH;
  return NORMAL_PANEL_WIDTH;
}

async function withSqliteRetry<T>(work: () => Promise<T>): Promise<T> {
  const maxAttempts = 5;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await work();
    } catch (error) {
      if (attempt < maxAttempts && isSqliteLockedError(error)) {
        await wait(250 * attempt);
        continue;
      }
      throw error;
    }
  }

  throw new Error("SQLite retry limit reached");
}

function getTauriWindow() {
  try {
    return getCurrentWindow();
  } catch {
    return null;
  }
}

function readStoredThemeMode(): ThemeMode {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "system" || stored === "dark" || stored === "light") {
    return stored;
  }
  return "system";
}

function readStoredCardSize(): CardSize {
  if (typeof window === "undefined") return "normal";
  const stored = window.localStorage.getItem(CARD_SIZE_STORAGE_KEY);
  return stored === "compact" || stored === "large" ? stored : "normal";
}

function readStoredIgnoredApps() {
  if (typeof window === "undefined") return [] as string[];

  try {
    const value = JSON.parse(
      window.localStorage.getItem(IGNORED_APPS_STORAGE_KEY) ?? "[]",
    );
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

const DEMO_HEAVY_CLIPS: Clip[] = ([
  {
    id: "demo-review-command-20260701",
    title: "Check dependencies before install",
    body: "npm install",
    vault: "Terminal",
    type: "Command",
    risk: "check",
    riskLabel: "Review",
    description:
      "Mock command that changes local dependencies. Use this card to compare how Compact, Normal, and Large handle a medium-length Description line without changing the visual scale of the card.",
    whenToUse:
      "When installing packages after checking package.json, lockfile changes, package source, and whether the command belongs to the current project workspace.",
    before:
      "Confirm the project directory, review the package source, and check that the dependency change is intentional before copying this command.",
    createdAt: "2026-07-01T03:14:30.000Z",
    useCount: 0,
    charCount: 11,
    lineCount: 1,
    tokenEstimate: 3,
  },
  {
    id: "demo-risk-terminal-delete-20260701",
    title: "Remove build output recursively",
    body: "rm -rf dist",
    vault: "Terminal",
    type: "Command",
    risk: "destructive",
    riskLabel: "Risk",
    description: "Mock destructive command used to check risk card styling.",
    whenToUse:
      "Only when cleaning generated build output in the confirmed project directory.",
    before:
      "Run pwd and ls dist first. Confirm the target path is not empty or sensitive.",
    createdAt: "2026-07-01T03:14:00.000Z",
    useCount: 0,
    charCount: 11,
    lineCount: 1,
    tokenEstimate: 3,
  },
  {
    id: "demo-color-token-20260701",
    title: "#36C5F0",
    body: "#36C5F0",
    vault: "Editor",
    type: "Color",
    risk: "safe",
    riskLabel: "Safe",
    description: "",
    whenToUse: "",
    before: "",
    createdAt: "2026-07-01T03:13:00.000Z",
    useCount: 0,
    charCount: 7,
    lineCount: 1,
    tokenEstimate: 2,
  },
  {
    id: "demo-pdf-reference-20260701",
    title: "Product requirements PDF",
    body: `[PDF clipboard payload]
File: Dev-Clipboard-Requirements.pdf
Pages: 18
Estimated data size: 3.4 MB`,
    vault: "Chat",
    type: "PDF",
    risk: "safe",
    riskLabel: "Safe",
    description: "Mock PDF document used to check document preview cards.",
    whenToUse: "When keeping a reference document near AI planning work.",
    before:
      "Use a page summary or selected quote instead of pasting the whole PDF.",
    createdAt: "2026-07-01T03:12:00.000Z",
    useCount: 0,
    charCount: 1100,
    lineCount: 4,
    tokenEstimate: 70,
  },
  {
    id: "demo-file-reference-20260701",
    title: "Local design asset file",
    body: `/Users/department/Documents/Dev_Assets/hero-layout.fig`,
    vault: "Editor",
    type: "File",
    risk: "safe",
    riskLabel: "Safe",
    description: "Mock copied file reference from Finder.",
    whenToUse:
      "When reusing a local design source or attaching context to a task.",
    before: "Confirm the file path is still valid before sharing.",
    createdAt: "2026-07-01T03:11:00.000Z",
    useCount: 0,
    charCount: 58,
    lineCount: 1,
    tokenEstimate: 14,
  },
  {
    id: "demo-url-reference-20260701",
    title: "OpenAI API reference page",
    body: "https://platform.openai.com/docs/api-reference/responses",
    vault: "Chat",
    type: "URL",
    risk: "safe",
    riskLabel: "Safe",
    description: "Mock copied documentation URL.",
    whenToUse:
      "When keeping an external reference close to a prompt or implementation task.",
    before: "Open in browser when the local vault does not explain the topic.",
    createdAt: "2026-07-01T03:10:00.000Z",
    useCount: 0,
    charCount: 56,
    lineCount: 1,
    tokenEstimate: 14,
  },
  {
    id: "demo-svg-icon-20260701",
    title: "SVG icon asset",
    body: `<svg width="96" height="96" viewBox="0 0 96 96" fill="none">
  <rect x="18" y="18" width="60" height="60" rx="16" fill="#EFF30A"/>
  <path d="M31 50L43 62L66 35" stroke="#111111" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`,
    vault: "Editor",
    type: "SVG",
    risk: "safe",
    riskLabel: "Safe",
    description: "Mock SVG asset copied from a design or codebase.",
    whenToUse:
      "When reusing an icon while checking its dimensions and fill colors.",
    before:
      "Confirm license/source and remove unnecessary attributes before pasting into code.",
    createdAt: "2026-07-01T03:09:00.000Z",
    useCount: 0,
    charCount: 248,
    lineCount: 4,
    tokenEstimate: 62,
  },
  {
    id: "demo-video-reference-20260701",
    title: "Screen recording clip",
    body: `[Video clipboard payload]
Format: MOV
Duration: 00:18
Dimensions: 1920 x 1080
Estimated data size: 42.3 MB`,
    vault: "Editor",
    type: "Video",
    risk: "safe",
    riskLabel: "Safe",
    description: "Mock screen recording stored as a heavy clipboard item.",
    whenToUse:
      "When reviewing an interaction or animation before turning it into notes.",
    before:
      "Consider saving a file reference instead of keeping the full payload in history.",
    createdAt: "2026-07-01T03:08:00.000Z",
    useCount: 0,
    charCount: 1200,
    lineCount: 5,
    tokenEstimate: 90,
  },
  {
    id: "demo-audio-note-20260701",
    title: "Voice memo snippet",
    body: `[Audio clipboard payload]
Format: M4A
Duration: 00:42
Estimated data size: 2.1 MB`,
    vault: "Chat",
    type: "Audio",
    risk: "safe",
    riskLabel: "Safe",
    description:
      "Mock audio clip that may later become a transcription source.",
    whenToUse: "When storing short spoken context alongside AI notes.",
    before: "Transcribe or summarize before sending to AI when possible.",
    createdAt: "2026-07-01T03:07:00.000Z",
    useCount: 0,
    charCount: 860,
    lineCount: 4,
    tokenEstimate: 40,
  },
  {
    id: "demo-large-ai-context-20260630",
    title: "Large AI context: refactor notes and logs",
    body: `# Refactor notes and logs

This is a mock long-context clip for checking token and line tags.
It represents copied docs, terminal output, and AI chat context that should be reviewed before sending to an AI model.

Important:
- Trim repeated stack traces.
- Keep only the failing request and the latest error.
- Remove credentials, account IDs, and private URLs before pasting.`,
    vault: "Chat",
    type: "Markdown",
    risk: "check",
    riskLabel: "Large context",
    description:
      "Mock long-context note used to compare card density across Compact, Normal, and Large. Large should reveal this full note while keeping title, buttons, tags, radius, and spacing visually consistent with Normal.",
    whenToUse:
      "Use when preparing a large AI prompt, debugging summary, or handoff where the notes explain why the body exists and what the receiver should inspect first.",
    before:
      "Trim repeated logs, remove secrets, check account IDs and private URLs, and confirm the text is safe to paste into the target app before copying.",
    createdAt: "2026-06-30T03:00:00.000Z",
    useCount: 0,
    charCount: 128000,
    lineCount: 420,
    tokenEstimate: 32000,
  },
  {
    id: "demo-illustrator-data-20260630",
    title: "Illustrator copied object with embedded image",
    body: `[Illustrator clipboard payload]
Type: vector artwork + embedded preview
Artboard: Landing hero mock
Estimated data size: 24.8 MB

This mock stands in for a copied Illustrator object that is useful visually but heavy for clipboard history.`,
    vault: "Editor",
    type: "Illustrator",
    risk: "safe",
    riskLabel: "Safe",
    description: "Mock rich clipboard data from Adobe Illustrator.",
    whenToUse: "When checking how heavy design assets appear in the list.",
    before: "Consider keeping a lightweight preview instead of full payload.",
    createdAt: "2026-06-30T02:59:00.000Z",
    useCount: 0,
    charCount: 2048,
    lineCount: 6,
    tokenEstimate: 120,
  },
  {
    id: "demo-image-asset-20260630",
    title: "Screenshot image with transparent crop target",
    body: `[Image clipboard payload]
Format: PNG
Dimensions: 2880 x 1800
Estimated data size: 8.6 MB

Mock image clip for checking data-size tags and future crop/cleanup behavior.`,
    vault: "Editor",
    type: "Image",
    risk: "safe",
    riskLabel: "Safe",
    description: "Mock image clip used to check large asset handling.",
    whenToUse:
      "When deciding whether an image clip should be stored or cleaned up.",
    before: "Crop unnecessary whitespace before reusing as a design asset.",
    createdAt: "2026-06-30T02:58:00.000Z",
    useCount: 0,
    charCount: 1024,
    lineCount: 5,
    tokenEstimate: 80,
  },
] as Array<
  Omit<Clip, "isDemo" | "sourceAppName" | "sourceAppBundleId">
>).map((clip) => ({
  ...clip,
  title: clip.title.startsWith("[Demo] ") ? clip.title : `[Demo] ${clip.title}`,
  isDemo: true,
  sourceAppName: "",
  sourceAppBundleId: "",
}));

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function detectLanguage(clip: Clip): ShikiLanguage {
  const body = clip.body.trim();

  if (clip.vault === "Terminal") return "bash";
  if (/\.env|^[A-Z_]+=/m.test(body)) return "dotenv";
  if (/^diff --git\b|^[-+]{3}\s/m.test(body)) return "diff";
  if (/tsx|jsx|React|use[A-Z]/.test(body)) return "tsx";
  if (/<\/?[a-z][\s\S]*>/i.test(body)) return "html";
  if (/^\s*[{[]/.test(body)) return "json";
  if (/^#|```|\n[-*]\s/.test(body)) return "markdown";
  if (/\bSELECT\b|\bFROM\b|\bWHERE\b/i.test(body)) return "sql";
  if (/[{};]/.test(body)) return "typescript";

  return "markdown";
}

function shouldHighlightClip(clip: Clip) {
  return ["command", "code", "markdown", "svg", "text"].includes(
    previewType(clip),
  );
}

function createClip(text: string, sourceApplication?: SourceApplication): Clip {
  const vault = detectVault(text);
  const type = detectType(text, vault);
  const risk = classifyRisk(text);

  return {
    id: createId(),
    body: text,
    title: makeTitle(text, type),
    vault,
    type,
    risk: risk.risk,
    riskLabel: risk.riskLabel,
    description: "",
    whenToUse: "",
    before: risk.before,
    createdAt: new Date().toISOString(),
    useCount: 0,
    charCount: text.length,
    lineCount: countLines(text),
    tokenEstimate: estimateTokens(text),
    isDemo: false,
    sourceAppName: sourceApplication?.name ?? "",
    sourceAppBundleId: sourceApplication?.bundleId ?? "",
  };
}

function createBlockedSensitiveClip(
  sensitiveLabel: string,
  sourceApplication?: SourceApplication,
): Clip {
  const summary = createSensitiveClipSummary(sensitiveLabel);

  return {
    id: createId(),
    body: summary.body,
    title: summary.title,
    vault: "Editor",
    type: "Text",
    risk: "destructive",
    riskLabel: summary.label,
    description: summary.description,
    whenToUse: summary.whenToUse,
    before: summary.before,
    createdAt: new Date().toISOString(),
    useCount: 0,
    charCount: summary.body.length,
    lineCount: countLines(summary.body),
    tokenEstimate: estimateTokens(summary.body),
    isDemo: false,
    sourceAppName: sourceApplication?.name ?? "",
    sourceAppBundleId: sourceApplication?.bundleId ?? "",
  };
}

function formatRelative(iso?: string) {
  if (!iso) return "never used";

  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(1, Math.round(diff / 60000));

  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  return `${Math.round(hours / 24)}d ago`;
}

function clipSavedText(clip: Clip) {
  return `Saved ${formatRelative(clip.createdAt)}`;
}

function clipUsedText(clip: Clip) {
  if (clip.useCount === 0) return "Used 0 times";
  return `Used ${clip.useCount} times · ${formatRelative(clip.lastUsedAt)}`;
}

function shouldUseRichPreview(clip: Clip) {
  return [
    "image",
    "illustrator",
    "svg",
    "audio",
    "video",
    "url",
    "file",
    "pdf",
    "color",
  ].includes(previewType(clip));
}

function isMediaPreviewClip(clip: Clip) {
  return [
    "image",
    "illustrator",
    "svg",
    "audio",
    "video",
    "url",
    "file",
    "pdf",
    "color",
  ].includes(previewType(clip));
}

function canEditClipText(clip: Clip) {
  return ["text", "command", "code", "markdown", "url", "svg"].includes(
    previewType(clip),
  );
}

function visibleNoteFields(clip: Clip): NoteField[] {
  const type = previewType(clip);

  if (type === "color") {
    return [];
  }

  if (["image", "audio", "video"].includes(type)) {
    return ["description"];
  }

  if (["illustrator", "file", "pdf"].includes(type)) {
    return ["description", "before"];
  }

  if (type === "url") {
    return ["description", "whenToUse"];
  }

  return ["description", "whenToUse", "before"];
}

function PreviewMeta({ items }: { items: string[] }) {
  return (
    <div className="previewMeta">
      {items.map((item) => (
        <span className="previewMetaItem" key={item}>
          {item}
        </span>
      ))}
    </div>
  );
}

function colorDisplayValue(clip: Clip, format: ColorFormat) {
  if (format === "rgb") return "rgb(54, 197, 240)";
  if (format === "hsl") return "hsl(194, 86%, 58%)";
  if (format === "rgba") return "rgba(54, 197, 240, 1)";
  return clip.body.trim();
}

function colorFormatLabel(format: ColorFormat) {
  if (format === "rgb") return "RGB";
  if (format === "hsl") return "HSL";
  if (format === "rgba") return "RGBA";
  return "HEX";
}

function clipDisplayTitle(
  clip: Clip,
  colorFormatsByClip: Record<string, ColorFormat>,
) {
  if (previewType(clip) !== "color") return clip.title;

  const autoTitle = clip.title.trim() === clip.body.trim();
  if (!autoTitle) return clip.title;

  return colorDisplayValue(clip, colorFormatsByClip[clip.id] ?? "hex");
}

function titleEditValue(
  clip: Clip,
  colorFormatsByClip: Record<string, ColorFormat>,
) {
  if (previewType(clip) !== "color") return clip.title;
  return clipDisplayTitle(clip, colorFormatsByClip);
}

function TypeBadgeIcon({ type }: { type: string }) {
  const normalized = type.toLowerCase();

  if (normalized === "command") return <Terminal size={12} />;
  if (["code", "svg"].includes(normalized)) return <Braces size={12} />;
  if (normalized === "markdown") return <FileText size={12} />;
  if (normalized === "url") return <Link size={12} />;
  if (normalized === "color") return <Palette size={12} />;
  if (normalized === "image") return <ImageIcon size={12} />;
  if (normalized === "audio") return <AudioLines size={12} />;
  if (normalized === "video") return <Video size={12} />;
  if (normalized === "file") return <FolderOpen size={12} />;
  if (normalized === "pdf") return <FileText size={12} />;
  if (normalized === "illustrator") return <PenTool size={12} />;

  return <TypeIcon size={12} />;
}

function RiskBadgeIcon({ risk }: { risk: RiskLevel }) {
  if (risk === "safe") return <ShieldCheck size={12} />;
  if (risk === "check") return <Eye size={12} />;
  return <TriangleAlert size={12} />;
}

function VaultBadgeIcon({ vault }: { vault: Vault }) {
  if (vault === "Chat") return <MessageSquare size={12} />;
  if (vault === "Editor") return <Braces size={12} />;
  return <Terminal size={12} />;
}

function tokenTagClass(clip: Clip) {
  if (clip.tokenEstimate >= 10000) return "tokenTag tokenTag-high";
  if (clip.tokenEstimate >= 1000) return "tokenTag tokenTag-medium";
  return "tokenTag";
}

function FilterIcon({ type }: { type: string }) {
  const normalized = type.toLowerCase();
  if (normalized === "command") return <Terminal size={12} />;
  if (normalized === "code") return <Braces size={12} />;
  if (normalized === "text") return <TypeIcon size={12} />;
  if (normalized === "markdown") return <FileText size={12} />;
  if (normalized === "url") return <Link size={12} />;
  if (normalized === "color") return <Palette size={12} />;
  if (normalized === "image") return <ImageIcon size={12} />;
  if (normalized === "svg") return <FileCode2 size={12} />;
  if (normalized === "illustrator" || normalized === "vector")
    return <PenTool size={12} />;
  if (normalized === "pdf") return <FileText size={12} />;
  if (normalized === "file") return <FolderOpen size={12} />;
  if (normalized === "audio") return <AudioLines size={12} />;
  if (normalized === "video") return <Video size={12} />;
  return <Rows3 size={12} />;
}

function filterKey(filter: SearchFilterToken) {
  return `${filter.category}:${filter.value}`;
}

function formatSearchFilters(filters: SearchFilterToken[]) {
  return filters.map((filter) => filter.label).join(", ");
}

function FilterPill({
  label,
  selected,
  onToggle,
}: {
  label: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      className={selected ? "selected" : undefined}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onToggle}
      type="button"
    >
      <FilterIcon type={label} />
      {label}
    </button>
  );
}

function AppFilterPill({
  label,
  sourceClass,
  sourceLabel,
  selected,
  onToggle,
}: {
  label: string;
  sourceClass: string;
  sourceLabel: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      className={selected ? "selected" : undefined}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onToggle}
      type="button"
    >
      <span className={`appIcon ${sourceClass}`}>{sourceLabel}</span>
      {label}
    </button>
  );
}

function getDomain(url: string) {
  try {
    return new URL(url.trim()).hostname.replace(/^www\./, "");
  } catch {
    return "external link";
  }
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightQuery(text: string, query: string) {
  const q = query.trim();
  if (!q) return text;

  const parts = text.split(new RegExp(`(${escapeRegExp(q)})`, "gi"));

  return parts.map((part, index) =>
    part.toLowerCase() === q.toLowerCase() ? (
      <mark className="searchHighlight" key={`${part}-${index}`}>
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

function extraMetaTags(clip: Clip) {
  const tags: Array<{ className: string; label: string }> = [];

  if (detectSensitiveClip(clip.body)) {
    tags.push({ className: "sensitiveTag", label: "Sensitive" });
  }

  if (clip.tokenEstimate >= 10000) {
    tags.push({
      className: "weightTag weightTag-token",
      label: "AI cost High",
    });
  }

  if (clip.id === "demo-illustrator-data-20260630") {
    tags.push({ className: "weightTag weightTag-size", label: "24.8 MB" });
    tags.push({ className: "weightTag weightTag-rich", label: "Rich data" });
  }

  if (clip.id === "demo-image-asset-20260630") {
    tags.push({ className: "weightTag weightTag-size", label: "8.6 MB" });
    tags.push({ className: "weightTag weightTag-rich", label: "PNG" });
  }

  if (clip.id === "demo-video-reference-20260701") {
    tags.push({ className: "weightTag weightTag-size", label: "42.3 MB" });
    tags.push({ className: "weightTag weightTag-rich", label: "MOV" });
  }

  if (clip.id === "demo-audio-note-20260701") {
    tags.push({ className: "weightTag weightTag-size", label: "2.1 MB" });
    tags.push({ className: "weightTag weightTag-rich", label: "M4A" });
  }

  if (clip.id === "demo-svg-icon-20260701") {
    tags.push({ className: "weightTag weightTag-rich", label: "Vector" });
  }

  if (clip.id === "demo-pdf-reference-20260701") {
    tags.push({ className: "weightTag weightTag-size", label: "3.4 MB" });
    tags.push({ className: "weightTag weightTag-rich", label: "18 pages" });
  }

  if (clip.id === "demo-file-reference-20260701") {
    tags.push({ className: "weightTag weightTag-rich", label: "Figma" });
    tags.push({ className: "weightTag weightTag-rich", label: ".fig" });
    tags.push({ className: "weightTag weightTag-rich", label: "Local path" });
  }

  return tags;
}

const PANEL_SHORTCUT_LABEL = "⌘ ⌥ V";
const CLIP_PAGE_SIZE = 50;
const CLIP_QUERY_LIMIT = 500;

function App() {
  const [clips, setClips] = useState<Clip[]>([]);
  const [visibleClipCount, setVisibleClipCount] = useState(CLIP_PAGE_SIZE);
  const [resultTotal, setResultTotal] = useState(0);
  const [totalClipCount, setTotalClipCount] = useState(0);
  const [status, setStatus] = useState("Opening local SQLite store");
  const [persistentError, setPersistentError] = useState<string | null>(null);
  const [shortcutStatus] = useState(`Shortcut ready: ${PANEL_SHORTCUT_LABEL}`);
  const [query, setQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedSearchFilters, setSelectedSearchFilters] = useState<
    SearchFilterToken[]
  >([]);
  const [dbReady, setDbReady] = useState(false);
  const [windowFocused, setWindowFocused] = useState(false);
  const [copiedClipId, setCopiedClipId] = useState<string | null>(null);
  const [clipOperations, setClipOperations] = useState<
    Record<string, ClipOperation>
  >({});
  const [pendingRiskCopyId, setPendingRiskCopyId] = useState<string | null>(
    null,
  );
  const [colorFormatsByClip, setColorFormatsByClip] = useState<
    Record<string, ColorFormat>
  >({});
  const [highlightedCode, setHighlightedCode] = useState<
    Record<string, string>
  >({});
  const [editingNote, setEditingNote] = useState<{
    clipId: string;
    field: NoteField;
  } | null>(null);
  const [editingNoteValue, setEditingNoteValue] = useState("");
  const [editingClipTextId, setEditingClipTextId] = useState<string | null>(
    null,
  );
  const [editingClipTextValue, setEditingClipTextValue] = useState("");
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editingTitleValue, setEditingTitleValue] = useState("");
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const noteTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const clipTextTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(
    () => new Set(),
  );
  const [expandedCodeBlocks, setExpandedCodeBlocks] = useState<Set<string>>(
    () => new Set(),
  );
  const [expandedDetails, setExpandedDetails] = useState<Set<string>>(
    () => new Set(),
  );
  const [cardSize, setCardSize] = useState<CardSize>(readStoredCardSize);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyDeleteOpen, setHistoryDeleteOpen] = useState(false);
  const [historyDeleting, setHistoryDeleting] = useState(false);
  const [ignoredApps, setIgnoredApps] = useState<string[]>(
    readStoredIgnoredApps,
  );
  const [ignoredAppInput, setIgnoredAppInput] = useState("");
  const [clipContextMenu, setClipContextMenu] =
    useState<ClipContextMenu | null>(null);
  const [lastDeletedClip, setLastDeletedClip] = useState<Clip | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("recent");
  const [sortOpen, setSortOpen] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>(readStoredThemeMode);
  const [systemTheme, setSystemTheme] = useState<"dark" | "light">("dark");
  const [selectedVault, setSelectedVault] = useState<Vault | "All Vaults">(
    "All Vaults",
  );
  const lastSeenRef = useRef<string>("");
  const lastWrittenRef = useRef<string>("");
  const pendingRiskCopyTimeoutRef = useRef<number | null>(null);
  const captureInFlightRef = useRef(false);
  const queryRef = useRef<string>("");
  const ignoredAppsRef = useRef<string[]>(ignoredApps);
  const windowFocusedRef = useRef(false);
  const dbRef = useRef<Database | null>(null);
  const dbQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const clipsRef = useRef<Clip[]>([]);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const selectedSearchFiltersRef = useRef<HTMLDivElement | null>(null);
  const resolvedTheme = themeMode === "system" ? systemTheme : themeMode;

  function setClipOperation(clipId: string, operation: ClipOperation | null) {
    setClipOperations((current) => {
      const next = { ...current };
      if (operation) {
        next[clipId] = operation;
      } else {
        delete next[clipId];
      }
      return next;
    });
  }

  function enqueueDbOperation<T>(work: () => Promise<T>): Promise<T> {
    const next = dbQueueRef.current.then(work, work);
    dbQueueRef.current = next.catch(() => undefined);
    return next;
  }

  function reportStatus(message: string) {
    setStatus(message);
  }

  function reportError(message: string) {
    setPersistentError(message);
    setStatus(message);
  }

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  useEffect(() => {
    window.localStorage.setItem(CARD_SIZE_STORAGE_KEY, cardSize);
  }, [cardSize]);

  useEffect(() => {
    window.localStorage.setItem(
      IGNORED_APPS_STORAGE_KEY,
      JSON.stringify(ignoredApps),
    );
  }, [ignoredApps]);

  useEffect(() => {
    return () => {
      if (pendingRiskCopyTimeoutRef.current !== null) {
        window.clearTimeout(pendingRiskCopyTimeoutRef.current);
      }
    };
  }, []);

  function addIgnoredApp() {
    const bundleId = ignoredAppInput.trim().toLowerCase();
    if (!bundleId) return;
    setIgnoredApps((current) =>
      current.includes(bundleId) ? current : [...current, bundleId].sort(),
    );
    setIgnoredAppInput("");
  }

  function removeIgnoredApp(bundleId: string) {
    setIgnoredApps((current) => current.filter((item) => item !== bundleId));
  }

  useEffect(() => {
    if (!window.matchMedia) return;
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const syncSystemTheme = () => {
      setSystemTheme(media.matches ? "light" : "dark");
    };

    syncSystemTheme();
    media.addEventListener("change", syncSystemTheme);
    return () => media.removeEventListener("change", syncSystemTheme);
  }, []);

  function isSearchFilterSelected(filter: SearchFilterToken) {
    return selectedSearchFilters.some(
      (selected) => filterKey(selected) === filterKey(filter),
    );
  }

  function toggleSearchFilter(filter: SearchFilterToken) {
    setSelectedSearchFilters((current) =>
      current.some((selected) => filterKey(selected) === filterKey(filter))
        ? current.filter(
            (selected) => filterKey(selected) !== filterKey(filter),
          )
        : [...current, filter],
    );
  }

  function removeSearchFilter(filter: SearchFilterToken) {
    setSelectedSearchFilters((current) =>
      current.filter((selected) => filterKey(selected) !== filterKey(filter)),
    );
  }

  function clearSearch() {
    setQuery("");
    setSelectedSearchFilters([]);
    setFilterOpen(false);
  }

  function renderSearchFilterToken(filter: SearchFilterToken) {
    if (filter.category === "Safety") {
      const risk =
        filter.value === "safe"
          ? "safe"
          : filter.value === "review"
            ? "check"
            : "destructive";

      return (
        <span className={`searchToken riskTag riskTag-${risk}`}>
          <RiskBadgeIcon risk={risk} />
          <span className="tagLabel">{filter.label}</span>
        </span>
      );
    }

    if (filter.category === "Vault") {
      return (
        <span
          className={`searchToken vaultTag vaultTag-${filter.label.toLowerCase()}`}
        >
          <VaultBadgeIcon vault={filter.label as Vault} />
          <span className="tagLabel">{filter.label}</span>
        </span>
      );
    }

    if (filter.category === "App") {
      const sourceMap: Record<string, { label: string; className: string }> = {
        Cursor: { label: "Cu", className: "source-cursor" },
        Figma: { label: "Fg", className: "source-figma" },
        Illustrator: { label: "Ai", className: "source-ai" },
        Chrome: { label: "Ch", className: "source-chrome" },
        Finder: { label: "Fi", className: "source-finder" },
        TextEdit: { label: "Tx", className: "source-textedit" },
      };
      const source = sourceMap[filter.label] ?? {
        label: filter.label.slice(0, 2),
        className: "source-dev",
      };

      return (
        <span className="searchToken appSearchToken">
          <span className={`appIcon ${source.className}`}>{source.label}</span>
          <span className="tagLabel">{filter.label}</span>
        </span>
      );
    }

    return (
      <span className="searchToken">
        <FilterIcon type={filter.label} />
        <span className="tagLabel">{filter.label}</span>
      </span>
    );
  }

  useEffect(() => {
    clipsRef.current = clips;
  }, [clips]);

  useEffect(() => {
    queryRef.current = query;
  }, [query]);

  useEffect(() => {
    ignoredAppsRef.current = ignoredApps;
  }, [ignoredApps]);

  useEffect(() => {
    const filterRow = selectedSearchFiltersRef.current;
    if (!filterRow) return;

    filterRow.scrollLeft = filterRow.scrollWidth;
  }, [selectedSearchFilters]);

  useEffect(() => {
    let disposed = false;

    async function highlightClips() {
      const entries = await Promise.all(
        clips.map(async (clip) => {
          if (!shouldHighlightClip(clip)) return [clip.id, ""] as const;

          try {
            const html = await codeToHtmlLimited(clip.body, {
              lang: detectLanguage(clip),
              theme: SHIKI_THEME,
            });
            return [clip.id, html] as const;
          } catch {
            return [clip.id, ""] as const;
          }
        }),
      );

      if (!disposed) {
        setHighlightedCode(Object.fromEntries(entries));
      }
    }

    highlightClips();

    return () => {
      disposed = true;
    };
  }, [clips]);

  useEffect(() => {
    windowFocusedRef.current = windowFocused;
  }, [windowFocused]);

  useEffect(() => {
    if (!filterOpen) return;

    function closeFilterOnOutsideClick(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest(".search")) return;
      setFilterOpen(false);
    }

    window.addEventListener("pointerdown", closeFilterOnOutsideClick);
    return () =>
      window.removeEventListener("pointerdown", closeFilterOnOutsideClick);
  }, [filterOpen]);

  useEffect(() => {
    if (!sortOpen) return;

    function closeSortOnOutsideClick(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest(".sortControl")) return;
      setSortOpen(false);
    }

    window.addEventListener("pointerdown", closeSortOnOutsideClick);
    return () =>
      window.removeEventListener("pointerdown", closeSortOnOutsideClick);
  }, [sortOpen]);

  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        if (lastDeletedClip) {
          event.preventDefault();
          restoreDeletedClip(lastDeletedClip);
        }
        return;
      }

      if (event.key === "Escape" && historyDeleteOpen) {
        event.preventDefault();
        if (!historyDeleting) setHistoryDeleteOpen(false);
        return;
      }

      if (event.key === "Escape" && settingsOpen) {
        event.preventDefault();
        setSettingsOpen(false);
        return;
      }

      if (event.key === "Escape" && clipContextMenu) {
        event.preventDefault();
        setClipContextMenu(null);
        return;
      }

      if (event.key === "Escape" && sortOpen) {
        event.preventDefault();
        setSortOpen(false);
        return;
      }

      if (event.key === "Escape" && (searchFocused || filterOpen)) {
        event.preventDefault();
        setSearchFocused(false);
        setFilterOpen(false);
        searchInputRef.current?.blur();
      }
    }

    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, [
    clipContextMenu,
    filterOpen,
    historyDeleteOpen,
    historyDeleting,
    lastDeletedClip,
    searchFocused,
    settingsOpen,
    sortOpen,
  ]);

  useEffect(() => {
    function closeClipMenu() {
      setClipContextMenu(null);
    }

    window.addEventListener("click", closeClipMenu);
    window.addEventListener("scroll", closeClipMenu, true);
    return () => {
      window.removeEventListener("click", closeClipMenu);
      window.removeEventListener("scroll", closeClipMenu, true);
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    const appWindow = getTauriWindow();
    let unlistenFocus: (() => void) | undefined;

    async function watchFocus() {
      if (!appWindow) return;

      try {
        const focused = await appWindow.isFocused();
        if (!disposed) {
          setWindowFocused(focused);
        }

        unlistenFocus = await appWindow.onFocusChanged(({ payload }) => {
          setWindowFocused(payload);
        });
      } catch (error) {
        reportError(`Window focus watch failed: ${String(error)}`);
      }
    }

    watchFocus();

    return () => {
      disposed = true;
      unlistenFocus?.();
    };
  }, []);

  useEffect(() => {
    async function getPanelGeometry() {
      const monitor = await currentMonitor();
      if (!monitor) {
        return {
          height: 740,
          visibleX: PANEL_LEFT_MARGIN,
          visibleY: PANEL_VERTICAL_PADDING,
          hiddenX: PANEL_HIDDEN_X,
        };
      }

      const workAreaPosition = monitor.workArea.position.toLogical(
        monitor.scaleFactor,
      );
      const workAreaSize = monitor.workArea.size.toLogical(monitor.scaleFactor);
      const height = Math.max(
        520,
        workAreaSize.height - PANEL_VERTICAL_PADDING * 2,
      );

      return {
        height,
        visibleX: workAreaPosition.x + PANEL_LEFT_MARGIN,
        visibleY: workAreaPosition.y + PANEL_VERTICAL_PADDING,
        hiddenX: workAreaPosition.x - LARGE_PANEL_WIDTH - PANEL_LEFT_MARGIN,
      };
    }

    async function positionFloatingPanel() {
      try {
        const appWindow = getTauriWindow();
        if (!appWindow) return;

        const geometry = await getPanelGeometry();
        await appWindow.setAlwaysOnTop(true);
        await appWindow.setSize(
          new LogicalSize(DEFAULT_PANEL_WIDTH, geometry.height),
        );
        await appWindow.setPosition(
          new LogicalPosition(geometry.visibleX, geometry.visibleY),
        );
      } catch (error) {
        reportError(`Floating panel setup failed: ${String(error)}`);
      }
    }

    positionFloatingPanel();
  }, []);

  useEffect(() => {
    async function resizePanelForCardSize() {
      try {
        const appWindow = getTauriWindow();
        if (!appWindow) return;

        const monitor = await currentMonitor();
        const panelWidth = panelWidthForCardSize(cardSize);

        if (!monitor) {
          await appWindow.setSize(new LogicalSize(panelWidth, 740));
          await appWindow.setPosition(
            new LogicalPosition(PANEL_LEFT_MARGIN, PANEL_VERTICAL_PADDING),
          );
          return;
        }

        const workAreaPosition = monitor.workArea.position.toLogical(
          monitor.scaleFactor,
        );
        const workAreaSize = monitor.workArea.size.toLogical(
          monitor.scaleFactor,
        );
        const height = Math.max(
          520,
          workAreaSize.height - PANEL_VERTICAL_PADDING * 2,
        );

        await appWindow.setSize(new LogicalSize(panelWidth, height));
        await appWindow.setPosition(
          new LogicalPosition(
            workAreaPosition.x + PANEL_LEFT_MARGIN,
            workAreaPosition.y + PANEL_VERTICAL_PADDING,
          ),
        );
      } catch (error) {
        reportError(`Panel resize failed: ${String(error)}`);
      }
    }

    resizePanelForCardSize();
  }, [cardSize]);

  useEffect(() => {
    let disposed = false;

    async function openDatabase() {
      const maxAttempts = 5;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          const db = await Database.load(DB_PATH);
          dbRef.current = db;
          await db.execute("PRAGMA busy_timeout = 8000");
          await deleteCapturedClipboardReadErrors(db);
          const rows = await db.select<Clip[]>(
            `SELECT
              id,
              body,
              title,
              vault,
              type,
              risk,
              risk_label as riskLabel,
              description,
              when_to_use as whenToUse,
              before,
              created_at as createdAt,
              last_used_at as lastUsedAt,
              use_count as useCount,
              char_count as charCount,
              line_count as lineCount,
              token_estimate as tokenEstimate,
              is_demo as isDemo,
              source_app_name as sourceAppName,
              source_app_bundle_id as sourceAppBundleId
            FROM clips
            ORDER BY created_at DESC
            LIMIT ${CLIP_PAGE_SIZE}`,
          );

          if (!disposed) {
            const countRows = await db.select<Array<{ count: number }>>(
              "SELECT COUNT(*) as count FROM clips",
            );
            const totalCount = countRows[0]?.count ?? rows.length;

            setClips(rows);
            setResultTotal(rows.length);
            setTotalClipCount(totalCount);
            setDbReady(true);
            setStatus(`SQLite ready. Loaded ${rows.length} clips.`);
          }
          return;
        } catch (error) {
          if (
            !disposed &&
            attempt < maxAttempts &&
            isSqliteLockedError(error)
          ) {
            setStatus(`SQLite busy. Retrying open (${attempt}/${maxAttempts})`);
            await wait(350 * attempt);
            continue;
          }

          if (!disposed) {
            reportError(`SQLite open failed: ${String(error)}`);
          }
          return;
        }
      }
    }

    openDatabase();

    return () => {
      disposed = true;
      const db = dbRef.current;
      dbRef.current = null;
      db?.close().catch(() => {
        // The app is unmounting; there is no useful recovery path here.
      });
    };
  }, []);

  async function insertClip(clip: Clip) {
    const db = dbRef.current;
    if (!db) {
      throw new Error("SQLite database is not ready");
    }

    await enqueueDbOperation(async () => {
      const existingRows = await withSqliteRetry(() =>
        db.select<Array<{ count: number }>>(
          "SELECT COUNT(*) as count FROM clips WHERE body = $1",
          [clip.body],
        ),
      );
      const existingCount = existingRows[0]?.count ?? 0;
      if (existingCount > 0) {
        throw new Error("Clip body already exists in SQLite");
      }

      await runTransaction(db, async () => {
        await db.execute(
          `INSERT OR IGNORE INTO clips (
          id,
          body,
          title,
          vault,
          type,
          risk,
          risk_label,
          description,
          when_to_use,
          before,
          created_at,
          last_used_at,
          use_count,
          char_count,
          line_count,
          token_estimate,
          is_demo,
          source_app_name,
          source_app_bundle_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
          [
            clip.id,
            clip.body,
            clip.title,
            clip.vault,
            clip.type,
            clip.risk,
            clip.riskLabel,
            clip.description,
            clip.whenToUse,
            clip.before,
            clip.createdAt,
            clip.lastUsedAt ?? null,
            clip.useCount,
            clip.charCount,
            clip.lineCount,
            clip.tokenEstimate,
            clip.isDemo ? 1 : 0,
            clip.sourceAppName,
            clip.sourceAppBundleId,
          ],
        );
        await upsertSearchIndex(clip, db);
      });

      const rows = await withSqliteRetry(() =>
        db.select<Array<{ count: number }>>(
          "SELECT COUNT(*) as count FROM clips",
        ),
      );
      const count = rows[0]?.count ?? 0;
      if (count < 1) {
        throw new Error("SQLite insert did not persist a row");
      }
      setTotalClipCount(count);
    });
  }

  async function updateClipUse(clip: Clip) {
    const db = dbRef.current;
    if (!db) {
      throw new Error("SQLite database is not ready");
    }

    await enqueueDbOperation(() =>
      withSqliteRetry(() =>
        db.execute(
          `UPDATE clips
           SET last_used_at = $1, use_count = use_count + 1
           WHERE id = $2`,
          [new Date().toISOString(), clip.id],
        ),
      ),
    );
  }

  async function refreshTotalClipCount(db = dbRef.current) {
    if (!db) {
      throw new Error("SQLite database is not ready");
    }

    const rows = await enqueueDbOperation(() =>
      withSqliteRetry(() =>
        db.select<Array<{ count: number }>>(
          "SELECT COUNT(*) as count FROM clips",
        ),
      ),
    );
    const count = rows[0]?.count ?? 0;
    setTotalClipCount(count);
    return count;
  }

  async function runTransaction<T>(
    db: Database,
    work: () => Promise<T>,
  ): Promise<T> {
    const maxAttempts = 5;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await db.execute("BEGIN IMMEDIATE");
        try {
          const result = await work();
          await db.execute("COMMIT");
          return result;
        } catch (error) {
          try {
            await db.execute("ROLLBACK");
          } catch {
            // Preserve the original database error.
          }
          throw error;
        }
      } catch (error) {
        if (attempt < maxAttempts && isSqliteLockedError(error)) {
          await wait(250 * attempt);
          continue;
        }
        throw error;
      }
    }

    throw new Error("SQLite transaction retry limit reached");
  }

  async function deleteCapturedClipboardReadErrors(db = dbRef.current) {
    if (!db) {
      throw new Error("SQLite database is not ready");
    }

    const bodyPattern =
      "Clipboard read failed:%clipboard contents were not available%clipboard is empty%";

    await withSqliteRetry(() =>
      runTransaction(db, async () => {
        await db.execute(
          `DELETE FROM clip_search
           WHERE id IN (
             SELECT id FROM clips
             WHERE title LIKE 'Clipboard read failed:%'
               AND body LIKE $1
           )`,
          [bodyPattern],
        );
        await db.execute(
          `DELETE FROM clips
           WHERE title LIKE 'Clipboard read failed:%'
             AND body LIKE $1`,
          [bodyPattern],
        );
      }),
    );
  }

  async function upsertSearchIndex(clip: Clip, db = dbRef.current) {
    if (!db) {
      throw new Error("SQLite database is not ready");
    }

    await db.execute("DELETE FROM clip_search WHERE id = $1", [clip.id]);
    await db.execute(
      `INSERT INTO clip_search
        (id, body, title, vault, type, risk_label, description, when_to_use, before)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        clip.id,
        buildDevSearchText(clip),
        clip.title,
        clip.vault,
        clip.type,
        clip.riskLabel,
        clip.description,
        clip.whenToUse,
        clip.before,
      ],
    );
  }

  async function addDevelopmentDemoClips(db = dbRef.current) {
    if (!db) {
      throw new Error("SQLite database is not ready");
    }

    setStatus("Adding development demo clips...");
    await enqueueDbOperation(() =>
      runTransaction(db, async () => {
        const demoCreatedAt = new Date();

        for (const [index, demoClip] of DEMO_HEAVY_CLIPS.entries()) {
          const clip = {
            ...demoClip,
            createdAt: new Date(
              demoCreatedAt.getTime() - index * 1000,
            ).toISOString(),
          };

          await db.execute(
            `INSERT OR IGNORE INTO clips (
            id,
            body,
            title,
            vault,
            type,
            risk,
            risk_label,
            description,
            when_to_use,
            before,
            created_at,
            last_used_at,
            use_count,
            char_count,
            line_count,
            token_estimate,
            is_demo
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
            [
              clip.id,
              clip.body,
              clip.title,
              clip.vault,
              clip.type,
              clip.risk,
              clip.riskLabel,
              clip.description,
              clip.whenToUse,
              clip.before,
              clip.createdAt,
              clip.lastUsedAt ?? null,
              clip.useCount,
              clip.charCount,
              clip.lineCount,
              clip.tokenEstimate,
              1,
            ],
          );
          await db.execute(
            `UPDATE clips
         SET body = $1,
             title = $2,
             vault = $3,
             type = $4,
             risk = $5,
             risk_label = $6,
             description = $7,
             when_to_use = $8,
             before = $9,
             created_at = $10,
             char_count = $11,
             line_count = $12,
             token_estimate = $13,
             is_demo = 1
         WHERE id = $14`,
            [
              clip.body,
              clip.title,
              clip.vault,
              clip.type,
              clip.risk,
              clip.riskLabel,
              clip.description,
              clip.whenToUse,
              clip.before,
              clip.createdAt,
              clip.charCount,
              clip.lineCount,
              clip.tokenEstimate,
              clip.id,
            ],
          );
          await upsertSearchIndex(clip, db);
        }
      }),
    );

    await loadRecentClips(selectedVault, selectedSearchFilters);
    await refreshTotalClipCount(db);
    setStatus(`Added ${DEMO_HEAVY_CLIPS.length} development demo clips.`);
  }

  async function removeDevelopmentDemoClips(db = dbRef.current) {
    if (!db) {
      throw new Error("SQLite database is not ready");
    }

    setStatus("Removing development demo clips...");
    const result = await enqueueDbOperation(() =>
      runTransaction(db, async () => {
        await db.execute(
          "DELETE FROM clip_search WHERE id IN (SELECT id FROM clips WHERE is_demo = 1)",
        );
        return db.execute("DELETE FROM clips WHERE is_demo = 1");
      }),
    );
    await loadRecentClips(selectedVault, selectedSearchFilters);
    await refreshTotalClipCount(db);
    setStatus(`Removed ${result.rowsAffected} development demo clips.`);
  }

  async function updateClipNote(clip: Clip, field: NoteField, value: string) {
    const db = dbRef.current;
    if (!db) {
      throw new Error("SQLite database is not ready");
    }

    const updatedClip = {
      ...clip,
      [field]: value,
      matchField: undefined,
      matchReason: undefined,
    };
    const column = NOTE_FIELDS[field].dbColumn;

    await enqueueDbOperation(() =>
      runTransaction(db, async () => {
        await db.execute(`UPDATE clips SET ${column} = $1 WHERE id = $2`, [
          value,
          clip.id,
        ]);
        await upsertSearchIndex(updatedClip, db);
      }),
    );

    setClips((current) =>
      current.map((item) => (item.id === clip.id ? updatedClip : item)),
    );
    setStatus(`Updated ${NOTE_FIELDS[field].label}: ${clip.title}`);
  }

  async function updateClipBody(clip: Clip, value: string) {
    const db = dbRef.current;
    if (!db) {
      throw new Error("SQLite database is not ready");
    }

    const trimmed = value.trim();
    if (!trimmed) {
      throw new Error("Clip text cannot be empty");
    }
    const sensitiveMatch = detectSensitiveClip(value);
    if (sensitiveMatch) {
      throw new Error(`Sensitive content blocked: ${sensitiveMatch}`);
    }

    const vault = detectVault(value);
    const type = detectType(value, vault);
    const risk = classifyRisk(value);
    const updatedClip: Clip = {
      ...clip,
      body: value,
      title: makeTitle(value, type),
      vault,
      type,
      risk: risk.risk,
      riskLabel: risk.riskLabel,
      before: clip.before || risk.before,
      charCount: value.length,
      lineCount: countLines(value),
      tokenEstimate: estimateTokens(value),
      matchField: undefined,
      matchReason: undefined,
    };

    await enqueueDbOperation(() =>
      runTransaction(db, async () => {
        await db.execute(
          `UPDATE clips
         SET body = $1,
             title = $2,
             vault = $3,
             type = $4,
             risk = $5,
             risk_label = $6,
             before = $7,
             char_count = $8,
             line_count = $9,
             token_estimate = $10
         WHERE id = $11`,
          [
            updatedClip.body,
            updatedClip.title,
            updatedClip.vault,
            updatedClip.type,
            updatedClip.risk,
            updatedClip.riskLabel,
            updatedClip.before,
            updatedClip.charCount,
            updatedClip.lineCount,
            updatedClip.tokenEstimate,
            updatedClip.id,
          ],
        );
        await upsertSearchIndex(updatedClip, db);
      }),
    );

    setClips((current) =>
      current.map((item) => (item.id === clip.id ? updatedClip : item)),
    );
    setStatus(`Updated clip text: ${updatedClip.title}`);
  }

  async function updateClipTitle(clip: Clip, value: string) {
    const db = dbRef.current;
    if (!db) {
      throw new Error("SQLite database is not ready");
    }

    const title = value.trim();
    if (!title) {
      throw new Error("Title cannot be empty");
    }

    const updatedClip: Clip = {
      ...clip,
      title,
      matchField: undefined,
      matchReason: undefined,
    };

    await enqueueDbOperation(() =>
      runTransaction(db, async () => {
        await db.execute("UPDATE clips SET title = $1 WHERE id = $2", [
          title,
          clip.id,
        ]);
        await upsertSearchIndex(updatedClip, db);
      }),
    );

    setClips((current) =>
      current.map((item) => (item.id === clip.id ? updatedClip : item)),
    );
    setStatus(`Updated title: ${title}`);
  }

  async function loadRecentClips(
    vault: Vault | "All Vaults" = "All Vaults",
    filters: SearchFilterToken[] = [],
  ) {
    const db = dbRef.current;
    if (!db) return;

    const vaultClause = vault === "All Vaults" ? "" : "WHERE vault = $1";
    const bindValues = vault === "All Vaults" ? [] : [vault];

    const filteredRows = await enqueueDbOperation(async () => {
      const rows = await db.select<ClipRow[]>(
        `SELECT
          id,
          body,
          title,
          vault,
          type,
          risk,
          risk_label as riskLabel,
          description,
          when_to_use as whenToUse,
          before,
          created_at as createdAt,
          last_used_at as lastUsedAt,
          use_count as useCount,
          char_count as charCount,
          line_count as lineCount,
          token_estimate as tokenEstimate,
          is_demo as isDemo,
          source_app_name as sourceAppName,
          source_app_bundle_id as sourceAppBundleId
        FROM clips
        ${vaultClause}
        ORDER BY created_at DESC
        LIMIT ${CLIP_QUERY_LIMIT}`,
        bindValues,
      );

      return rows.filter((clip) => matchesSearchFilters(clip, filters));
    });

    setResultTotal(filteredRows.length);
    setClips(
      filteredRows.slice(0, visibleClipCount).map((clip) => ({
        ...clip,
        matchField: filters.length > 0 ? "Tags" : undefined,
        matchReason:
          filters.length > 0
            ? `Matched selected filters: ${formatSearchFilters(filters)}`
            : undefined,
      })),
    );
    setStatus(
      filters.length > 0
        ? `Filter search: ${filteredRows.length} result${
            filteredRows.length === 1 ? "" : "s"
          }`
        : `SQLite ready. Loaded ${filteredRows.length} clips.`,
    );
  }

  async function searchClips(
    searchQuery: string,
    vault: Vault | "All Vaults",
    filters: SearchFilterToken[],
  ) {
    const db = dbRef.current;
    if (!db) return;

    const q = searchQuery.trim();

    if (!q) {
      await loadRecentClips(vault, filters);
      return;
    }

    const safeQuery = q.replace(/"/g, '""').replace(/\*/g, "");
    const matchQuery = /\s/.test(safeQuery)
      ? `"${safeQuery}"`
      : `${safeQuery}*`;

    const vaultClause = vault === "All Vaults" ? "" : "AND clips.vault = $2";
    const bindValues =
      vault === "All Vaults" ? [matchQuery] : [matchQuery, vault];

    const filteredRows = await enqueueDbOperation(async () => {
      const rows = await db.select<ClipRow[]>(
        `SELECT
          clips.id,
          clips.body,
          clips.title,
          clips.vault,
          clips.type,
          clips.risk,
          clips.risk_label as riskLabel,
          clips.description,
          clips.when_to_use as whenToUse,
          clips.before,
          clips.created_at as createdAt,
          clips.last_used_at as lastUsedAt,
          clips.use_count as useCount,
          clips.char_count as charCount,
          clips.line_count as lineCount,
          clips.token_estimate as tokenEstimate,
          clips.is_demo as isDemo,
          clips.source_app_name as sourceAppName,
          clips.source_app_bundle_id as sourceAppBundleId
        FROM clip_search
        JOIN clips ON clips.id = clip_search.id
        WHERE clip_search MATCH $1
        ${vaultClause}
        ORDER BY rank
        LIMIT ${CLIP_QUERY_LIMIT}`,
        bindValues,
      );

      return rows.filter((clip) => matchesSearchFilters(clip, filters));
    });

    setResultTotal(filteredRows.length);
    setClips(
      filteredRows.slice(0, visibleClipCount).map((clip) => ({
        ...clip,
        matchField: detectMatchField(clip, q) ?? "Dev metadata",
        matchReason: detectMatchReason(clip, q),
      })),
    );
    setStatus(
      filters.length > 0
        ? `FTS + filters: ${filteredRows.length} result${
            filteredRows.length === 1 ? "" : "s"
          }`
        : `FTS search: ${filteredRows.length} result${
            filteredRows.length === 1 ? "" : "s"
          }`,
    );
  }

  useEffect(() => {
    if (!dbReady) return;

    let disposed = false;

    async function captureClipboard() {
      if (captureInFlightRef.current) return;
      captureInFlightRef.current = true;

      try {
        const text = await readText();
        const normalized = text.trim();

        if (!normalized || disposed) return;
        if (normalized === lastSeenRef.current) return;

        if (isCapturedClipboardReadError(normalized)) {
          lastSeenRef.current = normalized;
          setStatus("Clipboard read failure text was not saved as a clip.");
          return;
        }

        if (normalized === queryRef.current.trim()) {
          setStatus("Search text was not saved as a clip.");
          return;
        }

        if (normalized === lastWrittenRef.current) {
          setStatus("Copied from Dev Clipboard. Not saved again.");
          return;
        }

        let sourceApplication: SourceApplication | undefined;
        try {
          sourceApplication =
            (await invoke<SourceApplication | null>(
              "frontmost_application",
            )) ?? undefined;
        } catch {
          // Source attribution is useful metadata, but capture must continue
          // when it is unavailable on the current platform.
        }

        const sourceBundleId = sourceApplication?.bundleId.toLowerCase();
        const copiedFromDevClipboard = sourceBundleId === APP_BUNDLE_ID;

        if (copiedFromDevClipboard) {
          lastSeenRef.current = normalized;
          setStatus("Clipboard change inside Dev Clipboard was not saved.");
          return;
        }

        if (
          sourceBundleId &&
          ignoredAppsRef.current.includes(sourceBundleId)
        ) {
          lastSeenRef.current = normalized;
          setStatus(
            `Clipboard content from ${sourceApplication?.name ?? sourceBundleId} was ignored.`,
          );
          return;
        }

        const sensitiveMatch = detectSensitiveClip(text);
        if (sensitiveMatch) {
          const blockedClip = createBlockedSensitiveClip(
            sensitiveMatch,
            sourceApplication,
          );
          await insertClip(blockedClip);
          setResultTotal((current) => current + 1);
          setClips((current) =>
            [blockedClip, ...current].slice(0, visibleClipCount),
          );
          setStatus(
            `Sensitive clipboard body was blocked. Saved risk note: ${sensitiveMatch}.`,
          );
          lastSeenRef.current = normalized;
          return;
        }

        const alreadyExists = clipsRef.current.some(
          (clip) => clip.body.trim() === normalized,
        );

        if (alreadyExists) {
          lastSeenRef.current = normalized;
          setStatus("Clipboard text already exists");
          return;
        }

        const clipToSave = createClip(text, sourceApplication);
        await insertClip(clipToSave);
        setResultTotal((current) => current + 1);
        setClips((current) =>
          [clipToSave, ...current].slice(0, visibleClipCount),
        );
        lastSeenRef.current = normalized;
        setStatus("Captured clipboard text into SQLite");
      } catch (error) {
        if (isClipboardTextUnavailable(error)) {
          setStatus("Clipboard has no readable text.");
          return;
        }
        if (isSqliteLockedError(error)) {
          setStatus("SQLite is busy. Clipboard capture will retry.");
          return;
        }
        reportError(`Clipboard read failed: ${String(error)}`);
      } finally {
        captureInFlightRef.current = false;
      }
    }

    captureClipboard();
    const id = window.setInterval(captureClipboard, 1400);

    return () => {
      disposed = true;
      window.clearInterval(id);
    };
  }, [dbReady]);

  useEffect(() => {
    if (!dbReady) return;

    setVisibleClipCount(CLIP_PAGE_SIZE);
  }, [dbReady, query, selectedVault, selectedSearchFilters]);

  useEffect(() => {
    if (!dbReady) return;

    const id = window.setTimeout(() => {
      searchClips(query, selectedVault, selectedSearchFilters).catch(
        (error) => {
          reportError(`FTS search failed: ${String(error)}`);
        },
      );
    }, 180);

    return () => window.clearTimeout(id);
  }, [dbReady, query, selectedVault, selectedSearchFilters, visibleClipCount]);

  useEffect(() => {
    const suspendAutoHide = Boolean(
      settingsOpen ||
        historyDeleteOpen ||
        filterOpen ||
        sortOpen ||
        clipContextMenu,
    );

    invoke("set_panel_auto_hide_suspended", {
      suspended: suspendAutoHide,
    }).catch((error) => {
      reportError(`Panel auto-hide state failed: ${String(error)}`);
    });

    return () => {
      if (!suspendAutoHide) return;
      invoke("set_panel_auto_hide_suspended", { suspended: false }).catch(
        () => {
          // The app may be closing or reloading; the next launch starts unsuspended.
        },
      );
    };
  }, [
    clipContextMenu,
    filterOpen,
    historyDeleteOpen,
    settingsOpen,
    sortOpen,
  ]);

  useEffect(() => {
    if (!editingTitleId) return;
    window.requestAnimationFrame(() => {
      titleInputRef.current?.focus();
      const length = titleInputRef.current?.value.length ?? 0;
      titleInputRef.current?.setSelectionRange(length, length);
    });
  }, [editingTitleId]);

  useEffect(() => {
    if (!editingNote) return;
    window.requestAnimationFrame(() => {
      noteTextareaRef.current?.focus();
      const length = noteTextareaRef.current?.value.length ?? 0;
      noteTextareaRef.current?.setSelectionRange(length, length);
    });
  }, [editingNote]);

  useEffect(() => {
    if (!editingClipTextId) return;
    window.requestAnimationFrame(() => {
      clipTextTextareaRef.current?.focus();
      const length = clipTextTextareaRef.current?.value.length ?? 0;
      clipTextTextareaRef.current?.setSelectionRange(length, length);
    });
  }, [editingClipTextId]);

  useEffect(() => {
    if (!editingClipTextId) return;

    function handleClipTextShortcut(event: KeyboardEvent) {
      const activeClip = clipsRef.current.find(
        (clip) => clip.id === editingClipTextId,
      );
      if (!activeClip) return;

      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        saveClipTextEdit(activeClip);
      }

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        cancelClipTextEdit();
      }
    }

    document.addEventListener("keydown", handleClipTextShortcut, true);
    return () =>
      document.removeEventListener("keydown", handleClipTextShortcut, true);
  }, [editingClipTextId, editingClipTextValue]);

  function clearPendingRiskCopy() {
    if (pendingRiskCopyTimeoutRef.current !== null) {
      window.clearTimeout(pendingRiskCopyTimeoutRef.current);
      pendingRiskCopyTimeoutRef.current = null;
    }
    setPendingRiskCopyId(null);
  }

  function requestRiskCopyConfirmation(clip: Clip) {
    if (pendingRiskCopyTimeoutRef.current !== null) {
      window.clearTimeout(pendingRiskCopyTimeoutRef.current);
    }
    setPendingRiskCopyId(clip.id);
    setStatus(`Review risk before copying: ${clip.title}`);
    pendingRiskCopyTimeoutRef.current = window.setTimeout(() => {
      setPendingRiskCopyId(null);
      pendingRiskCopyTimeoutRef.current = null;
    }, 5000);
  }

  async function copyClip(clip: Clip) {
    if (clip.risk === "destructive" && pendingRiskCopyId !== clip.id) {
      requestRiskCopyConfirmation(clip);
      return false;
    }

    const colorFormat = colorFormatsByClip[clip.id] ?? "hex";
    const copyValue =
      previewType(clip) === "color"
        ? colorDisplayValue(clip, colorFormat)
        : clip.body;

    try {
      setClipOperation(clip.id, "copy");
      clearPendingRiskCopy();
      setCopiedClipId(clip.id);
      reportStatus(`Copying: ${clip.title}`);
      await writeText(copyValue);
      lastWrittenRef.current = copyValue.trim();
      lastSeenRef.current = copyValue.trim();
      reportStatus(
        previewType(clip) === "color"
          ? `Copied ${colorFormatLabel(colorFormat)}: ${copyValue}`
          : `Copied to clipboard: ${clip.title}`,
      );
      window.setTimeout(() => setCopiedClipId(null), 1600);
      setClips((current) =>
        current.map((item) =>
          item.id === clip.id
            ? {
                ...item,
                lastUsedAt: new Date().toISOString(),
                useCount: item.useCount + 1,
              }
            : item,
        ),
      );
      await updateClipUse(clip);
      return true;
    } catch (error) {
      setCopiedClipId(null);
      reportError(`Clipboard write failed: ${String(error)}`);
      return false;
    } finally {
      setClipOperation(clip.id, null);
    }
  }

  async function deleteClip(clip: Clip) {
    const db = dbRef.current;
    if (!db) {
      reportError("SQLite database is not ready.");
      return;
    }

    try {
      setClipOperation(clip.id, "delete");
      reportStatus(`Deleting: ${clip.title}`);
      await enqueueDbOperation(() =>
        runTransaction(db, async () => {
          await db.execute("DELETE FROM clip_search WHERE id = $1", [clip.id]);
          await db.execute("DELETE FROM clips WHERE id = $1", [clip.id]);
        }),
      );
      setClips((current) => current.filter((item) => item.id !== clip.id));
      setResultTotal((current) => Math.max(0, current - 1));
      setTotalClipCount((current) => Math.max(0, current - 1));
      setLastDeletedClip(clip);
      setClipContextMenu(null);
      reportStatus(`Deleted clip: ${clip.title}. Press Command+Z to undo.`);
    } catch (error) {
      reportError(`Delete failed: ${String(error)}`);
    } finally {
      setClipOperation(clip.id, null);
    }
  }

  async function restoreDeletedClip(clip: Clip) {
    try {
      setClipOperation(clip.id, "restore");
      reportStatus(`Restoring: ${clip.title}`);
      await insertClip(clip);
      setClips((current) =>
        [clip, ...current.filter((item) => item.id !== clip.id)].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
      );
      setLastDeletedClip(null);
      reportStatus(`Restored clip: ${clip.title}`);
    } catch (error) {
      reportError(`Undo failed: ${String(error)}`);
    } finally {
      setClipOperation(clip.id, null);
    }
  }

  async function deleteAllHistory() {
    const db = dbRef.current;
    if (!db || historyDeleting) return;

    setHistoryDeleting(true);
    try {
      await enqueueDbOperation(() =>
        runTransaction(db, async () => {
          await db.execute("DELETE FROM clip_search");
          await db.execute("DELETE FROM clips");
        }),
      );
      setClips([]);
      setResultTotal(0);
      setTotalClipCount(0);
      setLastDeletedClip(null);
      setQuery("");
      setSelectedSearchFilters([]);
      setHistoryDeleteOpen(false);
      setStatus("Deleted all clipboard history.");
    } catch (error) {
      reportError(`Delete history failed: ${String(error)}`);
    } finally {
      setHistoryDeleting(false);
    }
  }

  function openClipContextMenu(event: MouseEvent<HTMLElement>, clip: Clip) {
    event.preventDefault();
    const menuWidth = 250;
    const menuHeight = 300;
    setClipContextMenu({
      clipId: clip.id,
      x: Math.min(event.clientX, window.innerWidth - menuWidth - 12),
      y: Math.min(event.clientY, window.innerHeight - menuHeight - 12),
    });
  }

  function openDetailsFromMenu(clip: Clip) {
    setExpandedDetails((current) => {
      const next = new Set(current);
      next.add(clip.id);
      return next;
    });
    setClipContextMenu(null);
  }

  function sortedClips() {
    return [...clips].sort((a, b) => {
      if (sortMode === "risk") {
        return RISK_ORDER[a.risk] - RISK_ORDER[b.risk];
      }

      if (sortMode === "used") {
        return (
          b.useCount - a.useCount ||
          new Date(b.lastUsedAt ?? b.createdAt).getTime() -
            new Date(a.lastUsedAt ?? a.createdAt).getTime()
        );
      }

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  function loadMoreClips() {
    setVisibleClipCount((current) => current + CLIP_PAGE_SIZE);
  }

  function knownSourceApplications() {
    const applications = new Map<string, string>();
    for (const clip of clips) {
      if (clip.sourceAppBundleId) {
        applications.set(
          clip.sourceAppBundleId.toLowerCase(),
          clip.sourceAppName || clip.sourceAppBundleId,
        );
      }
    }
    return [...applications].sort((a, b) => a[1].localeCompare(b[1]));
  }

  function startNoteEdit(clip: Clip, field: NoteField) {
    setEditingTitleId(null);
    setEditingTitleValue("");
    setEditingClipTextId(null);
    setEditingClipTextValue("");
    setEditingNote({ clipId: clip.id, field });
    setEditingNoteValue(clip[field]);
  }

  function startClipTextEdit(clip: Clip) {
    setEditingTitleId(null);
    setEditingTitleValue("");
    setEditingNote(null);
    setEditingNoteValue("");
    setEditingClipTextId(clip.id);
    setEditingClipTextValue(clip.body);
  }

  function startTitleEdit(clip: Clip) {
    setEditingNote(null);
    setEditingNoteValue("");
    setEditingClipTextId(null);
    setEditingClipTextValue("");
    setEditingTitleId(clip.id);
    setEditingTitleValue(titleEditValue(clip, colorFormatsByClip));
  }

  function cancelNoteEdit() {
    setEditingNote(null);
    setEditingNoteValue("");
  }

  function cancelClipTextEdit() {
    setEditingClipTextId(null);
    setEditingClipTextValue("");
  }

  function cancelTitleEdit() {
    setEditingTitleId(null);
    setEditingTitleValue("");
  }

  function noteKey(clip: Clip, field: NoteField) {
    return `${clip.id}:${field}`;
  }

  function noteDisplayLimit(field: NoteField) {
    if (cardSize === "compact") return field === "before" ? 80 : 48;
    if (cardSize === "large") return Number.POSITIVE_INFINITY;
    return field === "before" ? 120 : 72;
  }

  function toggleNoteExpanded(clip: Clip, field: NoteField) {
    const key = noteKey(clip, field);

    setExpandedNotes((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function showLineCount(clip: Clip) {
    if (cardSize === "compact" && isMediaPreviewClip(clip)) return false;
    if (cardSize === "large") return true;
    return clip.lineCount > 1;
  }

  function showTokenEstimate(clip: Clip) {
    if (cardSize === "compact" && isMediaPreviewClip(clip)) return false;
    if (cardSize === "compact") return clip.tokenEstimate >= 200;
    if (cardSize === "normal") return clip.tokenEstimate >= 50;
    return true;
  }

  function truncateNote(value: string, field: NoteField, isExpanded: boolean) {
    const limit = noteDisplayLimit(field);
    if (isExpanded || value.length <= limit) return value;
    return `${value.slice(0, limit).trimEnd()}...`;
  }

  function codePreviewLineLimit() {
    if (cardSize === "compact") return 2;
    if (cardSize === "normal") return 4;
    return Infinity;
  }

  function shouldShowCodeExpand(clip: Clip) {
    if (cardSize === "large") return false;
    if (cardSize === "compact" && isMediaPreviewClip(clip)) return false;
    return clip.lineCount > codePreviewLineLimit();
  }

  function isCodeExpanded(clip: Clip) {
    return cardSize === "large" || expandedCodeBlocks.has(clip.id);
  }

  function toggleCodeExpanded(clip: Clip) {
    setExpandedCodeBlocks((current) => {
      const next = new Set(current);
      if (next.has(clip.id)) {
        next.delete(clip.id);
      } else {
        next.add(clip.id);
      }
      return next;
    });
  }

  function toggleDetails(clip: Clip) {
    setExpandedDetails((current) => {
      const next = new Set(current);
      if (next.has(clip.id)) {
        next.delete(clip.id);
      } else {
        next.add(clip.id);
      }
      return next;
    });
  }

  function detailRows(clip: Clip) {
    const rows: Array<{ label: string; value: string }> = [];

    if (clip.id === "sample-editor-empty-state-20260629") {
      rows.push(
        {
          label: "Source context",
          value: "Editor snippet for a React + TypeScript UI state component.",
        },
        {
          label: "Variables",
          value:
            "`query`, `SearchIcon`, and `.empty-state` must match the target project.",
        },
      );
    }

    if (clip.id === "sample-terminal-clean-install-20260629") {
      rows.push(
        {
          label: "Risk breakdown",
          value:
            "`rm -rf node_modules dist` recursively deletes local folders before reinstalling dependencies.",
        },
        {
          label: "Variables",
          value:
            "`node_modules` and `dist` are the delete targets. Run only from the project root.",
        },
      );
    }

    if (shouldShowMatchReason(clip) && clip.matchReason) {
      rows.push({ label: "Search reason", value: clip.matchReason });
    }

    return rows;
  }

  async function saveNoteEdit(clip: Clip) {
    if (!editingNote || editingNote.clipId !== clip.id) return;

    const nextValue = editingNoteValue.trim();
    const field = editingNote.field;
    const label = NOTE_FIELDS[field].label;

    if (field === "before" && !nextValue) {
      reportError("Before note cannot be empty.");
      return;
    }

    try {
      setClipOperation(clip.id, "save");
      reportStatus(`Saving ${label}: ${clip.title}`);
      await updateClipNote(clip, field, nextValue);
      cancelNoteEdit();
    } catch (error) {
      reportError(`${label} save failed: ${String(error)}`);
    } finally {
      setClipOperation(clip.id, null);
    }
  }

  async function saveClipTextEdit(clip: Clip) {
    if (editingClipTextId !== clip.id) return;

    try {
      setClipOperation(clip.id, "save");
      reportStatus(`Saving clip text: ${clip.title}`);
      await updateClipBody(clip, editingClipTextValue);
      cancelClipTextEdit();
    } catch (error) {
      reportError(`Clip text save failed: ${String(error)}`);
    } finally {
      setClipOperation(clip.id, null);
    }
  }

  async function saveTitleEdit(clip: Clip) {
    if (editingTitleId !== clip.id) return;

    try {
      setClipOperation(clip.id, "save");
      reportStatus(`Saving title: ${clip.title}`);
      await updateClipTitle(clip, editingTitleValue);
      cancelTitleEdit();
    } catch (error) {
      reportError(`Title save failed: ${String(error)}`);
    } finally {
      setClipOperation(clip.id, null);
    }
  }

  function renderNoteLine(
    clip: Clip,
    field: NoteField,
    options: { required?: boolean } = {},
  ) {
    const label = NOTE_FIELDS[field].label;
    const isEditing =
      editingNote?.clipId === clip.id && editingNote.field === field;
    const value = clip[field];
    const isExpanded = expandedNotes.has(noteKey(clip, field));
    const isTruncated = value.length > noteDisplayLimit(field);
    const displayValue = value
      ? truncateNote(value, field, isExpanded)
      : options.required
        ? "Add a check before pasting."
        : "Add note";

    if (isEditing) {
      return (
        <div className="noteEditor" key={field}>
          <label htmlFor={`${field}-${clip.id}`}>{label}</label>
          <textarea
            id={`${field}-${clip.id}`}
            onChange={(event) => setEditingNoteValue(event.currentTarget.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                saveNoteEdit(clip);
              }
              if (event.key === "Escape") {
                cancelNoteEdit();
              }
            }}
            placeholder={`Add ${label.toLowerCase()}...`}
            ref={noteTextareaRef}
            value={editingNoteValue}
          />
          <div className="noteActions">
            <button
              className={[
                "noteButton primary",
                clipOperations[clip.id] === "save" ? "processing" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              disabled={Boolean(clipOperations[clip.id])}
              onClick={() => saveNoteEdit(clip)}
              type="button"
            >
              <Check size={15} />
              <kbd className="keyHint">⌘ + Enter</kbd>
            </button>
            <button
              className="noteButton"
              onClick={cancelNoteEdit}
              type="button"
            >
              <X size={15} />
              <kbd className="keyHint">Esc</kbd>
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className={value ? "noteLine" : "noteLine emptyNote"} key={field}>
        <p>
          <span className="noteLabel">{label}:</span>{" "}
          <span className="noteValue">
            {value ? highlightQuery(displayValue, query) : displayValue}
            {isTruncated && (
              <button
                className="expandNoteButton"
                onClick={() => toggleNoteExpanded(clip, field)}
                type="button"
              >
                {isExpanded ? "Show less" : "Show more"}
              </button>
            )}
          </span>
          <button
            className="editNoteButton"
            onClick={() => startNoteEdit(clip, field)}
            title={`Edit ${label}`}
            type="button"
          >
            <Pencil size={14} />
          </button>
        </p>
      </div>
    );
  }

  function renderRichPreview(clip: Clip) {
    const type = previewType(clip);

    if (type === "url") {
      const domain = getDomain(clip.body);

      return (
        <div className="richPreview urlPreview">
          <div className="urlCanvas">
            <Link size={22} />
            <span>URL</span>
          </div>
          <div className="richPreviewText">
            <span className="previewTitle">Web reference</span>
            <PreviewMeta items={[domain, "URL"]} />
            <a
              className="previewDescription urlText"
              href={clip.body}
              rel="noreferrer"
              target="_blank"
            >
              {highlightQuery(clip.body, query)}
            </a>
          </div>
        </div>
      );
    }

    if (type === "color") {
      const activeFormat = colorFormatsByClip[clip.id] ?? "hex";
      const activeValue = colorDisplayValue(clip, activeFormat);

      return (
        <div className="richPreview colorPreview">
          <div
            className="colorSwatch"
            style={{ background: clip.body.trim() }}
          />
          <div className="richPreviewText colorPreviewText">
            <span className="previewTitle">{activeValue}</span>
            <PreviewMeta items={["HEX", "RGB", "HSL", "Alpha ready"]} />
            <div className="colorFormats">
              <button
                className={activeFormat === "hex" ? "activeFormat" : undefined}
                disabled={activeFormat === "hex"}
                onClick={() =>
                  setColorFormatsByClip((current) => ({
                    ...current,
                    [clip.id]: "hex",
                  }))
                }
                type="button"
              >
                {activeFormat === "hex" ? (
                  <Check size={11} />
                ) : (
                  <RefreshCw size={11} />
                )}
                HEX {colorDisplayValue(clip, "hex")}
              </button>
              <button
                className={activeFormat === "rgb" ? "activeFormat" : undefined}
                disabled={activeFormat === "rgb"}
                onClick={() =>
                  setColorFormatsByClip((current) => ({
                    ...current,
                    [clip.id]: "rgb",
                  }))
                }
                type="button"
              >
                {activeFormat === "rgb" ? (
                  <Check size={11} />
                ) : (
                  <RefreshCw size={11} />
                )}
                RGB 54, 197, 240
              </button>
              <button
                className={activeFormat === "hsl" ? "activeFormat" : undefined}
                disabled={activeFormat === "hsl"}
                onClick={() =>
                  setColorFormatsByClip((current) => ({
                    ...current,
                    [clip.id]: "hsl",
                  }))
                }
                type="button"
              >
                {activeFormat === "hsl" ? (
                  <Check size={11} />
                ) : (
                  <RefreshCw size={11} />
                )}
                HSL 194, 86%, 58%
              </button>
              <button
                className={activeFormat === "rgba" ? "activeFormat" : undefined}
                disabled={activeFormat === "rgba"}
                onClick={() =>
                  setColorFormatsByClip((current) => ({
                    ...current,
                    [clip.id]: "rgba",
                  }))
                }
                type="button"
              >
                {activeFormat === "rgba" ? (
                  <Check size={11} />
                ) : (
                  <RefreshCw size={11} />
                )}
                RGBA alpha
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (type === "file") {
      const isFigmaFile = clip.body.endsWith(".fig");

      return (
        <div className="richPreview filePreview">
          <div className="fileCanvas">
            <FolderOpen size={30} />
            <span>{isFigmaFile ? ".fig" : "FILE"}</span>
          </div>
          <div className="richPreviewText">
            <span className="previewTitle">
              {clip.body.split("/").pop() || "Local file"}
            </span>
            <PreviewMeta
              items={
                isFigmaFile
                  ? ["Figma", "File", ".fig", "Local path"]
                  : ["File", "Local path"]
              }
            />
            <p className="previewDescription">
              {highlightQuery(clip.body, query)}
            </p>
          </div>
        </div>
      );
    }

    if (type === "pdf") {
      return (
        <div className="richPreview pdfPreview">
          <div className="pdfCanvas">
            <FileText size={30} />
            <span>PDF</span>
          </div>
          <div className="richPreviewText">
            <span className="previewTitle">Dev-Clipboard-Requirements.pdf</span>
            <PreviewMeta items={["PDF", "18 pages", "3.4 MB"]} />
            <p className="previewDescription">
              Document preview. Use summary or page selection before sending to
              AI.
            </p>
          </div>
        </div>
      );
    }

    if (type === "image") {
      return (
        <div className="richPreview imagePreview">
          <div className="mockImageCanvas">
            <ImageIcon size={28} />
            <div className="cropFrame" />
            <span>PNG</span>
          </div>
          <div className="richPreviewText">
            <span className="previewTitle">Screenshot image preview</span>
            <PreviewMeta items={["PNG", "2880 x 1800", "8.6 MB"]} />
            <p className="previewDescription">
              Image preview stored as a lightweight visual reference.
            </p>
          </div>
        </div>
      );
    }

    if (type === "svg") {
      return (
        <div className="richPreview svgPreview">
          <div className="svgCanvas">
            <FileCode2 size={30} />
            <span>&lt;svg&gt;</span>
          </div>
          <div className="richPreviewText">
            <span className="previewTitle">SVG icon asset</span>
            <PreviewMeta items={["SVG", "Vector", "Editable code"]} />
            <p className="previewDescription">
              Preview the icon shape and keep the raw SVG available below.
            </p>
          </div>
        </div>
      );
    }

    if (type === "illustrator") {
      return (
        <div className="richPreview illustratorPreview">
          <div className="artboardPreview">
            <span className="appBadge">Ai</span>
            <PenTool className="artPen" size={24} />
            <div className="artShape primaryShape" />
            <div className="artShape secondaryShape" />
          </div>
          <div className="richPreviewText">
            <span className="previewTitle">
              Vector artwork + embedded preview
            </span>
            <PreviewMeta items={["Illustrator", "Rich data", "24.8 MB"]} />
            <p className="previewDescription">
              Heavy rich data. Prefer a preview or file reference for long-term
              storage.
            </p>
          </div>
        </div>
      );
    }

    if (type === "audio") {
      return (
        <div className="richPreview audioPreview">
          <div className="audioCanvas">
            <AudioLines size={30} />
            <button
              aria-label="Preview audio clip"
              className="previewPlayButton"
              type="button"
            >
              <Play size={13} fill="currentColor" />
            </button>
          </div>
          <div className="richPreviewText audioPreviewBody">
            <span className="previewTitle audioPreviewTitle">Voice memo</span>
            <PreviewMeta items={["M4A", "00:42", "2.1 MB"]} />
          </div>
        </div>
      );
    }

    if (type === "video") {
      return (
        <div className="richPreview videoPreview">
          <div className="videoThumb">
            <Video size={30} />
            <button
              aria-label="Preview video clip"
              className="previewPlayButton"
              type="button"
            >
              <Play size={13} fill="currentColor" />
            </button>
          </div>
          <div className="richPreviewText">
            <span className="previewTitle">Screen recording preview</span>
            <PreviewMeta items={["MOV", "1920 x 1080", "00:18", "42.3 MB"]} />
            <p className="previewDescription">
              Screen recording preview. Keep payload size visible before saving.
            </p>
          </div>
        </div>
      );
    }

    return null;
  }

  return (
    <main className="shell">
      <section
        className={`panel panel-${cardSize} theme-${resolvedTheme}`}
        data-theme={resolvedTheme}
      >
        <div className="statusBar" data-tauri-drag-region>
          <div className="statusPills">
            <span className="storeBadge">
              <HardDrive size={13} />
              Local only
            </span>
            <span
              className={windowFocused ? "focusBadge active" : "focusBadge"}
            >
              {windowFocused
                ? "Internal copies ignored"
                : "External copies captured"}
            </span>
            <span className="shortcutBadge">{shortcutStatus}</span>
            <span className="statusText">{status}</span>
          </div>
          <button
            className="settingsButton"
            onClick={() => setSettingsOpen(true)}
            title="Settings"
            type="button"
          >
            <Settings size={14} />
          </button>
        </div>
        {persistentError && (
          <div className="errorBanner" role="alert">
            <TriangleAlert size={15} />
            <span>{persistentError}</span>
            <button
              aria-label="Dismiss error"
              onClick={() => setPersistentError(null)}
              type="button"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <header className="topbar" data-tauri-drag-region>
          <div className="navStack">
            <nav className="vaults" aria-label="Vaults">
              {(["Chat", "Editor", "Terminal", "All Vaults"] as const).map(
                (vault) => (
                  <button
                    className={[
                      "vault",
                      `vault-${vault.toLowerCase().replace(/\s+/g, "-")}`,
                      selectedVault === vault ? "active" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    key={vault}
                    onClick={() => setSelectedVault(vault)}
                    type="button"
                  >
                    {vault === "Terminal" && (
                      <ShieldCheck className="vaultShield" size={15} />
                    )}
                    {vault}
                  </button>
                ),
              )}
            </nav>
            <div className="topbarControls">
              <div
                className="sizeToggle vaultSizeToggle"
                aria-label="Card size"
              >
                {CARD_SIZES.map((size) => (
                  <button
                    className={
                      cardSize === size.value
                        ? "sizeButton active"
                        : "sizeButton"
                    }
                    key={size.value}
                    onClick={() => setCardSize(size.value)}
                    title={`${size.label} cards`}
                    type="button"
                  >
                    <size.icon size={15} />
                    <span>{size.label}</span>
                  </button>
                ))}
              </div>
              <div className="sortControl">
                <button
                  className={sortOpen ? "sortButton active" : "sortButton"}
                  onClick={() => setSortOpen((current) => !current)}
                  title="Sort clips"
                  type="button"
                >
                  <ArrowDownUp size={15} />
                  <span>
                    {SORT_OPTIONS.find((option) => option.value === sortMode)
                      ?.label ?? "Recent"}
                  </span>
                  <ChevronDown size={13} />
                </button>
                {sortOpen && (
                  <div className="sortPopover">
                    {SORT_OPTIONS.map((option) => (
                      <button
                        className={
                          sortMode === option.value ? "selected" : undefined
                        }
                        key={option.value}
                        onClick={() => {
                          setSortMode(option.value);
                          setSortOpen(false);
                        }}
                        type="button"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="tools">
            <div className="search">
              <Search size={20} />
              {selectedSearchFilters.length > 0 && (
                <div
                  className="selectedSearchFilters"
                  ref={selectedSearchFiltersRef}
                >
                  {selectedSearchFilters.map((filter) => (
                    <button
                      key={filterKey(filter)}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => removeSearchFilter(filter)}
                      type="button"
                    >
                      {renderSearchFilterToken(filter)}
                    </button>
                  ))}
                </div>
              )}
              <input
                aria-label="Search clips"
                onChange={(event) => setQuery(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    if (filterOpen) {
                      setFilterOpen(false);
                    } else {
                      event.currentTarget.blur();
                    }
                    return;
                  }
                  if (
                    event.key === "Backspace" &&
                    !query &&
                    selectedSearchFilters.length > 0
                  ) {
                    event.preventDefault();
                    setSelectedSearchFilters((current) => current.slice(0, -1));
                  }
                }}
                onBlur={() => {
                  window.setTimeout(() => {
                    setSearchFocused(false);
                    setFilterOpen(false);
                  }, 120);
                }}
                onFocus={() => setSearchFocused(true)}
                placeholder="Search body, notes, risk..."
                ref={searchInputRef}
                style={{
                  width: query
                    ? `${Math.min(Math.max(query.length + 2, 12), 34)}ch`
                    : selectedSearchFilters.length > 0
                      ? "20ch"
                      : undefined,
                }}
                value={query}
              />
              {(query || selectedSearchFilters.length > 0) && (
                <button
                  className="clearSearchButton"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={clearSearch}
                  title="Clear search"
                  type="button"
                >
                  <X size={14} />
                </button>
              )}
              <button
                className="filterButton"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setFilterOpen((value) => !value)}
                title="Filter search"
                type="button"
              >
                <SlidersHorizontal size={16} />
              </button>
              {filterOpen && (
                <div className="filterPopover">
                  <section className="filterSection safetyFilter">
                    <h3>Safety</h3>
                    <div className="filterGrid">
                      <button
                        className={[
                          "safetyPill",
                          "safetyPill-safe",
                          isSearchFilterSelected({
                            category: "Safety",
                            label: "Safe",
                            value: "safe",
                          })
                            ? "selected"
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() =>
                          toggleSearchFilter({
                            category: "Safety",
                            label: "Safe",
                            value: "safe",
                          })
                        }
                        type="button"
                      >
                        <RiskBadgeIcon risk="safe" />
                        Safe
                      </button>
                      <button
                        className={[
                          "safetyPill",
                          "safetyPill-check",
                          isSearchFilterSelected({
                            category: "Safety",
                            label: "Review",
                            value: "review",
                          })
                            ? "selected"
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() =>
                          toggleSearchFilter({
                            category: "Safety",
                            label: "Review",
                            value: "review",
                          })
                        }
                        type="button"
                      >
                        <RiskBadgeIcon risk="check" />
                        Review
                      </button>
                      <button
                        className={[
                          "safetyPill",
                          "safetyPill-destructive",
                          isSearchFilterSelected({
                            category: "Safety",
                            label: "Risk",
                            value: "risk",
                          })
                            ? "selected"
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() =>
                          toggleSearchFilter({
                            category: "Safety",
                            label: "Risk",
                            value: "risk",
                          })
                        }
                        type="button"
                      >
                        <RiskBadgeIcon risk="destructive" />
                        Risk
                      </button>
                    </div>
                  </section>
                  <section className="filterSection vaultFilter">
                    <h3>Vault</h3>
                    <div className="filterGrid">
                      {(["Chat", "Editor", "Terminal"] as Vault[]).map(
                        (vault) => {
                          const filter = {
                            category: "Vault" as const,
                            label: vault,
                            value: vault.toLowerCase(),
                          };

                          return (
                            <button
                              className={
                                isSearchFilterSelected(filter)
                                  ? "selected"
                                  : undefined
                              }
                              key={vault}
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => toggleSearchFilter(filter)}
                              type="button"
                            >
                              <VaultBadgeIcon vault={vault} />
                              {vault}
                            </button>
                          );
                        },
                      )}
                    </div>
                  </section>
                  <section className="filterSection typeFilter">
                    <h3>Type</h3>
                    <div className="filterGrid">
                      {[
                        "Command",
                        "Code",
                        "Text",
                        "Markdown",
                        "URL",
                        "Color",
                      ].map((label) => {
                        const filter = {
                          category: "Type" as const,
                          label,
                          value: label.toLowerCase(),
                        };

                        return (
                          <FilterPill
                            key={label}
                            label={label}
                            selected={isSearchFilterSelected(filter)}
                            onToggle={() => toggleSearchFilter(filter)}
                          />
                        );
                      })}
                    </div>
                  </section>
                  <section className="filterSection mediaFilter">
                    <h3>Media</h3>
                    <div className="filterGrid mediaFilterGrid">
                      {[
                        "Image",
                        "SVG",
                        "Illustrator",
                        "PDF",
                        "File",
                        "Audio",
                        "Video",
                      ].map((label) => {
                        const filter = {
                          category: "Media" as const,
                          label,
                          value: label.toLowerCase(),
                        };

                        return (
                          <FilterPill
                            key={label}
                            label={label}
                            selected={isSearchFilterSelected(filter)}
                            onToggle={() => toggleSearchFilter(filter)}
                          />
                        );
                      })}
                    </div>
                  </section>
                  <section className="filterSection appFilter">
                    <h3>App</h3>
                    <div className="filterGrid appFilterGrid">
                      {[
                        {
                          label: "Cursor",
                          sourceLabel: "Cu",
                          sourceClass: "source-cursor",
                        },
                        {
                          label: "Figma",
                          sourceLabel: "Fg",
                          sourceClass: "source-figma",
                        },
                        {
                          label: "Illustrator",
                          sourceLabel: "Ai",
                          sourceClass: "source-ai",
                        },
                        {
                          label: "Chrome",
                          sourceLabel: "Ch",
                          sourceClass: "source-chrome",
                        },
                        {
                          label: "Finder",
                          sourceLabel: "Fi",
                          sourceClass: "source-finder",
                        },
                        {
                          label: "TextEdit",
                          sourceLabel: "Tx",
                          sourceClass: "source-textedit",
                        },
                      ].map((app) => {
                        const filter = {
                          category: "App" as const,
                          label: app.label,
                          value: app.label.toLowerCase(),
                        };

                        return (
                          <AppFilterPill
                            key={app.label}
                            label={app.label}
                            sourceClass={app.sourceClass}
                            sourceLabel={app.sourceLabel}
                            selected={isSearchFilterSelected(filter)}
                            onToggle={() => toggleSearchFilter(filter)}
                          />
                        );
                      })}
                      <button type="button">More</button>
                    </div>
                  </section>
                </div>
              )}
            </div>
          </div>
        </header>

        <section className="content">
          <div className="list">
            {clips.length === 0 ? (
              <article className="empty">
                <Terminal size={24} />
                {query.trim() || selectedSearchFilters.length > 0 ? (
                  <>
                    <h2>No matching clips</h2>
                    <p>
                      No saved clip matched this search. Try another wording or
                      remove a selected filter.
                    </p>
                  </>
                ) : (
                  <>
                    <h2>Copy text from any app</h2>
                    <p>
                      This spike watches the macOS clipboard, saves text locally
                      in SQLite, and shows command risk before copy.
                    </p>
                  </>
                )}
              </article>
            ) : (
              <>
                {sortedClips().map((clip) => (
                  <article
                    className={[
                      "clip",
                      `card-${cardSize}`,
                      `sort-${sortMode}`,
                      `risk-${clip.risk}`,
                      cardSize === "compact" && isMediaPreviewClip(clip)
                        ? "compact-media"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    key={clip.id}
                    onContextMenu={(event) => openClipContextMenu(event, clip)}
                  >
                  <div className="clipHeader">
                    <div>
                      <div className="meta">
                        <span
                          className={`sourceMetaIcon ${sourceApp(clip).className}`}
                          title={`Copied from ${sourceApp(clip).name}`}
                        >
                          <span className="appIcon">
                            {sourceApp(clip).label}
                          </span>
                        </span>
                        <span className={`riskTag riskTag-${clip.risk}`}>
                          <RiskBadgeIcon risk={clip.risk} />
                          <span className="tagLabel">
                            {riskDisplayLabel(clip.risk)}
                          </span>
                        </span>
                        <span
                          className={`vaultTag vaultTag-${clip.vault.toLowerCase()}`}
                        >
                          <VaultBadgeIcon vault={clip.vault} />
                          <span className="tagLabel">{clip.vault}</span>
                        </span>
                        <span
                          className={`typeTag typeTag-${clip.type.toLowerCase()}`}
                        >
                          <TypeBadgeIcon type={clip.type} />
                          <span className="tagLabel">{clip.type}</span>
                        </span>
                        {showLineCount(clip) && (
                          <span>
                            <span className="tagLabel">
                              {clip.lineCount} lines
                            </span>
                          </span>
                        )}
                        {showTokenEstimate(clip) && (
                          <span className={tokenTagClass(clip)}>
                            <span className="tagLabel">
                              ~{clip.tokenEstimate} tokens
                            </span>
                          </span>
                        )}
                        {extraMetaTags(clip).map((tag) => (
                          <span className={tag.className} key={tag.label}>
                            <span className="tagLabel">{tag.label}</span>
                          </span>
                        ))}
                        {clip.matchField && (
                          <span className="matchBadge">
                            <span className="tagLabel">
                              Matched in {clip.matchField}
                            </span>
                          </span>
                        )}
                      </div>
                      {editingTitleId === clip.id ? (
                        <div className="titleEditor">
                          <input
                            aria-label={`Edit title for ${clip.title}`}
                            onChange={(event) =>
                              setEditingTitleValue(event.currentTarget.value)
                            }
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                saveTitleEdit(clip);
                              }
                              if (event.key === "Escape") {
                                cancelTitleEdit();
                              }
                            }}
                            ref={titleInputRef}
                            value={editingTitleValue}
                          />
                          <div className="noteActions">
                            <button
                              className={[
                                "noteButton primary",
                                clipOperations[clip.id] === "save"
                                  ? "processing"
                                  : "",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                              disabled={Boolean(clipOperations[clip.id])}
                              onClick={() => saveTitleEdit(clip)}
                              title="Save title"
                              type="button"
                            >
                              <Check size={14} />
                              <kbd className="keyHint">Enter</kbd>
                            </button>
                            <button
                              className="noteButton"
                              onClick={cancelTitleEdit}
                              title="Cancel title edit"
                              type="button"
                            >
                              <X size={14} />
                              <kbd className="keyHint">Esc</kbd>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="titleRow">
                          <h2>
                            <span className="titleText">
                              {highlightQuery(
                                clipDisplayTitle(clip, colorFormatsByClip),
                                query,
                              )}
                            </span>
                            <button
                              className="editTitleButton"
                              onClick={() => startTitleEdit(clip)}
                              title={`Edit title: ${clipDisplayTitle(clip, colorFormatsByClip)}`}
                              type="button"
                            >
                              <Pencil size={13} />
                            </button>
                          </h2>
                        </div>
                      )}
                      <span className="useMeta titleUseMeta">
                        <span className="timeMeta savedMeta">
                          {clipSavedText(clip)}
                        </span>
                        <span className="timeMeta usedMeta">
                          {clipUsedText(clip)}
                        </span>
                      </span>
                    </div>
                    <div className="clipActions">
                      <button
                        className={[
                          "copyButton",
                          copiedClipId === clip.id ? "copied" : "",
                          clipOperations[clip.id] === "copy"
                            ? "processing"
                            : "",
                          pendingRiskCopyId === clip.id
                            ? "confirmingRiskCopy"
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onClick={() => copyClip(clip)}
                        disabled={Boolean(clipOperations[clip.id])}
                        type="button"
                      >
                        {copiedClipId === clip.id ? (
                          <Check size={16} />
                        ) : pendingRiskCopyId === clip.id ? (
                          <TriangleAlert size={16} />
                        ) : (
                          <Copy size={16} />
                        )}
                        {copiedClipId === clip.id ? (
                          <span>Copied</span>
                        ) : pendingRiskCopyId === clip.id ? (
                          <span>Confirm</span>
                        ) : clip.risk === "destructive" ? (
                          <span>Risk</span>
                        ) : clip.risk === "check" ? (
                          <span>Review</span>
                        ) : null}
                      </button>
                      {canEditClipText(clip) &&
                        !(
                          cardSize === "compact" && isMediaPreviewClip(clip)
                        ) && (
                          <button
                            className="editClipTextButton"
                            onClick={() => startClipTextEdit(clip)}
                            title={`Edit clip text: ${clip.title}`}
                            type="button"
                          >
                            <WrapText size={15} />
                          </button>
                        )}
                      {cardSize !== "compact" && (
                        <button
                          className="deleteClipButton"
                          onClick={() => deleteClip(clip)}
                          disabled={Boolean(clipOperations[clip.id])}
                          title={`Delete ${clip.title}`}
                          type="button"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="codeBlockWrap">
                    {editingClipTextId === clip.id ? (
                      <div className="clipTextEditor">
                        <textarea
                          aria-label={`Edit clip text for ${clip.title}`}
                          onChange={(event) =>
                            setEditingClipTextValue(event.currentTarget.value)
                          }
                          onKeyDown={(event) => {
                            if (
                              (event.metaKey || event.ctrlKey) &&
                              event.key === "Enter"
                            ) {
                              event.preventDefault();
                              saveClipTextEdit(clip);
                            }
                            if (event.key === "Escape") {
                              cancelClipTextEdit();
                            }
                          }}
                          ref={clipTextTextareaRef}
                          value={editingClipTextValue}
                        />
                        <div className="noteActions">
                          <button
                            className={[
                              "noteButton primary",
                              clipOperations[clip.id] === "save"
                                ? "processing"
                                : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            onClick={() => saveClipTextEdit(clip)}
                            type="button"
                          >
                            <Check size={15} />
                            <kbd className="keyHint">⌘ + Enter</kbd>
                          </button>
                          <button
                            className="noteButton"
                            onClick={cancelClipTextEdit}
                            type="button"
                          >
                            <X size={15} />
                            <kbd className="keyHint">Esc</kbd>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {shouldUseRichPreview(clip) ? (
                          renderRichPreview(clip)
                        ) : (
                          <>
                            {shouldShowCodeExpand(clip) && (
                              <button
                                className="expandCodeButton"
                                onClick={() => toggleCodeExpanded(clip)}
                                title={
                                  isCodeExpanded(clip)
                                    ? "Collapse full content"
                                    : "Expand full content"
                                }
                                type="button"
                              >
                                {isCodeExpanded(clip) ? (
                                  <ChevronUp size={15} />
                                ) : (
                                  <ChevronDown size={15} />
                                )}
                                {isCodeExpanded(clip) ? "Collapse" : "Expand"}
                              </button>
                            )}
                            {highlightedCode[clip.id] ? (
                              <div
                                className={
                                  isCodeExpanded(clip)
                                    ? "codeBlock shikiBlock expanded"
                                    : "codeBlock shikiBlock"
                                }
                                dangerouslySetInnerHTML={{
                                  __html: highlightedCode[clip.id],
                                }}
                              />
                            ) : (
                              <pre
                                className={
                                  isCodeExpanded(clip)
                                    ? "codeBlock expanded"
                                    : "codeBlock"
                                }
                              >
                                <code>{highlightQuery(clip.body, query)}</code>
                              </pre>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </div>

                  {!(cardSize === "compact" && isMediaPreviewClip(clip)) &&
                    (visibleNoteFields(clip).length > 0 ||
                      shouldShowMatchReason(clip)) && (
                      <footer className="clipFooter">
                        <div className="noteBlock">
                          {visibleNoteFields(clip).length > 0 && (
                            <div className="noteStack">
                              {visibleNoteFields(clip).map((field) =>
                                renderNoteLine(clip, field, {
                                  required: field === "before",
                                }),
                              )}
                            </div>
                          )}
                          {shouldShowMatchReason(clip) && (
                            <p className="matchReason">{clip.matchReason}</p>
                          )}
                        </div>
                      </footer>
                    )}

                  {!(cardSize === "compact" && isMediaPreviewClip(clip)) &&
                    detailRows(clip).length > 0 && (
                      <>
                        {cardSize !== "large" && (
                          <button
                            className="detailsToggle"
                            onClick={() => toggleDetails(clip)}
                            type="button"
                          >
                            {expandedDetails.has(clip.id) ? (
                              <ChevronDown size={16} />
                            ) : (
                              <ChevronRight size={16} />
                            )}
                            Details
                          </button>
                        )}

                        {(cardSize === "large" ||
                          expandedDetails.has(clip.id)) && (
                          <section className="clipDetails">
                            {detailRows(clip).map((row) => (
                              <div className="detailItem" key={row.label}>
                                <h3 className="detailLabel">{row.label}</h3>
                                <p className="detailValue">
                                  {highlightQuery(row.value, query)}
                                </p>
                              </div>
                            ))}
                          </section>
                        )}
                      </>
                    )}
                  </article>
                ))}
                {clips.length < resultTotal && (
                  <button
                    className="loadMoreButton"
                    onClick={loadMoreClips}
                    type="button"
                  >
                    Load more
                    <span>
                      Showing {clips.length} of {resultTotal}
                    </span>
                  </button>
                )}
              </>
            )}
          </div>
        </section>

        <div className="tools bottomTools">
          <div className="search">
            <Search size={20} />
            {selectedSearchFilters.length > 0 && (
              <div
                className="selectedSearchFilters"
                ref={selectedSearchFiltersRef}
              >
                {selectedSearchFilters.map((filter) => (
                  <button
                    key={filterKey(filter)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => removeSearchFilter(filter)}
                    type="button"
                  >
                    {renderSearchFilterToken(filter)}
                  </button>
                ))}
              </div>
            )}
            <input
              aria-label="Search clips"
              onChange={(event) => setQuery(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  if (filterOpen) {
                    setFilterOpen(false);
                  } else {
                    event.currentTarget.blur();
                  }
                  return;
                }
                if (
                  event.key === "Backspace" &&
                  !query &&
                  selectedSearchFilters.length > 0
                ) {
                  event.preventDefault();
                  setSelectedSearchFilters((current) => current.slice(0, -1));
                }
              }}
              onBlur={() => {
                window.setTimeout(() => {
                  setSearchFocused(false);
                  setFilterOpen(false);
                }, 120);
              }}
              onFocus={() => setSearchFocused(true)}
              placeholder="Search body, notes, risk..."
              ref={searchInputRef}
              style={{
                width: query
                  ? `${Math.min(Math.max(query.length + 2, 12), 34)}ch`
                  : selectedSearchFilters.length > 0
                    ? "20ch"
                    : undefined,
              }}
              value={query}
            />
            {(query || selectedSearchFilters.length > 0) && (
              <button
                className="clearSearchButton"
                onMouseDown={(event) => event.preventDefault()}
                onClick={clearSearch}
                title="Clear search"
                type="button"
              >
                <X size={14} />
              </button>
            )}
            <button
              className="filterButton"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setFilterOpen((value) => !value)}
              title="Filter search"
              type="button"
            >
              <SlidersHorizontal size={16} />
            </button>
            {filterOpen && (
              <div className="filterPopover">
                <section className="filterSection safetyFilter">
                  <h3>Safety</h3>
                  <div className="filterGrid">
                    <button
                      className={[
                        "safetyPill",
                        "safetyPill-safe",
                        isSearchFilterSelected({
                          category: "Safety",
                          label: "Safe",
                          value: "safe",
                        })
                          ? "selected"
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() =>
                        toggleSearchFilter({
                          category: "Safety",
                          label: "Safe",
                          value: "safe",
                        })
                      }
                      type="button"
                    >
                      <RiskBadgeIcon risk="safe" />
                      Safe
                    </button>
                    <button
                      className={[
                        "safetyPill",
                        "safetyPill-check",
                        isSearchFilterSelected({
                          category: "Safety",
                          label: "Review",
                          value: "review",
                        })
                          ? "selected"
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() =>
                        toggleSearchFilter({
                          category: "Safety",
                          label: "Review",
                          value: "review",
                        })
                      }
                      type="button"
                    >
                      <RiskBadgeIcon risk="check" />
                      Review
                    </button>
                    <button
                      className={[
                        "safetyPill",
                        "safetyPill-destructive",
                        isSearchFilterSelected({
                          category: "Safety",
                          label: "Risk",
                          value: "risk",
                        })
                          ? "selected"
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() =>
                        toggleSearchFilter({
                          category: "Safety",
                          label: "Risk",
                          value: "risk",
                        })
                      }
                      type="button"
                    >
                      <RiskBadgeIcon risk="destructive" />
                      Risk
                    </button>
                  </div>
                </section>
                <section className="filterSection vaultFilter">
                  <h3>Vault</h3>
                  <div className="filterGrid">
                    {(["Chat", "Editor", "Terminal"] as Vault[]).map(
                      (vault) => {
                        const filter = {
                          category: "Vault" as const,
                          label: vault,
                          value: vault.toLowerCase(),
                        };

                        return (
                          <button
                            className={
                              isSearchFilterSelected(filter)
                                ? "selected"
                                : undefined
                            }
                            key={vault}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => toggleSearchFilter(filter)}
                            type="button"
                          >
                            <VaultBadgeIcon vault={vault} />
                            {vault}
                          </button>
                        );
                      },
                    )}
                  </div>
                </section>
                <section className="filterSection typeFilter">
                  <h3>Type</h3>
                  <div className="filterGrid">
                    {[
                      "Command",
                      "Code",
                      "Text",
                      "Markdown",
                      "URL",
                      "Color",
                    ].map((label) => {
                      const filter = {
                        category: "Type" as const,
                        label,
                        value: label.toLowerCase(),
                      };

                      return (
                        <FilterPill
                          key={label}
                          label={label}
                          selected={isSearchFilterSelected(filter)}
                          onToggle={() => toggleSearchFilter(filter)}
                        />
                      );
                    })}
                  </div>
                </section>
                <section className="filterSection mediaFilter">
                  <h3>Media</h3>
                  <div className="filterGrid mediaFilterGrid">
                    {[
                      "Image",
                      "SVG",
                      "Illustrator",
                      "PDF",
                      "File",
                      "Audio",
                      "Video",
                    ].map((label) => {
                      const filter = {
                        category: "Media" as const,
                        label,
                        value: label.toLowerCase(),
                      };

                      return (
                        <FilterPill
                          key={label}
                          label={label}
                          selected={isSearchFilterSelected(filter)}
                          onToggle={() => toggleSearchFilter(filter)}
                        />
                      );
                    })}
                  </div>
                </section>
                <section className="filterSection appFilter">
                  <h3>App</h3>
                  <div className="filterGrid appFilterGrid">
                    {[
                      {
                        label: "Cursor",
                        sourceLabel: "Cu",
                        sourceClass: "source-cursor",
                      },
                      {
                        label: "Figma",
                        sourceLabel: "Fg",
                        sourceClass: "source-figma",
                      },
                      {
                        label: "Illustrator",
                        sourceLabel: "Ai",
                        sourceClass: "source-ai",
                      },
                      {
                        label: "Chrome",
                        sourceLabel: "Ch",
                        sourceClass: "source-chrome",
                      },
                      {
                        label: "Finder",
                        sourceLabel: "Fi",
                        sourceClass: "source-finder",
                      },
                    ].map((app) => {
                      const filter = {
                        category: "App" as const,
                        label: app.label,
                        value: app.label.toLowerCase(),
                      };

                      return (
                        <AppFilterPill
                          key={app.label}
                          label={app.label}
                          sourceClass={app.sourceClass}
                          sourceLabel={app.sourceLabel}
                          selected={isSearchFilterSelected(filter)}
                          onToggle={() => toggleSearchFilter(filter)}
                        />
                      );
                    })}
                    <button type="button">More</button>
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>

        {clipContextMenu && (
          <div
            className="clipContextMenu"
            onClick={(event) => event.stopPropagation()}
            style={{
              left: clipContextMenu.x,
              top: clipContextMenu.y,
            }}
          >
            {(() => {
              const clip = clips.find(
                (item) => item.id === clipContextMenu.clipId,
              );
              if (!clip) return null;

              return (
                <>
                  <button
                    onClick={() => {
                      copyClip(clip);
                      setClipContextMenu(null);
                    }}
                    type="button"
                  >
                    <span>Copy</span>
                    <kbd>⌘ C</kbd>
                  </button>
                  <button
                    onClick={() => {
                      startNoteEdit(clip, "description");
                      setClipContextMenu(null);
                    }}
                    type="button"
                  >
                    <span>Edit description</span>
                    <kbd>⌘ E</kbd>
                  </button>
                  <button
                    onClick={() => openDetailsFromMenu(clip)}
                    type="button"
                  >
                    <span>Preview details</span>
                    <kbd>Space</kbd>
                  </button>
                  <div className="clipContextDivider" />
                  <button className="muted" type="button">
                    <span>Pin</span>
                    <kbd>Future</kbd>
                  </button>
                  <button className="muted" type="button">
                    <span>Share</span>
                    <kbd>Future</kbd>
                  </button>
                  <div className="clipContextDivider" />
                  <button
                    className="danger"
                    onClick={() => deleteClip(clip)}
                    type="button"
                  >
                    <span>Delete</span>
                    <kbd>⌫</kbd>
                  </button>
                </>
              );
            })()}
          </div>
        )}

        {settingsOpen && (
          <div
            className="settingsOverlay"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setSettingsOpen(false);
              }
            }}
            role="presentation"
          >
            <section
              aria-label="Settings"
              className="settingsModal"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="settingsHeader">
                <div>
                  <p className="settingsEyebrow">Settings study</p>
                  <h2>Dev Clipboard settings</h2>
                </div>
                <button
                  className="settingsClose"
                  onClick={() => setSettingsOpen(false)}
                  title="Close settings"
                  type="button"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="settingsGrid">
                <section className="settingsSection">
                  <h3>General</h3>
                  <div className="settingRows">
                    <div className="settingRow">
                      <div>
                        <strong>Launch at login</strong>
                        <p>Open Dev Clipboard automatically after sign in.</p>
                      </div>
                      <span className="futurePill">Future</span>
                    </div>
                    <div className="settingRow">
                      <div>
                        <strong>Menu bar app</strong>
                        <p>
                          Keep quick access available outside the main window.
                        </p>
                      </div>
                      <span className="futurePill">Future</span>
                    </div>
                  </div>
                </section>

                <section className="settingsSection">
                  <h3>Privacy & Capture</h3>
                  <div className="settingRows">
                    <div className="settingRow">
                      <div>
                        <strong>Ignore Dev Clipboard copies</strong>
                        <p>Copies made inside this app are not saved again.</p>
                      </div>
                      <span className="mockValue">Fixed</span>
                    </div>
                    <div className="settingRow">
                      <div>
                        <strong>Automatic capture</strong>
                        <p>Save clipboard changes from other apps.</p>
                      </div>
                      <span className="mockValue">Fixed</span>
                    </div>
                    <div className="settingRow">
                      <div>
                        <strong>Secret blocking</strong>
                        <p>
                          Obvious private keys, tokens, and password assignments
                          create a risk note without saving the secret text.
                        </p>
                      </div>
                      <span className="mockValue">Fixed</span>
                    </div>
                    <div className="settingRow muted">
                      <div>
                        <strong>Manual capture</strong>
                        <p>
                          Moved out of the header. Consider as an advanced
                          action.
                        </p>
                      </div>
                      <span className="futurePill">Future</span>
                    </div>
                    <div className="ignoredAppsSetting">
                      <div>
                        <strong>Ignored apps</strong>
                        <p>
                          Bundle IDs listed here are checked before clipboard
                          content is saved.
                        </p>
                      </div>
                      <form
                        className="ignoredAppForm"
                        onSubmit={(event) => {
                          event.preventDefault();
                          addIgnoredApp();
                        }}
                      >
                        <input
                          aria-label="App bundle ID to ignore"
                          onChange={(event) =>
                            setIgnoredAppInput(event.target.value)
                          }
                          placeholder="com.example.passwordmanager"
                          spellCheck={false}
                          value={ignoredAppInput}
                        />
                        <button disabled={!ignoredAppInput.trim()} type="submit">
                          Add
                        </button>
                      </form>
                      {knownSourceApplications().some(
                        ([bundleId]) => !ignoredApps.includes(bundleId),
                      ) && (
                        <div className="knownSourceApps">
                          <span>Recently captured</span>
                          <div>
                            {knownSourceApplications()
                              .filter(
                                ([bundleId]) =>
                                  !ignoredApps.includes(bundleId),
                              )
                              .map(([bundleId, name]) => (
                                <button
                                  key={bundleId}
                                  onClick={() =>
                                    setIgnoredApps((current) =>
                                      [...current, bundleId].sort(),
                                    )
                                  }
                                  type="button"
                                >
                                  + {name}
                                </button>
                              ))}
                          </div>
                        </div>
                      )}
                      <div className="ignoredAppList">
                        {ignoredApps.length === 0 ? (
                          <span className="ignoredAppsEmpty">
                            No apps ignored
                          </span>
                        ) : (
                          ignoredApps.map((bundleId) => (
                            <span key={bundleId}>
                              {bundleId}
                              <button
                                aria-label={`Stop ignoring ${bundleId}`}
                                onClick={() => removeIgnoredApp(bundleId)}
                                type="button"
                              >
                                <X size={12} />
                              </button>
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </section>

                <section className="settingsSection">
                  <h3>Storage</h3>
                  <div className="settingRows">
                    <div className="settingRow">
                      <div>
                        <strong>Storage location</strong>
                        <p>Local SQLite database on this Mac.</p>
                      </div>
                      <span className="mockValue">Local only</span>
                    </div>
                    <div className="settingRow">
                      <div>
                        <strong>Retention</strong>
                        <p>Review clips are kept. History cleanup is manual.</p>
                      </div>
                      <span className="mockValue">Manual</span>
                    </div>
                    <div className="settingRow muted">
                      <div>
                        <strong>Large clip cleanup</strong>
                        <p>
                          Sort heavy images, files, and rich data before
                          deleting.
                        </p>
                      </div>
                      <span className="futurePill">Planned</span>
                    </div>
                    <button
                      className="settingRow danger historyDeleteTrigger"
                      onClick={() => setHistoryDeleteOpen(true)}
                      type="button"
                    >
                      <div>
                        <strong>Delete history</strong>
                        <p>Delete all saved clips after confirmation.</p>
                      </div>
                      <span className="dangerPill">Review</span>
                    </button>
                  </div>
                </section>

                <section className="settingsSection">
                  <h3>Safety Rules</h3>
                  <div className="settingRows">
                    <div className="settingRow">
                      <div>
                        <strong>Terminal review rules</strong>
                        <p>Require review for destructive commands.</p>
                      </div>
                      <span className="mockValue">Fixed</span>
                    </div>
                    <div className="ruleList">
                      <span>rm -rf</span>
                      <span>sudo</span>
                      <span>git reset --hard</span>
                      <span>docker --volumes</span>
                    </div>
                  </div>
                </section>

                <section className="settingsSection">
                  <h3>Display</h3>
                  <div className="settingRows">
                    <div className="settingRow wide">
                      <div>
                        <strong>Appearance</strong>
                        <p>Match system or force a theme.</p>
                      </div>
                      <div className="segmented">
                        {THEME_OPTIONS.map((option) => (
                          <button
                            className={
                              themeMode === option.value ? "active" : ""
                            }
                            key={option.value}
                            onClick={() => setThemeMode(option.value)}
                            type="button"
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="settingRow wide">
                      <div>
                        <strong>Default card size</strong>
                        <p>
                          Compact condenses. Large opens review information
                          without changing the core scale.
                        </p>
                      </div>
                      <div className="segmented">
                        {CARD_SIZES.map((option) => (
                          <button
                            className={
                              cardSize === option.value ? "active" : ""
                            }
                            key={option.value}
                            onClick={() => setCardSize(option.value)}
                            type="button"
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="settingRow wide">
                      <div>
                        <strong>Code block theme</strong>
                        <p>Apply a familiar editor-like syntax theme.</p>
                      </div>
                      <span className="mockValue">GitHub Dark</span>
                    </div>
                  </div>
                </section>

                <section className="settingsSection">
                  <h3>Shortcuts</h3>
                  <div className="settingRows">
                    <div className="shortcutRow">
                      <span>Show Dev Clipboard</span>
                      <kbd>{PANEL_SHORTCUT_LABEL}</kbd>
                    </div>
                    <div className="shortcutRow">
                      <span>Search clips</span>
                      <kbd>⌘ + F</kbd>
                    </div>
                    <div className="shortcutRow">
                      <span>Toggle card size</span>
                      <kbd>⌘ 1-3</kbd>
                    </div>
                  </div>
                </section>

                <section className="settingsSection">
                  <h3>Help & Onboarding</h3>
                  <div className="settingRows">
                    <div className="settingRow muted">
                      <div>
                        <strong>Help center</strong>
                        <p>Open web docs, FAQ, and practical usage guides.</p>
                      </div>
                      <span className="futurePill">Web</span>
                    </div>
                    <div className="settingRow muted">
                      <div>
                        <strong>Product tour</strong>
                        <p>
                          Show a slide or short video that explains the app
                          flow.
                        </p>
                      </div>
                      <span className="futurePill">Guide</span>
                    </div>
                  </div>
                </section>

                <section className="settingsSection spanTwo">
                  <h3>Integrations & Future</h3>
                  <div className="futureGrid">
                    <span>MCP connection</span>
                    <span>Cloud sync</span>
                    <span>AI note generation</span>
                    <span>Source app icons</span>
                    <span>Semantic search</span>
                    <span>Rich content editing</span>
                  </div>
                </section>

                {import.meta.env.DEV && (
                  <section className="settingsSection spanTwo developerTools">
                    <div className="developerToolsHeading">
                      <div>
                        <h3>Development data</h3>
                        <p>
                          Demo clips are never added automatically. Added clips
                          use a [Demo] title and an internal demo flag.
                        </p>
                      </div>
                      <span className="futurePill">Development only</span>
                    </div>
                    <div className="demoActions">
                      <button
                        onClick={() => {
                          addDevelopmentDemoClips().catch((error) =>
                            reportError(
                              `Demo insert failed: ${String(error)}`,
                            ),
                          );
                        }}
                        type="button"
                      >
                        Add demo clips
                      </button>
                      <button
                        className="danger"
                        onClick={() => {
                          removeDevelopmentDemoClips().catch((error) =>
                            reportError(
                              `Demo removal failed: ${String(error)}`,
                            ),
                          );
                        }}
                        type="button"
                      >
                        Remove demo clips only
                      </button>
                    </div>
                  </section>
                )}
              </div>
            </section>

            {historyDeleteOpen && (
              <div className="historyDeleteOverlay" role="presentation">
                <section
                  aria-labelledby="history-delete-title"
                  aria-modal="true"
                  className="historyDeleteDialog"
                  role="dialog"
                >
                  <div className="historyDeleteIcon" aria-hidden="true">
                    <Trash2 size={20} />
                  </div>
                  <div>
                    <h3 id="history-delete-title">Delete all history?</h3>
                    <p>
                      This permanently deletes {totalClipCount} saved clip
                      {totalClipCount === 1 ? "" : "s"} from this Mac. This
                      action cannot be undone.
                    </p>
                  </div>
                  <div className="historyDeleteActions">
                    <button
                      disabled={historyDeleting}
                      onClick={() => setHistoryDeleteOpen(false)}
                      type="button"
                    >
                      Cancel
                    </button>
                    <button
                      className="confirmDelete"
                      disabled={historyDeleting || totalClipCount === 0}
                      onClick={deleteAllHistory}
                      type="button"
                    >
                      {historyDeleting ? "Deleting..." : "Delete all"}
                    </button>
                  </div>
                </section>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}

export default App;
