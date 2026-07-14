# Dev Clipboard Spike

Technical spike for **Dev Clipboard** — a local-first developer clipboard that helps users understand copied commands, snippets, paths, logs, and notes before pasting them elsewhere.

This app is a spike, not the final MVP. It validates the core loop for the product direction documented in `../../handoff-jp.md` and `../../tech-plan.md`.

## Current Scope

Validated in this spike:

- Tauri 2 app shell with React + TypeScript UI.
- Single-instance app behavior: repeat launches focus the existing panel instead of opening duplicate panels.
- macOS clipboard text read/write via `@tauri-apps/plugin-clipboard-manager`.
- Global panel shortcut: `⌘ ⌥ V`.
- Local SQLite storage via `@tauri-apps/plugin-sql`.
- SQLite FTS search across clip body and Dev metadata.
- Editable clip notes:
  - `Description`
  - `When to use`
  - `Before`
- Simple Terminal command risk labeling.
- Search hit source display such as `Matched in Body`, `Matched in Before`, or `Matched in Dev metadata`.
- Copy-back flow: review a saved clip, copy it back to the system clipboard, then paste manually with `Command+V`.
- Risk copy confirmation: `Risk` clips require a second click within 5 seconds before they are written back to the system clipboard.
- Internal copy guard: clipboard changes while Dev Clipboard is focused are not saved as new clips.
- Best-effort macOS source attribution using the frontmost app name and bundle ID, without Accessibility permission.
- Bundle-ID based ignored-app settings checked before a clip is stored.
- Secret blocking: obvious private keys, tokens, API keys, and password assignments save a risk note without saving the original secret text.

Intentionally not included in this spike:

- Auto Paste / paste to front app.
- Cloud sync.
- MCP integration.
- AI-generated notes.
- Semantic/vector search.
- Rich image/data editing.
- Final production settings, onboarding, packaging, or app icon polish.

## Development Demo Clips

Demo clips are not inserted automatically. In a development build, open Settings and use `Add demo clips` when UI coverage for Safe, Review, Risk, color, URL, or heavier preview cards is needed.

Every demo row has a visible `[Demo]` title prefix and an internal SQLite `is_demo` flag. `Remove demo clips only` deletes only flagged demo rows and leaves copied user history unchanged. These controls are not rendered in production builds.

## Sensitive Clipboard Text

The MVP policy is to block obvious secrets before SQLite persistence. Private keys, GitHub tokens, AWS access keys, common API keys, and `.env`-style password/token assignments create a `Risk` card that explains what was blocked, but the original clipboard text is not saved.

This is a local heuristic, not a complete data-loss prevention system. Ambiguous text is still captured so users can keep normal development snippets.

`Review` clips are not auto-deleted. They are kept because the product goal is to let users read the explanation and learn why a snippet needs review before use. For `Risk` clips, the current safety friction is copy confirmation rather than automatic clipboard clearing.

## Stack

- Tauri 2
- React 19
- TypeScript
- Vite
- SQLite through `@tauri-apps/plugin-sql`
- `@tauri-apps/plugin-clipboard-manager`
- `@tauri-apps/plugin-global-shortcut`
- `lucide-react`
- `shiki` with a limited local language/theme bundle

## Setup

From this directory:

```sh
npm install
```

Or from the repository root:

```sh
npm --prefix apps/dev-clipboard-spike install
```

## Run

From this directory:

```sh
npm run tauri dev
```

Or from the repository root:

```sh
npm --prefix apps/dev-clipboard-spike run tauri dev
```

## Build Check

From this directory:

```sh
npm run build
```

Or from the repository root:

```sh
npm --prefix apps/dev-clipboard-spike run build
```

The frontend build currently passes. Use `npm run build:quiet` when you only need pass/fail output without the Vite asset list.

## Risk Rule Tests

```sh
npm run test:risk
```

This runs the command and sensitive-text classification tests without adding a separate test runner dependency.

## Useful Files

- `src/App.tsx` — main spike UI, clipboard polling, SQLite access, notes, search, and copy-back flow.
- `src/clipRules.ts` — risk and sensitive-text classification rules.
- `src/App.css` — spike UI styling.
- `src-tauri/src/lib.rs` — Tauri setup, global shortcut, panel behavior, and plugin registration.
- `src-tauri/capabilities/default.json` — Tauri permissions for clipboard, SQL, window controls, and global shortcut.
- `SPIKE.md` — detailed spike status and next steps.
- `MVP_CHECKLIST.md` — authoritative MVP blockers, acceptance criteria, completion gate, and out-of-scope items.
