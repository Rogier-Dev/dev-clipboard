# Code Theme Preview Experiment

## Purpose

Validate whether Dev Clipboard can render saved code clips with a Cursor/VS Code-like syntax theme inside a clipboard card.

## Result

Technically feasible.

This experiment uses Shiki with a custom VS Code-compatible theme object to render an HTML clip with:

- Dark editor-like background
- Cyan HTML tags
- Yellow attribute names
- Pink strings
- Clipboard-card chrome
- Side metadata/notes panel

## Files

- `render-preview.mjs`: Generates `preview.html` using Shiki.
- `preview.html`: Static preview of the code clip card.
- `preview.png`: Screenshot captured from the generated HTML.

## Implementation Notes

The practical implementation path is:

1. Detect code clips.
2. Infer language.
3. Render with Shiki using a default dark theme.
4. Allow theme selection.
5. Allow VS Code/Cursor theme JSON import.
6. Later, detect the user's active editor theme automatically where possible.

The goal should not be perfect Cursor rendering parity. Cursor/VS Code visuals also depend on semantic highlighting, font, ligatures, editor decorations, bracket coloring, and extensions.

For MVP, target a familiar "Cursor-like code card" that makes code structure easy to scan before paste.

