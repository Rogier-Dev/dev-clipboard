# Dev Clipboard Spike

This is the first technical spike for Dev Clipboard.

## Goal

Validate the smallest useful app loop:

1. Read text from the macOS clipboard.
2. Save recent copied text locally.
3. Classify likely Terminal commands.
4. Show a risk label and `Before` note.
5. Copy a selected clip back to the system clipboard.

This spike intentionally does not use Auto Paste. The user still pastes manually with Command+V.

## Current Implementation

- Tauri 2
- React + TypeScript
- `@tauri-apps/plugin-clipboard-manager`
- `lucide-react`
- `localStorage` for temporary spike history

## How To Run

```sh
cd apps/dev-clipboard-spike
npm install
npm run tauri dev
```

## Verification Status

Completed:

- Frontend TypeScript/Vite build passes with `npm run build`.
- Full Tauri/Rust dev build passes with `npx tauri dev --config '{"build":{"beforeDevCommand":""}}' --no-dev-server-wait` while Vite is already running.
- Clipboard plugin is registered in Tauri.
- Read/write permissions are added to the default capability.
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

Pending:

- Search architecture should keep a common UI while allowing mode-specific engines:
  Dev mode uses SQLite FTS + metadata; future Plain mode can use N-gram or a Japanese tokenizer.

## Next Spike Step

After Tauri build succeeds, replace `localStorage` with SQLite:

1. Add `@tauri-apps/plugin-sql`.
2. Create `clips` and `clip_notes` tables.
3. Add an FTS table for body + metadata search.
4. Keep the same React UI and swap the storage layer.
