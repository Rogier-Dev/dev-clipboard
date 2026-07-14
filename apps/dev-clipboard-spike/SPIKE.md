# Dev Clipboard Spike

This is the first technical spike for Dev Clipboard.

## Goal

Validate the smallest useful app loop:

1. Read text from the macOS clipboard.
2. Save recent copied text locally.
3. Classify likely Terminal commands.
4. Show a risk label and `Before` note.
5. Let the user edit `Description`, `When to use`, and `Before`.
6. Search clip body and Dev metadata.
7. Copy a selected clip back to the system clipboard.

This spike intentionally does not use Auto Paste. The user still pastes manually with Command+V.

## Current Implementation

- Tauri 2
- React + TypeScript
- Vite
- `@tauri-apps/plugin-clipboard-manager`
- `@tauri-apps/plugin-global-shortcut`
- `@tauri-apps/plugin-sql` with SQLite
- `lucide-react`
- `shiki` with a limited local language/theme bundle
- `localStorage` only for lightweight UI preferences such as theme mode

## How To Run

From this directory:

```sh
npm install
npm run tauri dev
```

From the repository root:

```sh
npm --prefix apps/dev-clipboard-spike install
npm --prefix apps/dev-clipboard-spike run tauri dev
```

## Build Check

From this directory:

```sh
npm run build
```

From the repository root:

```sh
npm --prefix apps/dev-clipboard-spike run build
```

## Verification Status

Completed:

- Frontend TypeScript/Vite build passes with `npm run build`.
- Full Tauri/Rust dev build has previously passed with `npx tauri dev --config '{"build":{"beforeDevCommand":""}}' --no-dev-server-wait` while Vite was already running.
- Clipboard plugin is registered in Tauri.
- Global shortcut plugin is registered in Tauri.
- Panel shortcut is `⌘ ⌥ V` on macOS.
- Read/write clipboard permissions are added to the default capability.
- SQLite permissions are added to the default capability.
- React UI includes monitoring, manual read, local history, command risk labels, and copy-back.
- Real clipboard monitoring was confirmed with `rm -rf dist`.
- The copied command appeared in the app history.
- Copy-back from the app was confirmed by pressing `Review` and pasting `rm -rf dist` into another app with Command+V.
- SQLite storage is wired into the running spike.
- New copied text is captured into SQLite and appears as cards.
- A persistent `Store: SQLite` badge was added because the initial `SQLite ready...` status is quickly replaced by later capture status.
- SQLite write permission required `sql:allow-execute`; `sql:default` only allowed load/select.
- Restart persistence was confirmed: saved cards are restored after closing and reopening the spike.
- SQLite FTS search is wired across body and Dev metadata.
- `rm -rf dist` can be found with Japanese metadata such as `再帰的に削除`, `再起的に削除`, `再帰削除`, `再起削除`, and `dist削除`.
- Search result cards show `Matched in Body` or `Matched in Dev metadata` plus a short match reason.
- Search text matching the current search query is not saved as a clip, preventing search-test pollution.
- Empty search results now show `No matching clips` instead of the normal empty capture state.
- Inline `Before` note editing works.
- Edited `Before` notes are saved to SQLite.
- Edited `Before` notes are re-indexed into FTS; searching `ls dist` can find `rm -rf dist` via `Matched in Before`.
- Internal copy guard works.
- Clipboard changes while Dev Clipboard is focused are not saved as clips.
- Focus state badges work: `Internal copy guard on` and `External capture on`.
- Editable note fields now include `Description`, `When to use`, and `Before`.
- `Description` and `When to use` use the same inline edit/save/cancel pattern as `Before`.
- SQLite stores `description` and `when_to_use` directly on each clip for the spike.
- FTS search indexes body, title, risk, `Description`, `When to use`, `Before`, and Dev metadata.
- Development demo clips are no longer inserted at startup.
- Development builds expose explicit `Add demo clips` and `Remove demo clips only` actions in Settings.
- Demo rows use both a visible `[Demo]` title prefix and an SQLite `is_demo` flag. Existing fixed `demo-` IDs are migrated without changing real clipboard history rows.
- Obvious secrets are blocked before SQLite persistence. Current rules cover private keys, GitHub tokens, AWS access keys, common API keys, and password/token assignments.

## Known Gaps / Pending Decisions

- Search architecture should keep a common UI while allowing mode-specific engines:
  - Dev mode: SQLite FTS + metadata.
  - Future Plain mode: likely N-gram search or a Japanese tokenizer.
- Shiki now uses a limited local language/theme bundle, and `build:quiet` is available for compact validation output. Future syntax packs can extend this without returning to the full Shiki bundle.
- Settings UI is still partly placeholder-level and needs to be separated into real MVP settings versus future/planned items.
- History deletion and ignored app settings still need product-quality implementation.
- Clipboard capture is currently text-first. Rich data, images, and advanced file handling are outside this spike.
- Internal copy guard intentionally ignores clipboard changes while Dev Clipboard is focused; this avoids history pollution but can miss some edge cases.
- Secret blocking is intentionally heuristic. Ambiguous text still needs user judgment.

## MVP Checklist

See `MVP_CHECKLIST.md` for the current MVP scope mapped to implemented, partial, missing, and out-of-scope items.

## Next Spike Steps

The detailed order and completion criteria now live in `MVP_CHECKLIST.md`. The next implementation slice is:

1. Implement confirmed bulk history deletion and keep SQLite/FTS changes consistent.
2. Decide whether real source-app detection and ignored apps are MVP requirements.
3. Replace remaining placeholder settings with working controls or explicit `Future` states.
4. Extract classification, sensitive-content, and risk rules into testable modules and add regression tests.
