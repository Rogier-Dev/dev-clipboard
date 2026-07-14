# Dev Clipboard Design Notes

Dev Clipboard is a developer clipboard for understanding content before pasting. The interface should feel compact, inspectable, and calm. Safety and notes are the core hierarchy: command risk, source context, Description, When to use, and Before should remain scannable before the body preview.

## Typography

- Font family: `Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
- Mono font: `"Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`
- Fallback policy: system UI fonts are acceptable when `Inter` is unavailable. Do not mix decorative fonts into the product UI.
- Monospace usage: copied code, command previews, file paths, tokens, and technical snippets only.
- Base UI weight: `400`
- Card title: `21px`, line-height `1.2`, weight `400`
- Compact title: `18px`, line-height `1.18`
- Body and notes: `13px`
- Metadata: `11px`
- Buttons and tags: `12px` to `14px`
- Letter spacing: `0`

## Core Colors

Primary accent is a high-visibility acid yellow. Use it sparingly for copy actions, selected segmented controls, and important focus affordances outside text fields.

- Primary accent: `#efff2d`
- Accent soft: `rgba(239, 255, 45, 0.14)`
- Accent border: `rgba(239, 255, 45, 0.38)`
- Safe: `#3fffc7`
- Review/Danger: `#ff3f57`
- Vault Chat: `#9eb7ff`
- Vault Editor: `#d7a4ff`
- Vault Terminal: `#78d8ff`
- Vault All: `#c8c1ff`

## Theme Tokens

Dark mode should be quiet and code-like. Light mode should stay neutral, not cream-heavy, with black labels and gray body metadata.

### Dark

- Text primary: `#f6f2ea`
- Text secondary: `#c9c3ce`
- Text body: `#aaa5b0`
- Text muted: `#817c87`
- Text label: `#f6f2ea`
- Panel: `rgba(18, 18, 21, 0.96)`
- Card: `#202023`
- Card hover: `#252529`
- Control: `#242428`
- Editor: `#101113`
- Border subtle: `#26262a`
- Border default: `#303034`
- Border strong: `#3a3a3f`
- Field focus border: `#77737e`

### Light

- Text primary: `#000000`
- Text secondary: `#2c2b30`
- Text body: `#45414a`
- Text muted: `#4f4a55`
- Text subtle: `#5d5863`
- Text label: `#000000`
- Note body: `#5f5a66`
- Panel: `rgba(247, 248, 244, 0.96)`
- Card: `rgba(255, 255, 255, 0.82)`
- Card hover: `rgba(255, 255, 255, 0.92)`
- Control: `#f0f0f2`
- Editor: `#ffffff`
- Border subtle: `#d7d7dc`
- Border default: `#c9c9cf`
- Border strong: `#b6b6bd`
- Field focus border: `#8f929b`

## Spacing And Shape

Use an 8px-based spacing rhythm with small optical adjustments. Dense tool surfaces should favor `8px`, `10px`, `12px`, `14px`, and `16px` over large marketing-style spacing.

- Page/design guide outer padding: `42px 0 64px`
- Panel content padding: `16px 32px 92px`
- Compact content padding: `14px 16px 82px`
- Status bar padding: `10px 22px`
- Topbar padding: `18px 22px 14px`
- Card padding: `16px`
- Compact card padding: `13px`
- Card-to-card gap: `14px`
- Compact card-to-card gap: `12px`
- Card header gap: `10px`
- Tag row gap: `7px`
- Button/icon group gap: `8px`
- Note stack gap: `6px`
- Note row gap: `8px`
- Editor field gap: `8px`
- Search horizontal padding: `14px`
- Input horizontal padding: `12px`
- Code preview padding: `15px`
- Section padding in docs: `22px`
- Component sample padding in docs: `16px`
- Panel radius: `18px`
- Card radius: `14px`
- Compact card radius: `13px`
- Control radius: `10px`
- Tag radius: `999px`

### Border Radius Tokens

- `--radius-panel`: `18px` for the outer app shell.
- `--radius-card`: `14px` for normal clip cards and design-system sections.
- `--radius-card-compact`: `13px` for compact cards.
- `--radius-control`: `10px` for icon buttons, segmented controls, and input fields.
- `--radius-search`: `14px` for the bottom search field and search popover.
- `--radius-preview`: `12px` for code/media preview blocks.
- `--radius-tag`: `999px` for safety, vault, and type tags.

Do not use large decorative radius on tool surfaces. Cards should feel compact and inspectable, not soft or playful.

### Margin Rules

- Card title margin: `4px 0 0` on the title row, then metadata below.
- Metadata margin: `0 0 14px`; compact mode may reduce bottom margin to `10px`.
- Preview/code block margin: `0` internally; spacing comes from surrounding layout.
- Note footer margin-top: `13px`.
- Section margin-bottom in docs: `22px`.
- Header/masthead margin-bottom in docs: `28px`.

### Padding Rules

- Prefer padding over margins inside components.
- Cards own their internal padding; children should not compensate with large side margins.
- Buttons keep stable dimensions: icon buttons are `34px`, compact icon buttons are `32px`.
- Tags use `4px 7px` in app cards and `5px 9px` in the design guide preview.
- Text fields use `0 12px`; textareas use `10px 11px` for note editing and `15px` for code-body editing.

## Components

Buttons should use icons where possible. Copy is the primary action and uses the accent fill. Save and selected segmented controls may use accent fill. Destructive or review actions use risk colors instead.

Tags should be compact pills. Safety tags use solid state colors. Vault tags use tinted borders and dark fills. Metadata such as saved time and used count should be plain text, not tag-like.

Text fields should not use the yellow accent in light mode. Use the field focus gray token instead. This avoids visual conflict with the yellow primary action.

### Button States

Buttons use stable dimensions and should not shift layout between states.

| State | Treatment | Notes |
|---|---|---|
| Default | `--surface-control`, `--border-default`, `--text-muted` | Secondary and utility buttons. |
| Hover | Slightly stronger background and border | Use card/control hover tokens, not a new hue. |
| Focus | `2px` outline or box-shadow using `--field-focus-border` | Text fields and utility buttons use gray focus, not yellow. |
| Active | Slight inset feel or `translateY(1px)` | Press feedback should be subtle. |
| Primary Default | `#efff2d` fill, dark text | Copy and selected card-size controls only. |
| Primary Hover | Slightly darker accent border or soft accent shadow | Keep the yellow recognizable. |
| Risk Default | Review/risk color and border | Use only for commands/actions requiring caution. |

### Search And Popover

- Search is fixed at the bottom of the panel.
- Search field radius: `14px`; height: `44px`; padding: `0 14px`.
- Search field focus may keep the yellow border because search is a global command surface, unlike editable note/title fields.
- Popover appears above the search field and shares `--radius-search`.
- Popover background uses an opaque surface in light mode. Avoid translucent white over code/cards because text can disappear.
- Light popover surface: `#ffffff`; border: `#b8bac2`; shadow may use alpha.
- Light selected popover item: background `#f1f5c2`, text `#505700`, border `#c7d000`.
- Dark popover background uses `--surface-card` or `--surface-popover`; border uses `--border-default`.
- Popover item height: `34px` to `38px`.
- Popover item hover uses `--surface-control-hover`.
- Selected filter tags inside the search field use compact pills and must not increase search height unexpectedly.

### Text Links

Text links are quiet. The app is not link-heavy, so links should be clear without competing with Copy or Review.

| State | Light | Dark | Treatment |
|---|---|---|---|
| Default | `#4f46e5` or vault-specific accent | `#c8c1ff` | No underline by default in dense UI. |
| Hover | Same color, underline visible | Same color, underline visible | Use underline rather than a color jump. |
| Focus | Gray focus outline or underline plus outline | Gray focus outline or underline plus outline | Must be keyboard visible. |
| Active | Slightly darker color | Slightly brighter color | Avoid layout movement. |

Use text links for secondary destinations such as preview URLs, Help, FAQ, Privacy, and docs. Do not use links for primary clipboard actions.

## Layout Rules

- The panel never scrolls horizontally.
- `.content` scrolls vertically only.
- Long titles and copied tokens must wrap with `overflow-wrap: anywhere`.
- The tag row may scroll horizontally within the card, but scroll chaining should not move the whole panel.
- The search box is fixed at the bottom and should stay within the panel width.

## Mode Guidance

Light and dark modes should share the same semantic token names. Avoid one-off `.theme-light .component` overrides unless the component is genuinely theme-specific. Component styles should read meaning tokens such as `--text-primary`, `--text-muted`, `--surface-card`, and `--field-focus-border`.

Temporary MVP exception: popovers, status pills, and overlay controls may use light-specific contrast overrides when alpha surfaces or accent text reduce readability during QA. Treat these as accessibility fixes, not final color polish.
