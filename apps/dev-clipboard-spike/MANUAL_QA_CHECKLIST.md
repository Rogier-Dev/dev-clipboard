# Dev Clipboard Manual QA Checklist

Last updated: 2026-07-15

このチェックリストは、MVP候補を実機で確認するための記録表。自動テストでは拾いにくいmacOS連携、視覚崩れ、操作感、永続化、失敗表示を対象にする。

Status:

- `[x]` Pass
- `[~]` Issueあり。内容をNotesに残す
- `[ ]` 未実施
- `[-]` 今回対象外

## Test Matrix

全画面確認は、最低限この組み合わせで実施する。

| Status | Theme | Card size | Width | Notes |
| --- | --- | --- | --- | --- |
| [ ] | Light | Compact | 380px | メディア一覧性、タグ1行、検索窓、横overflow |
| [ ] | Light | Normal | 600px | MVP標準表示、編集欄、検索Popover |
| [ ] | Light | Large | 600px | 長文本文、メモ、プレビュー |
| [ ] | Dark | Compact | 380px | タグ、ボタン、検索窓、コントラスト |
| [ ] | Dark | Normal | 600px | MVP標準表示、編集欄、検索Popover |
| [ ] | Dark | Large | 600px | 長文本文、メモ、プレビュー |

## Preflight

| Status | Area | Scenario | Expected | Notes |
| --- | --- | --- | --- | --- |
| [ ] | Build | `npm run build:quiet` | TypeScriptとVite buildが成功する | |
| [ ] | Tests | `npm run test:core` | Risk、分類、タイトル、検索メタ情報テストが成功する | |
| [ ] | Launch | `npm run tauri dev` | Dev Clipboardが1つだけ起動する | |
| [ ] | Shortcut | `Command+Option+V` | パネルが表示/退避する | |
| [ ] | Single instance | 起動中に再度起動する | 既存パネルが前面に出て、2個目のウィンドウを作らない | |

## Core Clipboard Flow

| Status | Area | Scenario | Expected | Notes |
| --- | --- | --- | --- | --- |
| [ ] | Capture | 外部アプリで `hello dev clipboard` をコピー | 1.4秒程度で新規カードが追加される | |
| [ ] | Source app | Finderでファイルパスをコピー | Source appがFinder系として保存される | |
| [ ] | Internal copy guard | Dev Clipboard内のCopyボタンを押す | コピー先として使われるが、新規カードは増えない | |
| [ ] | Duplicate | 同じ本文を連続コピー | 重複保存方針どおりに扱われ、UIが破綻しない | |
| [ ] | Long text | 1000文字以上の本文をコピー | カードが表示され、縦スクロールできる | |
| [ ] | Japanese | 日本語文をコピー | 文字化けせず、検索できる | |
| [ ] | URL | `https://example.com/docs` をコピー | TypeがURLになり、表示がはみ出さない | |
| [ ] | Color | `#36C5F0` をコピー | TypeがColorになり、色プレビューが表示される | |
| [ ] | Color | `rgb(100, 100, 100)` をコピー | TypeがColorになり、原文を保持する | |
| [ ] | Command | `npm run build` をコピー | Terminal / Command / Safeとして扱われる | |

## Risk And Sensitive Data

| Status | Area | Scenario | Expected | Notes |
| --- | --- | --- | --- | --- |
| [ ] | Risk | `rm -rf dist` をコピー | Riskカードになる | |
| [ ] | Risk copy | RiskカードのCopyを1回押す | まだクリップボードへ戻らず、確認状態になる | |
| [ ] | Risk copy | 5秒以内にもう一度Copyを押す | クリップボードへ戻り、use countが増える | |
| [ ] | Risk timeout | RiskカードのCopyを1回押して5秒待つ | 確認状態が解除される | |
| [ ] | Review | `sudo npm install -g example-cli` をコピー | Reviewカードになり、自動削除されない | |
| [ ] | Secret block | 秘密鍵っぽい文字列をコピー | 原文を保存せず、Risk説明カードだけ残る | 実キーは使わない |
| [ ] | Secret search | Secret block後に原文の一部で検索 | 原文が検索に残っていない | 実キーは使わない |

## Notes And Editing

| Status | Area | Scenario | Expected | Notes |
| --- | --- | --- | --- | --- |
| [ ] | Description | Descriptionを編集して保存 | 即時反映され、再起動後も残る | |
| [ ] | When to use | When to useを日本語で編集 | 検索対象になり、表示崩れしない | |
| [ ] | Before | Beforeを複数行で編集 | 保存でき、カード内で読める | |
| [ ] | Title | タイトルを長い英数字に編集 | カード幅からはみ出さない | |
| [ ] | Body | 本文を編集 | FTS検索の対象が更新される | |
| [ ] | Cancel | 編集中にEscまたはCancel | 未保存変更が反映されない | |
| [ ] | Focus | 編集中にパネル外へフォーカス | 復帰時に編集中の状態が破綻しない | |

## Search, Filters, And Sort

| Status | Area | Scenario | Expected | Notes |
| --- | --- | --- | --- | --- |
| [ ] | Body search | 本文の一部で検索 | 対象カードだけ表示される | |
| [ ] | Note search | Description / When to use / Beforeの語句で検索 | 対象カードが表示され、ヒット元が分かる | |
| [ ] | Dev metadata | `再帰的に削除` で検索 | `rm -rf` 系カードがDev metadataとしてヒットする | |
| [ ] | No result | 存在しない文字列で検索 | 0件状態が分かりやすい | |
| [ ] | Filter popover | 検索窓のフィルターアイコンを押す | Popoverが検索窓の上に出る | |
| [ ] | Filter token | タグを選択する | 検索窓内にタグが入り、結果が絞られる | |
| [ ] | Filter backspace | 入力が空の状態でBackspace | 最後のタグが削除される | |
| [ ] | Filter clear | 一括削除X | すべてのタグが消える | |
| [ ] | Sort recent | Recentを選択 | 新しい順になる | |
| [ ] | Sort risk | Riskを選択 | Risk / Review / Safeの優先順になる | |
| [ ] | Sort used | Usedを選択 | 利用回数/最終利用時刻の順序が自然 | |

## Delete, Undo, And History

| Status | Area | Scenario | Expected | Notes |
| --- | --- | --- | --- | --- |
| [ ] | Delete | 個別ゴミ箱で削除 | カードが消え、Undo可能になる | |
| [ ] | Undo | 削除直後にCommand+Z | 直近1件が復元される | |
| [ ] | Edit undo | テキスト編集中にCommand+Z | 通常のテキストUndoと削除Undoが競合しない | |
| [ ] | Compact delete | Compactカードで削除導線を使う | 意図した導線から削除できる | |
| [ ] | Clear history | 履歴全削除を実行 | 件数・Undo不可の確認後、SQLite/FTSから消える | 実履歴で実施注意 |
| [ ] | Clear restart | 全削除後に再起動 | 削除済みカードが戻らない | |
| [ ] | Load more | 50件超の履歴で末尾へ移動 | Load moreで古い履歴を追加表示できる | |

## Settings And Persistence

| Status | Area | Scenario | Expected | Notes |
| --- | --- | --- | --- | --- |
| [ ] | Theme | Light / Dark / Systemを切り替える | パネル全体の色が破綻しない | |
| [ ] | Theme restart | Theme変更後に再起動 | 選択が復元される | |
| [ ] | Card size | Compact / Normal / Largeを切り替える | 幅、カード、検索窓が崩れない | |
| [ ] | Card restart | Card size変更後に再起動 | 選択が復元される | |
| [ ] | Ignored apps | 現在アプリをIgnored appsへ追加 | そのBundle IDからのコピーが保存されない | |
| [ ] | Ignored remove | Ignored appsから削除 | 再び保存される | |
| [ ] | Future controls | 未実装設定を見る | 通常操作できるUIに見えず、Future扱いが分かる | |
| [ ] | Demo clips | Add demo clips | Demoだけが追加され、`[Demo]`表示になる | dev build |
| [ ] | Remove demo | Remove demo clips only | Demoだけ消え、実履歴は残る | dev build |

## Visual And Overflow

| Status | Area | Scenario | Expected | Notes |
| --- | --- | --- | --- | --- |
| [ ] | Light labels | LightでDescription / When to use / Before | ラベルだけ黒、本文はグレー | |
| [ ] | Active edit | 編集フィールドをアクティブにする | 背景に溶け込まず、黄色の強調が残っていない | |
| [ ] | Title width | タイトル編集欄を表示 | カード幅いっぱいに自然に広がる | |
| [ ] | Metadata line | Saved / Used表示 | 囲みなし、カンマ区切り、小さめフォント | |
| [ ] | Horizontal swipe | カード上で横スワイプ | パネル全体が横にずれない | |
| [ ] | Long token | 長いSSH公開鍵風文字列を表示 | 横にはみ出さず、読める範囲で折り返す | 実キーは使わない |
| [ ] | Japanese wrap | 長い日本語タイトル | カード内で自然に折り返す | |
| [ ] | Buttons | Default / hover / focus / active | クリック可能性が分かり、遅延感が目立たない | |
| [ ] | Popover | 検索PopoverとSort Popover | 位置、影、罫線、背景がテーマに合う | |
| [ ] | Contrast | Dark / Lightの主要テキスト | 低コントラストで読めない箇所がない | |

## Error And Recovery

| Status | Area | Scenario | Expected | Notes |
| --- | --- | --- | --- | --- |
| [ ] | Clipboard read failure | クリップボード読取失敗を発生させる | dismiss可能なエラーとして見える | 注入方法要検討 |
| [ ] | Copy failure | Copy back失敗を発生させる | UIだけuse countが増えない | 注入方法要検討 |
| [ ] | Search failure | DB/検索失敗を発生させる | エラーバナーで分かる | 注入方法要検討 |
| [ ] | Sleep resume | スリープ復帰後にコピー | 監視が復帰する | |
| [ ] | Rapid copy | 連続で複数コピー | 最新履歴が欠落しにくく、UIが固まらない | |

## Release Smoke Test

| Status | Area | Scenario | Expected | Notes |
| --- | --- | --- | --- | --- |
| [ ] | Tauri build | 配布用ビルドを作成 | 成功する | |
| [ ] | App identity | アプリ名、identifier、version | MVP用の値になっている | |
| [ ] | Icon | Dock / Cmd+Tab / Finder | Dev Clipboardとして視認できる | |
| [ ] | Fresh install | 新規DBで起動 | 初回状態が破綻しない | |
| [ ] | Existing DB | 既存DBで起動 | 履歴・設定が読める | |
| [ ] | Permissions | macOS権限・警告 | ユーザーに説明可能な状態 | |

## Current Known Gaps

- UIクリック後の反応がワンテンポ遅く感じる箇所がある。操作感調整は別タスクで継続。
- エラー系QAは、意図的な失敗注入方法をまだ用意していない。
- 配布用ビルド、署名、Notarization方針は未確定。
- 実アプリアイコン取得はMVP後補。
