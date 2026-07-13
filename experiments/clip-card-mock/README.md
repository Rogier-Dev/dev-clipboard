# Clip Card Mock

## Purpose

Static HTML mock for Dev Clipboard's MVP clip card UI.

This mock validates whether the following elements can coexist visually:

- Three vaults: Chat / Editor / Terminal CLI
- Clip cards with body preview + memo summary
- Risk state badges
- Token/line/data-size indicators
- Editor-style code preview
- Terminal command safety warning
- Markdown/chat card preview
- Color conversion card
- Right-side detail and memo panel
- Storage/cleanup hint
- Multi-select combined-copy bar
- Copy-first interaction model instead of Auto Paste

## Files

- `index.html`: Static UI mock.
- `mock.png`: Screenshot captured from Chrome.
- `index-compact.html`: Second compact slide-in UI mock.
- `mock-compact.png`: Screenshot of the second compact mock.
- `assets/cursor-workspace.png`: Workspace background used to validate the frontmost overlay feel.
- `index-terminal.html`: Terminal CLI vault mock focused on command risk and before-paste checks.
- `mock-terminal.png`: Screenshot of the Terminal CLI vault mock.
- `index-chat.html`: Chat vault mock focused on prompt reuse and AI context checks.
- `mock-chat.png`: Screenshot of the Chat vault mock.
- `index-search.html`: Meaning search mock that hits metadata such as Risk/Before/Description.
- `mock-search.png`: Screenshot of the meaning search mock.
- `../../tech-plan.md`: MVP implementation direction, storage/search architecture, and first technical spikes.

## Current Read

The layout supports the main concept:

> Saved clips should show meaning, risk, and cost before paste.

The token/size indicators are visually plausible as lightweight metadata. They should remain secondary unless the clip is large or high-context.

## Notes For Next Iteration

- Test Compact / Large card variants.
- Make Chat and Terminal vault screens separately, not only mixed cards inside Editor.
- Add a Markdown card with rendered/raw/code-block tabs.
- Add an image card with file size and cleanup affordance.
- Decide whether the right detail panel is always visible in fullscreen only.
- Revisit the bottom multi-select bar so it does not obscure lower cards.
- Begin the first technical spike from `tech-plan.md`: clipboard read/write, local SQLite save, and a minimal React card list.

## Icon References

- Lucide icon list: https://lucide.dev/icons
- Lucide React guide: https://lucide.dev/guide/packages/lucide-react

Use `lucide-react` for production UI icons. The current HTML mocks use temporary text glyphs such as `⌕`, `⚙`, `⏎`, `✎`, and `⋯`.

For static HTML mocks, React is not required. Use inline Lucide SVG paths directly in the HTML so the mock remains local/offline and visually close to the eventual `lucide-react` implementation.

Search mock icon direction:

- Prefer icons for repeated controls that do not need text every time.
- `Compact / Normal / Large` belongs near Settings because it changes card density, not search meaning.
- `Clips / Web / AI` can become icon-only in search mode, with tooltips for clarity.
- Keep text labels for conceptual filters such as `Meaning`, `Recent`, and `Risk` until the icon metaphor is obvious.

## Compact Mock Read

The second mock intentionally moves secondary information down one layer.

Always visible:

- Vault/type/risk badges
- Title
- Short preview
- One-line memo
- Lightweight token/size metadata
- Minimal actions

Second layer:

- Description
- When to use
- Full before-paste guidance
- Context & size detail
- Permissions
- Full content preview

Interaction model:

- Slide-in panel from the right side of the screen
- Fixed top navigation for vault access
- Space/Finder-like preview panel for selected clip details
- Card accordion as a fallback for narrower widths
- Multi-select action bar should use the lower centered floating position from the first mock. It reads more clearly as a global action for selected clips.

## Frontmost Workspace Read

The compact mock now uses an actual Cursor workspace screenshot as the background.

This validates the intended launch feeling:

- The user is still visually inside their working editor/terminal context.
- Dev Clipboard appears as a temporary foreground utility, not a full destination app.
- The right-side drawer leaves enough background visible to communicate where the paste target lives.
- The centered bottom multi-select bar reads as a global action while the drawer is active.

Design note:

The foreground panel needs strong shadow, slight transparency, and enough dimming behind it. Without those, the clip cards compete with the editor background.

## Terminal CLI Mock Read

The Terminal CLI mock focuses on the highest-risk Dev Clipboard workflow.

Default state:

- Search is closed.
- The card list and active vault own the screen.
- Search opens from the top-right icon or keyboard shortcut.
- `index-search.html` represents the expanded search mode.
- Rules are represented by a status icon beside the vault title.
- Sorting is collapsed into a dropdown (`Sort: Risk`) instead of showing all sort options.

Always visible:

- Command type and risk label
- 1-3 line command preview
- Before paste memo
- Line/token metadata
- Copy and More actions only

Normal-card density:

- Do not repeat the active vault label inside every card.
- Keep `Before` to one line.
- Move description, safer alternatives, permissions, and full context into the preview panel.
- Use more breathing room around cards to reduce fatigue for non-developer users.

Copy states:

- Safe clips can show `Copy` and then `Copied`.
- Check-level clips show `Review`.
- Destructive clips show `Review required`.
- Auto Paste remains off for MVP and should only become available later for explicitly allowed safe clips.

Space preview priority:

- Risk
- Description
- Before paste
- Context & size
- Safer alternative

Multi-select behavior:

If selected commands include destructive operations, the bottom bar should require preview before combined copy. The MVP should avoid automatic sequential paste because it can create input accidents in terminals.

## Chat Mock Read

The Chat mock focuses on AI-facing reuse.

Always visible:

- Prompt/Markdown/review type
- Estimated token count
- Code block count or large-context state
- Sensitive-information check state
- Before sending memo

Space preview priority:

- Purpose
- Before sending
- Prompt shape
- Context & size
- Reuse note

Multi-select behavior:

Selected chat clips become a prompt set. This tests whether token count and prompt composition can be visible without turning the card list into a full editor.

## Meaning Search Mock Read

The search mock tests Dev Clipboard as a growing dev knowledge base, not just clipboard history.

Search targets:

- Clip body
- Title
- User memo
- Description
- Before paste / Before sending
- Risk
- Safer alternative
- Type / Vault / Tags

Key UX rule:

When the hit is outside the copied body, show the matched field. Example: searching `再帰的に削除` can match the Risk text for `rm -rf dist`.

Search scope:

- Default to `All Vaults` so users do not have to remember where a clip was saved.
- Keep `Chat`, `Editor`, and `Terminal` as refinement tabs.
- Hide saved counts from the primary navigation; they can appear on hover or in a detail layer.
- Remove the app logo/name from the utility header in this mode so the search task owns the space.

Multiple matches:

- Show a compact result summary above the cards.
- Group matched cards first and rank them.
- Keep nearby non-matching clips below a clear divider. Do not make them too faint; low opacity makes users strain to read.
- Show match-field counts such as `Risk 1` and `Related 1`.

External bridge:

The search bar can expose subtle `Web` and `AI` actions. These should open external destinations with the search query, but should not automatically send clip contents without confirmation.

Filter / Index:

- Open from the small icon inside the right side of the search input.
- Use `Type`, `Source`, `Safety`, and `Usage` as the first categories.
- Treat it as a speech-bubble-like temporary floating panel, similar to an index/tag picker.
- It filters search results; it does not create or manage vaults.
