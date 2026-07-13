# Dev Clipboard Handoff

## Current Decision

Product name:

**Dev Clipboard**

Japanese tagline:

**“貼る前に理解する” 開発用クリップボード**

English tagline:

**Understand before you paste.**

## Background

The product idea started from a practical need during AI-assisted development.

The target user is someone who builds with AI and code editors, but does not always feel fully confident with terminal commands, backend operations, file paths, package managers, slash commands, or destructive shell operations. This includes front-end developers, designers who code, art directors, product builders, and other semi-technical users who frequently copy commands from documentation, AI chats, GitHub issues, README files, and terminal output.

Generic clipboard managers like Paste, Maccy, PastePal, Alfred, and Raycast are useful for storing and retrieving copied content. However, they are mostly general-purpose. The opportunity for Dev Clipboard is to focus specifically on development workflows, especially the moment before pasting into a terminal, editor, AI chat, or command palette.

## Core Problem

AI-assisted development increases the amount of copied commands, snippets, errors, file paths, and configuration values. Users often paste content they only partially understand.

Examples:

- Shell commands copied from documentation or AI responses.
- Potentially destructive commands such as `rm`, `mv`, `chmod`, `sudo`, `git reset`, or `docker system prune`.
- File paths that depend on the current project or working directory.
- Slash commands for AI tools, editors, or CLIs.
- Environment variables, JSON, Markdown, SQL, package manager commands, and config snippets.
- Error logs copied from terminals or browsers.

The key pain is not only remembering copied content. The deeper pain is knowing what the copied content means, whether it is safe, and how to use it correctly before pasting.

## Product Concept

Dev Clipboard is a development-focused clipboard manager that helps users understand copied content before pasting it.

It should behave like a practical working memory for AI-assisted development:

- Store copied commands, snippets, paths, prompts, errors, and documentation fragments.
- Classify content by type.
- Explain what a command or snippet is likely to do.
- Show whether content is rich text, plain text, Markdown, code, URL, shell command, JSON, SQL, env data, or slash command.
- Add short human-written notes to saved clips.
- Support reusable snippets with descriptions and placeholders.
- Assist input just before paste, similar to a tooltip or small form.
- Reduce accidental or unsafe pasting into terminals and editors.

The product should not try to beat Paste as a general clipboard app. It should win by being more useful in the specific workflow of AI-powered software development.

## Positioning

Dev Clipboard sits between:

- Clipboard history apps.
- Snippet managers.
- AI coding tools.
- Terminal safety tools.
- Developer documentation workflows.

Possible positioning statement:

**A developer clipboard that adds context, explanation, and safety checks before you paste.**

## Initial Audience

Primary audience:

- Front-end developers who use AI tools.
- Designers and art directors who code.
- Product builders and indie developers.
- Non-backend-heavy developers who often copy commands from documentation.
- Users of Cursor, Codex, Claude, ChatGPT, VS Code, iTerm, Terminal, Warp, Raycast, and similar tools.

Secondary audience:

- Experienced developers who want structured command snippets.
- Teams that want safer shared commands and onboarding snippets.
- People who frequently switch between docs, AI chats, terminal, and editor.

## Initial Feature Ideas

### 1. Development-Aware Clipboard History

Save and display clipboard history with development-specific metadata.

Possible detected types:

- Plain text
- Rich text
- Markdown
- Shell command
- Git command
- Package manager command
- URL
- File path
- JSON
- SQL
- Environment variable
- Error log
- Code snippet
- Slash command
- AI prompt

### 2. Command Understanding

When a copied item looks like a command, Dev Clipboard should show a short explanation.

Example:

`rm -rf dist`

Possible explanation:

Removes the `dist` directory recursively and forcefully. This is destructive and depends on the current working directory.

Useful metadata:

- Command name
- Arguments
- Flags
- Target paths
- Current risk level
- Suggested checks before running

### 3. Risk Detection

Flag commands that deserve attention before paste.

Potential risk categories:

- Safe
- Caution
- Destructive
- Requires confirmation
- Unknown or suspicious

Examples of commands to flag:

- `rm`, especially `rm -rf`
- `mv` when overwriting or moving large paths
- `chmod`, `chown`
- `sudo`
- `curl | sh`
- `git reset --hard`
- `git clean`
- `docker system prune`
- `npm publish`
- Commands containing credentials, tokens, or secrets

### 4. Paste Preview

Before pasting, show a compact preview with:

- Content type
- Formatting state
- Short explanation
- Risk level
- Destination-aware options

Possible paste modes:

- Paste as-is
- Paste as plain text
- Paste as Markdown code block
- Copy only, do not auto-paste
- Fill placeholders before paste

### 5. Rich Text vs Plain Text Visibility

Make formatting obvious at a glance.

Each clipboard item should show whether it is:

- Plain text
- Rich text
- Markdown
- Code
- URL
- Image
- File

This matters because users often paste content into editors, issue trackers, AI chats, and terminals where formatting can create unwanted behavior.

### 6. Notes and Descriptions

Allow users to save clips with short explanations.

Examples:

- What this command does.
- When to use it.
- What project it belongs to.
- What to check before running.
- Which AI/tool/doc produced it.

This is especially useful for snippets and commands that are remembered vaguely but not confidently.

### 7. Placeholder Snippets

Support reusable snippets with variables.

Examples:

```sh
cd {{project_path}}
git checkout -b {{branch_name}}
pnpm add {{package_name}}
scp {{local_file}} {{server}}:{{remote_path}}
```

When selected, Dev Clipboard can show a small input form before paste.

### 8. AI and MCP Integration

Paste already supports MCP integration, but Dev Clipboard can specialize the idea for development context.

Potential MCP use cases:

- Let an AI assistant inspect approved recent clips.
- Let AI explain a selected command.
- Let AI rewrite a dangerous command into a safer version.
- Let AI generate a reusable snippet from a copied command.
- Let AI summarize copied error logs.
- Let AI search saved snippets by intent.

Important principle:

AI access should be explicit and scoped. The app should avoid exposing the entire clipboard history by default.

### 9. Destination-Aware Behavior

Behavior can change depending on where the user is pasting.

Examples:

- Terminal: prioritize command explanation, risk, and plain-text paste.
- VS Code/Cursor: prioritize code snippets, file paths, prompts, and slash commands.
- Browser/AI chat: prioritize Markdown formatting, code fences, and prompt snippets.
- GitHub/Linear/Notion: prioritize issue-ready formatting.

## MVP Scope

A practical first version could include:

1. Clipboard history for text-based content.
2. Automatic classification for shell commands, URLs, file paths, Markdown, code, JSON, and plain text.
3. Visual badges for content type and formatting.
4. Basic command risk detection.
5. Saved snippets with descriptions.
6. Placeholder snippets with fill-before-paste UI.
7. Paste preview with plain-text and as-is options.
8. Local-first storage.
9. Initial MCP endpoint for approved saved snippets and recent development clips.

## Differentiation From Existing Apps

Paste:

- Strong general clipboard history, visual organization, iCloud sync, pinboards, and MCP support.
- Dev Clipboard should differentiate by adding development-specific classification, command explanation, risk detection, and snippet semantics.

Maccy:

- Fast, lightweight, open-source clipboard history.
- Dev Clipboard should be more structured and context-aware, even if not as minimal.

Raycast and Alfred:

- Strong launcher ecosystems with clipboard history.
- Dev Clipboard should focus deeper on safe paste, command understanding, and AI development context.

PastePal and PasteNow:

- Strong cross-device clipboard managers.
- Dev Clipboard should avoid becoming only another general-purpose clipboard manager.

## Product Name Candidates

1. Dev Clipboard
2. DevPaste
3. SafeDev Clipboard
4. SafePaste Dev
5. CommandPaste
6. Prompt Clipboard
7. Context Clipboard
8. Command Keeper
9. Paste Guard
10. DevClip
11. ClipSafe
12. AI Coding Clipboard

Current temporary choice:

**Dev Clipboard**

## Tagline Candidates

### Japanese

1. “貼る前に理解する” 開発用クリップボード
2. AI時代の、コマンドに強いクリップボード
3. 開発のための、安全なペースト記憶
4. コマンドを理解してから貼る
5. AI開発のためのスマートクリップボード

Current temporary Japanese tagline:

**“貼る前に理解する” 開発用クリップボード**

### English

1. Understand before you paste.
2. Paste with context. Run with confidence.
3. Know what you paste before you run it.
4. Understand commands before they hit your terminal.
5. A developer clipboard that explains before it pastes.
6. A smarter clipboard for safer development.
7. Your clipboard, with context before action.
8. Review. Understand. Paste.
9. A clipboard built for AI-assisted development.
10. Know before you paste.

Current temporary English tagline:

**Understand before you paste.**

## Design Direction

The interface should feel practical, precise, and calm. Since the product is for real development workflows, it should avoid a generic SaaS landing-page feel and instead emphasize clarity, speed, and trust.

Useful UI ideas:

- Compact command cards with syntax highlighting.
- Clear labels for content type.
- Risk level shown with both color and text.
- Path, flag, URL, and variable highlighting.
- One-line descriptions on saved snippets.
- Tooltip-like explanations.
- Fill-in fields for placeholder snippets.
- Quick paste modes available from keyboard.
- Visual distinction between copied history and intentionally saved snippets.

The design opportunity is to make technical content feel less intimidating without hiding the details.

## Open Questions

1. Should the first version be Mac-only?
2. Should it be a menu bar app, floating overlay, Raycast-style launcher, or editor extension?
3. Should paste interception happen globally, or should the app mainly copy prepared content back to the clipboard?
4. How much explanation should be local and rule-based versus AI-generated?
5. How should sensitive data detection work?
6. How much clipboard history should be stored by default?
7. What should be the first integration target: Terminal, VS Code/Cursor, Codex, Claude, or Raycast?
8. Should MCP be available in v1 or added after the core clipboard/snippet flow works?

## Near-Term Next Steps

1. Stabilize SQLite FTS search.
2. Show `Matched in Risk`, `Matched in Before`, and `Matched in Body` clearly in result cards.
3. Refine Dev mode metadata search.
4. Define the future Japanese search strategy for Plain mode.
5. Move the HTML mock card UI into the Tauri/React spike gradually.
6. Add Shiki code/command preview to the spike.
7. Add the first note editing and Before editing UI.
8. Test global shortcut and slide-in overlay behavior.
9. Continue testing with real commands copied from docs and AI chats.

## 2026-06-28 Technical Spike Result

Created `apps/dev-clipboard-spike` with Tauri 2 + React + TypeScript.

Confirmed:

- The app can monitor the real macOS clipboard.
- Copied text appears as clip cards.
- Terminal-like commands such as `rm -rf dist` can show simple risk metadata.
- `Copy` / `Review` can write a saved clip back to the system clipboard.
- The user can paste manually into another app with Command+V.
- The MVP loop works without Auto Paste or Accessibility permission.
- SQLite storage works.
- Saved cards restore after closing and reopening the spike.
- SQLite FTS search works.
- `rm -rf dist` can be found via Japanese metadata such as `再帰的に削除`, `再起的に削除`, `再帰削除`, `再起削除`, and `dist削除`.
- Result cards can show `Matched in Body` / `Matched in Dev metadata` and a short match reason.
- Search text matching the current search query is not saved as a clip.
- Empty search results now show a search-empty state.
- Inline `Before` note editing works.
- Edited `Before` notes are saved to SQLite and re-indexed into FTS.
- Searching `ls dist` can find `rm -rf dist` via `Matched in Before`.
- Internal copy guard works.
- Clipboard changes while Dev Clipboard is focused are not saved as clips.
- Focus state badges work: `Internal copy guard on` and `External capture on`.

Technical notes:

- `@tauri-apps/plugin-clipboard-manager` works for text read/write.
- `@tauri-apps/plugin-sql` works for SQLite storage.
- `sql:default` only covers load/select; INSERT/UPDATE/DELETE requires `sql:allow-execute`.
- The test DB is stored at `~/Library/Application Support/com.department.devclipboard/dev-clipboard-spike.db`.
- SQLite FTS is wired in, but Japanese tokenization is weak with the default tokenizer.
- Dev mode metadata can absorb Japanese wording variants. Example: `再帰的に削除` / `再起的に削除`.
- The app now avoids saving text copied from inside Dev Clipboard itself while editing notes or search fields.

Search direction:

- Keep Search UI shared.
- Swap the underlying search engine by mode.
- Dev mode should use SQLite FTS + metadata such as Risk, Before, Description, and Tags.
- Plain mode can later use N-gram indexing or a Japanese tokenizer.
- Avoid adding a heavy Japanese search engine to the MVP, but keep the architecture open.
