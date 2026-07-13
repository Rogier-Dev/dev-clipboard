# Dev Clipboard Clip Card Spec

Last updated: 2026-07-03

## Purpose

Dev Clipboardのカードは、単なるコピー履歴の見た目ではなく、**貼る前に理解して安全に再利用するための判断面**として設計する。

カードで達成したいこと:

- 何をコピーしたものかすぐ分かる。
- どの保管庫の文脈か分かる。
- 貼ってよいものか、注意が必要か分かる。
- メモによって「何に使うか」「何を確認すべきか」が分かる。
- コード/コマンド/Markdown/カラー/画像など、内容の種類ごとに読みやすく見える。
- クリックやドラッグの前に、ユーザーが自分で判断できる。

## Core Principle

**本文だけでなく、意味を一緒に表示する。**

Pasteのカードは「見つけやすい」ことが強い。Dev Clipboardのカードはそれに加えて「理解して使える」ことを主役にする。

## MVP Scope

MVPでカードに必要なもの:

1. 保管庫表示: Chat / Editor / Terminal CLI
2. コンテンツ種別: Command / Code / Markdown / URL / Color / Image / Plain Text
3. 本文プレビュー
4. メモ要約
5. 危険度または注意状態
6. 最終使用日またはコピー日時
7. Context/size表示: 推定トークン数、文字数、行数、データサイズ
8. 固定/保存状態
9. コピー/貼り付け前アクション
10. 詳細ビューへの導線

注意:

Context/size表示は、MVPではUI要素として入れる。初期段階では正確な計算や削除機能まで実装しなくてもよい。まず見た目として成立するか、ユーザーに刺さるかをHTMLモックで検証する。

MVPで後回しにするもの:

- AIによる自動説明生成
- MCP連携
- クラウド同期
- 高度な画像クロップ
- 完全なCursor/VS Codeテーマ再現
- 自動順次ペースト
- アプリごとの自動貼り先制御

## Card Anatomy

## Content Type Display Rules

本文の表示は、テキスト前提のコードブロックだけに寄せない。コピー内容の種類ごとに「何を見れば判断できるか」を変える。

MVPの基本方針:

- まずは本文領域を `content preview` として抽象化する。
- テキスト/コード/コマンドはShiki付きコードブロックで表示する。
- 非テキストデータは、無理に本文を展開せず、プレビュー、メタ情報、開く/保存/削除判断を優先する。
- 大きいデータは `data size` タグを強めに出す。
- AIに渡す可能性が高いものは `token estimate` を出す。
- 実ファイルやリッチデータは、MVPでは本文の完全保持よりも「何をコピーしたか分かる」ことを優先する。

| Type | First layer | Preview | Tags | Primary action |
| --- | --- | --- | --- | --- |
| Command | コマンド本文 | Shiki bash | Risk / lines / tokens | Copy / Review |
| Code | コード本文 | Shiki tsx/html/css/jsonなど | Language / lines / tokens | Copy / Edit |
| Markdown | Raw本文またはRendered要約 | Shiki markdown、将来Rendered切替 | Markdown / tokens | Copy / Preview |
| URL | URL + ページタイトル候補 | ドメイン、favicon、OGPが取れればサムネイル | Link / domain / source app | Copy / Open from preview |
| Color | カラーコード | 色スウォッチ、HEX/RGB/HSL/RGBA切替 | Color / HEX/RGB/HSL/RGBA / source app | Copy current format |
| Image | サムネイル | 画像プレビュー、サイズ、解像度 | PNG/JPEG / MB / dimensions | Copy / Crop later |
| SVG | SVGサムネイル + raw切替 | Rendered SVG、Raw code | SVG / vector / dimensions | Copy as SVG / Copy code |
| Vector/Rich design data | アプリアイコン + リッチデータ要約 | 低解像度プレビューが取れれば表示 | Vector / MB / source app | Copy / Keep / Delete |
| File | ファイル名/パス | ファイルアイコン、種類、サイズ | File / extension / MB | Reveal / Copy path |
| Audio | ファイル名または音声データ要約 | 波形は将来、MVPはアイコン + duration | Audio / duration / MB | Copy / Reveal |
| Video | サムネイルまたはファイル情報 | poster frameは将来、MVPはアイコン + duration | Video / duration / MB | Copy / Reveal |
| Plain Text | テキスト本文 | 1-数行プレビュー | Text / chars / tokens | Copy |

非テキストのMVP割り切り:

- 画像、Illustrator、音声、動画は、まず検証用カードで表示ルールを確認する。
- 実データの完全保存、サムネイル生成、クロップ、波形生成、動画サムネイル生成は後続フェーズに回す。
- ただしUIには `data size`、`source app`、`type` を出し、重いものを見つけて削除できる方向性はMVPから見せる。
- `Illustrator`, `Figma`, `After Effects`, `TextEdit`, `Cursor`, `Chrome` などはコンテンツ種別ではなく `source app` として扱う。MVPでは「コピー時点の前面アプリ」を記録する前提でよい。
- カード上では `source app` をアプリアイコン風の小タグとして出し、`Code`, `Markdown`, `Image`, `Video`, `Color` などの `type` タグにもアイコンを付ける。視覚的に「どこから来た何か」を一目で判別できることを優先する。
- source appが増えた場合、Filter/IndexではPaste同様に主要アプリだけを先に出し、残りは `More` から開く。

### 2026-07-02 Content Type Update

リッチプレビューは、すべて同じ黒い本文ブロックに押し込まず、種類ごとに判断材料を変える。

URL:

- URL本文はリンクとして扱い、ホバー時に下線を出す。
- 主ボタンに `Open` は混ぜない。開く導線はプレビュー内リンク、または将来のコンテキストメニューに置く。
- タイトルはページタイトル候補やユーザー編集タイトルとして扱う。実ページタイトルの自動取得は後続。

Color:

- Colorは `#hex` だけでなく、`rgb(100,100,100)`, `rgb(100, 100, 100)`, 前後スペース、RGBA、8桁HEX、HSL/HSLAを扱える設計にする。
- 検出/正規化はtrim後の値で行うが、元のコピー本文は保持する。
- 変換ボタンは即コピーではなく、表示形式の切り替えにする。
- 右上の `Copy` は、現在表示中の形式をコピーする。
- 自動タイトルが元本文と同じ場合は、表示形式に合わせてタイトルも変えてよい。
- ユーザーが独自タイトルを付けた場合は、タイトルは固定し、表示値だけを切り替える。
- Colorの検証用コピー色は、Primaryカラーと混ざらない値を使う。Primary黄色そのものをサンプル色にすると、UIボタンとの判別が難しくなる。

Image / SVG / Illustrator / Figma / File:

- 左側に共通サイズのプレビュー枠を置く。
- SVGは黄色背景を敷かず、他のメディアと同じトーンでアイコン/プレビューを見せる。
- Illustrator/Figmaなどのデザイン系データは、`source app`, `file type`, `local path`, `size` を判断材料として出す。
- `Illustrator` や `Figma` はTypeではなくsource app。Typeは `Image`, `SVG`, `File`, `Rich data` などで扱う。

Development file classification:

- `python.py`, `javascript.js`, `App.tsx`, `style.css` などは、コピーされたものが「中身」か「ファイル実体/パス」かで扱いを分ける。
- エディタ上でファイル内容やコード断片をコピーした場合は `Editor / Code` として扱う。Shiki対象の言語、行数、トークン数を判断材料にする。
- Finder、ファイルピッカー、ドラッグ元などからファイル実体やパスをコピーした場合は `Media / File` として扱う。拡張子、ファイル名、ローカルパス、サイズをメタデータに保持する。
- 拡張子は検索対象メタデータに入れる。例: `py`, `js`, `tsx`, `css`, `json`, `md`。
- `File` と判定された開発ファイルでも、プレビュー可能なテキストファイルなら将来的に中身の軽量プレビューを出してよい。ただしMVPでは「ファイルとしてコピーされた」事実を優先する。

Audio / Video:

- Audioは `AudioLines` 系のアイコンを使い、Video/Image/SVG/Fileと同じ視覚重量に合わせる。
- Videoは中心にVideoアイコン、右下に小さい再生アイコンを置く。
- Audioも再生可能に見せる場合は、右下に小さい再生アイコンを置く。
- durationはVideo/Audio共通のメタチップとして扱う。

## Tag Hierarchy

カード上のタグは、順番そのものが理解に影響するため、以下を基本順にする。

```text
Safety -> Vault -> Type / Media -> Source/detail -> lines/tokens/size
```

方針:

- Safetyは最優先。`Safe`, `Review`, `Risk` はカードの判断に直結する。
- Safetyタグは塗りのピルにして、他のアウトラインタグより強く見せる。
- `Review` や `Risk` の理由文言はタグ名に混ぜない。理由はDetails、Risk breakdown、検索理由へ下げる。
- Vaultは `Chat`, `Editor`, `Terminal`。ユーザーが保管庫文脈をすぐ理解できるようSafetyの次に置く。
- Type/Mediaは `Command`, `Code`, `Markdown`, `URL`, `Color`, `Image`, `Audio`, `Video`, `File` など。
- source appはタグ列ではなく、タイトル左のアプリアイコンとして表示する。アプリ名は基本表示しない。
- lines/tokens/sizeは補助情報。大きい値だけ色を付けて注意を促す。

Safety:

- `Safe`: 問題なくコピーできる候補。緑系。ただし黄緑に寄せすぎず、少し青みを持たせる。
- `Review`: 内容確認を推奨する候補。オレンジ系。大きいトークン、長文、文脈依存、AIコスト高など。
- `Risk`: 危険操作や破壊的操作の可能性がある候補。赤系。Terminalコマンドや削除操作など。

右上主ボタン:

- `Safe` は `Copy`。
- `Review` は `Review`。
- `Risk` は `Risk`。
- コピー後は、緑系背景 + チェックアイコン + `Copied` に変化させる。
- `Review` / `Risk` ボタンからコピーした場合も、成功状態は同じ `Copied` へ寄せる。

## Information Hierarchy

カードは情報を一度にすべて見せない。

### First Layer: Always Visible

ユーザーが一覧で判断するための最小情報。

- Type
- Risk
- Title
- 1-3行の本文プレビュー
- 1行のメモ要約
- 軽いContext/size情報
- Copy/Moreの最小アクション

通常状態の方針:

- 現在の保管庫はヘッダーで分かるため、カード内のVaultバッジは省略してよい。
- `Type`, `Risk`, `Lines/Size` だけを小さく出す。
- `Before` は1行だけ常時表示する。
- `Description` と `When to use` は空欄時は控えめな追加導線にし、入力済みなら短い1行メモとして表示してよい。
- `Safer alternative`, `Context詳細`, `Permission` は右プレビューへ下げる。
- `Edit note` は通常カードの常時アクションから外し、詳細/Moreへ入れる。
- 情報量を減らす代わりに、カード内外の余白をやや広めに取る。

2026-06-29のスパイクでは、カード上に `Description`, `When to use`, `Before` の3つを同じインライン編集UIで扱う形を検証した。MVPでは全てを大きく見せるのではなく、`Before` を安全確認として優先し、`Description` と `When to use` は短く、または第2階層へ逃がす方向がよい。

### Second Layer: On Demand

カード一覧では隠してよい情報。

表示方法候補:

- Card accordion
- Hover tooltip
- Space preview
- Detail view

第2階層に下げる情報:

- Description全文
- When to use全文
- Before pasteの詳細
- Variables
- Source
- Last used context
- Context & Size詳細
- Permissions詳細
- Retention/sync設定
- コード全文
- Markdown Raw/Rendered/Code Blocks切替

2026-06-29時点では、右側パネル常設ではなく、カード下に `Details` を開くカード内アコーディオンを第一候補にする。理由は、Dev Clipboardがエディタ/ターミナル上にせり出す前提では横幅が限られ、右カラムを常設すると一覧と本文プレビューが狭くなるため。

Detailsの方針:

- 本文の全文表示はDetailsではなく、本文プレビュー/コードブロック自体を拡張して行う。
- Compact/Normalでは、コードブロック上のExpand操作で現在の本文ブロックが全文表示に広がる。
- Largeでは本文ブロックを最初から広く表示するため、Expand操作は出さない。
- Detailsは本文の重複表示に使わない。
- Detailsは、Dev metadata由来の検索理由、Source、Usage context、Variables、Risk breakdownなど、本文/ノートとは別の追加情報がある場合だけ表示する。
- Compact/NormalのDetailsは、追加情報があっても初期状態では閉じて表示する。
- LargeのDetailsは、追加情報がある場合は開いた状態で表示する。Largeの差別化は「本文が広い + 追加情報も見えている」こと。
- 一覧カードは軽く、本文は本文ブロック内で深く読む。

Detailsに入れる具体例:

- `Search reason`: `再帰的に削除` が `rm -rf dist` に対応した理由。
- `Source context`: CursorでコピーしたReactコンポーネント、Terminalで実行したDocker確認コマンドなどの出どころ。
- `Variables`: `web` サービス名、`dist` ディレクトリ、`query` propsなど、貼る前に置き換える可能性がある値。
- `Risk breakdown`: `rm -rf node_modules dist` が何を削除するか、`docker compose down --volumes` が何に影響するか。

### Window Model

Dev Clipboardのウィンドウは、通常の固定3カラムアプリではなく、画面の右または左からせり出すスライドインパネルを想定する。

方針:

- グローバルショートカットで開く。
- 左カラム相当の保管庫ナビは、サイドバーではなく上部ヘッダー/フッターの固定ナビとして常時アクセス可能にする。
- カード一覧を主役にする。
- 詳細情報は選択カード内のDetailsで表示する。将来的にSpace previewを追加してもよいが、MVPでは右カラム常設を避ける。
- 画面幅が狭い場合でも、選択カード内の折りたたみで詳細にアクセスできるようにする。

見え方:

- エディタやターミナルで作業している画面の上に、Dev Clipboardが最前面で一時表示される。
- 背景の作業画面は暗く残し、現在の貼り先コンテキストを失わないようにする。
- Dev Clipboard本体は強いシャドウ、薄い透過、明確な境界線で前面感を出す。
- 目的は「アプリに移動する」ではなく「今の作業の上で、貼る前に確認する」体験にする。

### Window Width Modes

`Compact`, `Normal`, `Large` はカード単体の密度だけではなく、PC画面に対するDev Clipboardウィンドウ幅と閲覧モードの違いとして整理する。

Normalは、2026-06-29時点のTauri Spikeの見た目を基準にする。現在のSpikeは `1120 x 740` で、作業中のアプリの上に大きめに重なるが、背後の文脈もある程度残る。この状態を標準の実務モードとする。

方針:

- `Compact` と `Normal` では、背後のエディタ/ターミナル/ブラウザがある程度見えていることを重視する。
- `Large` は整理・編集・詳細確認モードとして扱い、背後の作業アプリが隠れてもよい。
- ウィンドウ幅が変わっても、基本の文字サイズ、余白、カードトーンは変えない。
- サイズ差は、ウィンドウ幅、Detailsの扱い、本文プレビュー量、ノート表示量、アクション表現で作る。

目安:

| Mode | 画面に対する幅 | 役割 | 背後の作業アプリ |
| --- | --- | --- | --- |
| Compact | 画面幅の約40-50% | 履歴をすばやく探す / 軽くコピーする | しっかり見える |
| Normal | 画面幅の約60-70% | 標準の確認 / 日常的な再利用 | ある程度見える |
| Large | 画面幅の約80-95% または fullscreen-like | 詳細確認 / 編集 / 整理 | あまり見えなくてよい |

ウィンドウ幅の実装メモ:

- MVPではNormalを基準に実装し、Compact/Largeは表示モードとして先に検証してよい。
- 後続でTauriウィンドウ自体のリサイズまたはプリセット幅変更を入れる。
- Compact/Normalは「作業中の画面に寄り添う」温度感を守る。
- Largeは「いったん整理する」明示的なモードにする。

## Header And Status

ステータスはヘッダー上の小さい横並び表示にする。

表示する暫定ステータス:

- `Local only`
- `Capture on/off`
- `Internal copies ignored` / `External copies captured`

方針:

- ステータスは常時見えるが、カードや検索より目立たせない。
- `Store: SQLite` のような技術スパイク文言は最終UIでは出さない。
- 設定アイコンはステータス行の右端に小さく置く。
- ヘッダー本体とは罫線で区切る。
- ステータス行とヘッダーは上部固定にする。

ヘッダー本体:

```text
Chat  Editor  Terminal  |  All Vaults    Search    Card size
```

検索:

- 検索窓はインライン表示。
- 虫眼鏡アイコンは残す。
- `⌘F` ヒントを出し、フォーカス時は消す。
- `Command+F` でアプリ内検索窓へフォーカスする。
- `Esc` で検索窓のフォーカスとFilter/Indexポップオーバーを閉じる。
- 検索窓フォーカス時はヘッダー上に不透明オーバーレイとして広がる。
- 展開した検索窓は右側のカードサイズ切り替えに被せず、右基準で左方向へ広げる。
- placeholderは `Search body, notes, risk...` のように検索対象を示す。

カードサイズ切り替え:

- よく使う表示切り替えとして扱う。
- 初心者は `Large`、中級者は `Normal`、上級者は `Compact` のイメージ。
- 文字ラベルではなくアイコン中心のコンパクトな切り替えを検証する。

Capture on/off:

- 他アプリでコピーしたテキストをDev Clipboardが取り込むかどうかのスイッチ。
- 再生アイコンは意味が伝わりにくいため、最終UIでは `Capture` の表現に置き換える。
- MVPスパイクではステータスで `Capture on/off` を表示して意味を補う。

削除/ゴミ箱:

- ヘッダー右端のゴミ箱は意味が曖昧で危険に見えるため置かない。
- 削除はカード単位、または設定/管理画面に下げる。

## Settings Information Architecture

設定画面は、ヘッダーに常時置くと意味が伝わりにくい操作や、日常的には頻繁に触らない方針を収める場所にする。

2026-06-30時点では、`Capture on/off` と `Capture current clipboard` はヘッダーから外す方向で検証する。理由は、コピーアプリとして直感的に意味が取りにくく、カード確認や検索より目立つと体験の焦点がぶれるため。

設定に入れるカテゴリ:

| Category | 内容 | 方針 |
| --- | --- | --- |
| General | ログイン時に起動、メニューバー表示、通知、言語など | 一般的なMacアプリ設定としてまとめる |
| Privacy & Capture | Dev Clipboard内コピーの無視、他アプリの自動取り込み、手動取り込み、無視するアプリ | 常時操作ではなく、初期設定/詳細設定として扱う |
| Storage | Local only、保持期間、未使用クリップ削除、重いデータの整理、履歴削除 | セキュリティ不安と容量不安を解消する |
| Safety Rules | Terminalの危険コマンド判定、Review必須ルール、`rm -rf` / `sudo` / `git reset --hard` など | デフォルトON。ワンクリック全OFFは避ける |
| Display | System/Dark/Light、カードサイズ、コードブロックテーマ | UI検証と実務の見やすさを支える |
| Shortcuts | グローバル表示、検索、カードサイズ切替、コピー、Details展開 | 実務速度に関わるため独立カテゴリにする |
| Help & Onboarding | Help、FAQ、使い方ドキュメント、アプリ紹介ページ、動画/スライド | 初回理解と導入後の迷いを減らす |
| Integrations & Future | MCP、Cloud sync、AIメモ生成、Source app icons、検索ソート、カードごとの削除 | 将来の拡張余白として整理する |

Displayの詳細:

- Appearanceは `System`, `Dark`, `Light` を用意する。
- Card sizeは `Compact`, `Normal`, `Large` を用意する。
- Code block themeは、CursorやVS Codeで見慣れたコード色をDev Clipboard上のクリップに適用する設定として置く。
- Shikiなどのシンタックスハイライトは実装候補。テーマ読み込みは将来的にCursor/VS Codeテーマとの近似を検証する。

設定画面での注意:

- ON/OFFは最終デザインではテキストピルではなく、一般的なトグルスイッチにする。
- 各カテゴリ名の下に罫線を入れ、カテゴリタイトルと設定内容を視覚的に切り分ける。
- Capture系を設定にしまっても、`Internal copies ignored` のような状態は上部ステータスで小さく見せる。
- ヘッダーは検索、保管庫、カードサイズ切り替えに集中させる。
- 削除は、ヘッダーではなくカードごとの削除、またはStorageの管理機能として扱う。
- Source app iconや検索結果ソートはカード一覧の理解に効くため、後続のUI整理で優先して検証する。

追加検討項目:

- Privacy & Captureに、無視するアプリを設定する項目を置く。例: パスワード管理アプリ、銀行/証券系、プライベートブラウザ、任意指定アプリ。
- Storageに、履歴の削除ボタンを置く。全削除は危険なので、確認ダイアログと削除範囲の選択を必須にする。
- Generalに、ログイン時に起動、メニューバー常駐、通知、アップデート確認などの一般設定を置く。
- Shortcutsに、グローバルショートカット、検索、カードサイズ切替、コピー、Details展開、設定表示などをまとめる。
- Help & Onboardingに、Webドキュメント、FAQ、使い方ページ、アプリ紹介スライド/動画への導線を置く。

### 1. Header

カード上部の役割は、文脈と状態を即時に伝えること。

表示要素:

- Vault badge: `Chat`, `Editor`, `Terminal CLI`
- Type badge: `Shell`, `HTML`, `Markdown`, `Color`, `URL`, `Image`
- Risk badge: `Safe`, `Check`, `Risk`, `Destructive`
- Context badge: `~1.8k tokens`, `86 lines`, `4.8 MB`, `Large`
- Saved/Pinned indicator
- Last used / copied time

例:

```text
[Terminal CLI] [Shell] [Risk] [2 lines]          Last used 2d ago
```

方針:

- 危険度は色だけに頼らず、文字ラベルも出す。
- Terminal CLIの危険状態は最も目立たせる。
- Chat/Editorは文脈バッジを控えめにし、本文とメモを読みやすくする。
- Context/size表示は補助情報として小さく出す。ただし大きいものは `Large` として目立たせる。

### 2. Body Preview

カード中央は、コピー本文のプレビュー。

内容ごとの表示:

- Code: Shikiでシンタックスハイライト。
- Shell command: monospace + コマンド/フラグ/パスを強調。
- Markdown: レンダープレビューを基本、Raw切替は詳細ビュー。
- URL: タイトル/ドメイン/URL。
- Color: スウォッチ + HEX/RGB/HSL。
- Image: サムネイル + サイズ + 形式。
- Plain text: 2-5行のテキストプレビュー。

方針:

- 本文はカードの主役だが、長すぎる場合は切る。
- Largeカード以外では、本文をすべて表示しない。
- コードやMarkdownは、詳細ビューで全文確認できる。

### 2.5 Context and Storage Weight

カードには、AIに渡す場合の文脈量と、保管庫を圧迫する重さを示す。

目的:

- AIに渡す前に、長すぎるか判断できる。
- 大きい画像、リッチデータ、ログ、Markdownを見分けられる。
- 将来的にStorage & Cleanup機能へつなげる。
- 「意味」だけでなく「コスト」も貼る前に理解できる。

表示候補:

- `~240 tokens`
- `~3.2k tokens`
- `86 lines`
- `3 code blocks`
- `4.8 MB`
- `Large`
- `AI cost: High`

カード種別ごとの表示例:

```text
Chat: Markdown · ~1.8k tokens · 3 code blocks
Editor: TSX · 86 lines · ~1.2k tokens
Terminal CLI: Shell · 2 lines · Low context
Image: PNG · 2400 x 1600 · 4.8 MB
```

重要:

- トークン数はモデルごとに異なるため、MVPでは推定値として `~` を付ける。
- 正確な課金計算ではなく、UI上の判断補助として扱う。
- 画像やリッチデータは、MVPではサイズ表示だけでよい。
- 重いクリップの削除/圧縮/最適化は後続機能でよい。

表示優先:

1. 大きいデータサイズ: `Large · 18.2 MB`
2. AI文脈量が多い: `~12k tokens`
3. 通常補助: `42 lines`, `~600 tokens`

将来の操作:

- Sort by size
- Sort by token estimate
- Show largest clips
- Delete unused large clips
- Save thumbnail only
- Compress image
- Summarize before sending to AI

### 3. Memo Summary

カード下部に、メモの要約を表示する。

表示優先順:

1. `Before paste`
2. `Description`
3. `When to use`
4. 自動分類/自動説明
5. メモなし状態

例:

```text
Before paste: `dist` を消す前に `pwd` と `ls dist` を確認。
```

メモがない場合:

```text
Add note: 何に使うか、貼る前に確認することをメモできます
```

方針:

- メモ要約は1-2行。
- ユーザーがメモを付ける価値を感じるよう、空状態も明確にする。
- Terminal CLIでは `Before paste` を優先表示する。

## Terminal CLI Vault

Terminal CLI保管庫は、Dev Clipboardの「貼る前に理解する」価値が最も強く出る場所。

目的:

- コマンドの意味を貼る前に確認できる。
- `rm`, `mv`, `docker`, `git` など、失敗時の影響が大きい操作を見分けられる。
- 複数行コマンドをコピーする前に、結合後の内容とリスクを確認できる。
- Auto Pasteに頼らず、ユーザーが最後に貼り先でCommand+Vする前提を保つ。

Terminal CLIカードで優先表示するもの:

1. 危険度: `Safe`, `Path sensitive`, `Branch state`, `Destructive`, `Deletes volumes`
2. コマンド本文: 1-3行をmonospaceで表示
3. Before pasteメモ: 実行前の確認手順
4. Auto Paste状態: 破壊的コマンドは常にOFF
5. 行数と推定トークン数

危険コマンドの例:

```text
rm -rf dist
mv ~/Downloads/.env.local ./apps/web/.env.local
docker compose down --volumes --remove-orphans
git stash push -m "wip before branch switch"
```

UI方針:

- 破壊的操作は赤系の状態表示にする。ただし色だけで判断させず、必ずラベルを併記する。
- `rm -rf` や `--volumes` のような危険部分は本文内でも強調する。
- Space previewでは `Risk`, `Description`, `Before paste`, `Safer alternative` を優先する。
- 複数選択で結合コピーする場合、危険コマンドが含まれると `Preview required` にする。
- 自動順次ペーストはMVPに入れない。事故リスクが高く、現時点のコア価値から外れる。
- `Safety Rules` は大きな常時ボタンではなく、保管庫名左の状態アイコンで表す。
- 状態アイコンはRules ON / 注意あり / 一時停止中を示し、クリックでルール設定へ入る。
- `Recent`, `Risk`, `Used` は常時並べず、通常状態では `Sort: Risk` のプルダウンにまとめる。

## Vaults and Modes

Dev Clipboardは、デフォルト保管庫として `All Vaults`, `Chat`, `Editor`, `Terminal` を持つ。

通常状態の並び:

```text
Chat  Editor  Terminal  |  All Vaults
```

理由:

- `Chat`, `Editor`, `Terminal` が基本3保管庫。
- `All Vaults` は横断表示/横断検索のための補助モード。
- 通常時は現在の作業文脈を選ぶ体験を主にする。

検索状態の並び:

```text
All Vaults  Chat  Editor  Terminal
```

理由:

- 検索時は「どこに保存したか分からない」状態が多い。
- 横断検索を初期値にした方が負荷が低い。

ユーザー追加の保管庫:

- 将来的には必要になる可能性が高い。
- ただしMVPでは、自由な保管庫追加を前面に出すとプロダクトが重くなる。
- 初期は `+` を強く出さず、設定または保管庫メニューの第2階層に置く。
- 追加保管庫は `Docs`, `Design`, `Client`, `Personal Snippets` などの用途が考えられる。

Dev / Plain モード:

- Devモードは現在の主軸。メモ、Risk、Before、Token、Rulesを表示する。
- Plainモードは通常の軽いクリップボード用途。説明やルール表示を最小化する。
- ニーズはあるが、MVPの最初から大きく打ち出すと軸がぼやける。
- 設計上は将来の切り替え余地を残す。

方針:

- 初期体験はDevモードを基本にする。
- Plainモードは「軽く使いたい時の表示プリセット」として検討する。
- 自由な保管庫追加より先に、3保管庫 + All Vaults の体験を固める。

## Chat Vault

Chat保管庫は、AIに渡す前の文脈整理と再利用を主役にする場所。

目的:

- よく使うプロンプトを説明付きで保存する。
- Markdown、コードブロック、エラーログ、要約素材をAIへ渡す前に確認できる。
- 長すぎるログや不要な文脈を削る判断ができる。
- APIキー、メールアドレス、社内URLなど、機密情報らしきものを貼る前に意識できる。
- 複数のクリップを組み合わせて、Prompt Setとしてコピーできる。

Chatカードで優先表示するもの:

1. コンテンツ種別: `Prompt`, `Markdown`, `Review`, `Summary`, `Error log`
2. 推定トークン数
3. コードブロック数
4. 長文/機密/ログ含有の注意状態
5. Before sendingメモ

表示例:

```text
[Chat] [Markdown] [Large] [~8.6k tokens]
Setup notes with error log
Before: 重複ログを削る。必要なら最後の30行だけでよい。
```

UI方針:

- Terminal CLIほど強い警告UIにはしない。
- 大きいトークン数、コードブロック数、機密情報の可能性を軽く見える化する。
- Space previewでは `Purpose`, `Before sending`, `Prompt shape`, `Context & Size`, `Reuse note` を優先する。
- 複数選択では `Prompt Set` として合成コピーできる見え方にする。
- MVPでは正確なトークン計算や秘密情報検出を必須にせず、まずUI要素として成立するか検証する。

## Meaning Search

Dev Clipboardの検索は、コピー本文だけではなく、保存された意味まで探せるようにする。

目的:

- コマンド名やコード断片を覚えていなくても、用途や危険性から探せる。
- メモを書く価値を、再利用時の検索性にもつなげる。
- クリップ履歴を、使い込むほど育つ小さな開発知識ベースにする。
- 保管庫内で見つからない場合に、Web検索や登録済みAIページへ自然に橋渡しする。

検索対象:

- コピー本文
- タイトル
- ユーザーメモ
- Description
- Before paste / Before sending
- Risk
- Safer alternative
- Type / Vault / Tags
- 将来的な自動説明/要約

表示例:

```text
Search: 再帰的に削除

Clean build output
rm -rf dist

Matched in Risk:
`rm -rf` は指定したディレクトリ配下を再帰的に削除する。
```

UI方針:

- 通常状態では検索窓を閉じる。カード一覧と現在の保管庫を主役にする。
- 右上の検索アイコン、またはショートカットで検索モードに入る。
- 検索モードでは検索窓を開き、カテゴリ名や表示設定を圧縮して検索体験を強く出す。
- 本文以外にヒットした場合は、必ず `Matched in Risk`, `Matched in Before`, `Matched in Memo` のようにヒット元を表示する。
- 見えている本文やノートに直接ヒットしている場合は、該当箇所のハイライトを主役にする。
- `Body contains "..."` や `Description contains "..."` のような直接一致の理由文は、ハイライトと重複するため通常は出さない。
- 本文に存在しない言葉、折りたたまれた情報、またはDev metadataでヒットした場合だけ、理由文を出す。
- 例: `再帰的に削除` で `rm -rf dist` がヒットする場合は、`Dev metadata maps "再帰的に削除" to Recursive delete` のように補足する。
- 検索語が見えていないのにヒットしている状態を放置しない。ユーザーが理由を理解できる表示が必要。
- 検索の基本スコープは `All Vaults` にする。思い出せない状態のユーザーに先に保管庫選択を求めない。
- `Chat`, `Editor`, `Terminal` は検索後に絞り込むためのカテゴリとして使う。
- 各カテゴリの保存数は常時表示しない。必要ならホバーや詳細メニューで見せる。
- 検索画面ではアプリ名とロゴを出さず、保管庫ナビと検索操作を主役にする。
- 複数ヒット時は、一覧上部に件数とヒット元の内訳を表示する。
- 検索結果はスコア順または危険度順で上にまとめる。
- 非ヒットの周辺候補は薄くぼかさず、明確な罫線とセクション見出しで分ける。薄すぎる表示は目を凝らす原因になる。
- 各ヒットカードには順位を付け、どの結果が最も関連しているかを視覚的に分かるようにする。
- 検索窓横に `Clips`, `Web`, `AI` の控えめな導線を置く。
- `Web` は検索語をデフォルトブラウザで開く。
- `AI` は登録済みAIアプリまたはブラウザ内AIページを開く。MVPでは本文の自動送信はしない。
- 繰り返し使う操作は積極的にアイコン化する。検索モードでは `Clips`, `Web`, `AI` はアイコンのみ + tooltipで成立するか検証する。
- `Compact`, `Normal`, `Large` は検索条件ではなくカード密度の表示設定なので、検索窓横ではなく設定ボタンの左に置く。
- `Meaning`, `Recent`, `Risk` は検索結果の並び/解釈に関わるため、当面は文字ラベルを残す。
- Filter/Indexは検索窓内右側の小アイコンから開く。
- Filter/Indexの初期カテゴリは `Type`, `Media`, `App`, `Vault`, `Safety`, `Usage` とする。
- `Type`: Command / Code / Markdown / Text / URL / Color
- `Media`: Image / SVG / PDF / File / Audio / Video / Vector
- `App`: Cursor / Figma / Illustrator / Chrome / Finder / TextEdit / More
- `Vault`: Chat / Editor / Terminal
- `Safety`: Risk / Sensitive / Large context / Auto Paste off
- `Usage`: Pinned / Recently used / Never pasted / Saved
- Filter/Indexは検索窓に紐づく吹き出し型の一時フローティングUIとして表示する。
- フィルターは検索結果を絞るためのタグ操作であり、保管庫の構造変更とは分ける。
- 0件時は `Search Web` / `Open AI` を出すが、クリップ本文は確認なしに外部送信しない。

優先度:

- MVPにUI要素として入れる価値が高い。
- 初期実装はAI検索ではなく、ローカルメタデータ全文検索でよい。
- 将来的にベクトル検索や同義語検索を検討できるが、最初は検索結果の説明可能性を優先する。

### 4. Action Row

MVPでは、強すぎる自動ペーストに依存しない。

基本アクション:

- Copy
- Preview
- Edit note
- Drag handle
- More menu

### 4.5 Copy vs Paste Flow

Dev Clipboardの体験は「アプリが勝手に貼る」ではなく、ユーザーが理解してから貼ることを基本にする。

実際の流れ:

```text
Review / Understand → Copy to clipboard → User pastes in target app
```

画面上の言葉:

- 通常クリップでは、コードブロック内のコピーアイコンで `Copy to clipboard` する。
- 危険クリップでは、コピー操作を `Review` / `Copy after review` として扱う。
- `Paste` という言葉は、Auto Pasteや貼り先アプリへの直接操作を想起させるため、MVPでは慎重に使う。
- ユーザーに見せる主体験は「コピー」ではなく「貼る前に確認して、貼れる状態にする」。

UI方針:

- 通常カードの固定コピーアイコンは削除し、本文ブロック右上にコピー導線を置く。
- コピー導線は完全に隠さず、薄く常時表示し、hoverで強調する。
- クリック後は `Copied` / check状態を短時間表示する。
- 危険コマンドはすぐ `Copied` にせず、Review状態またはPreview必須にできる余地を残す。

Terminalのコピー導線:

- Safe: `Copy` → `Copied`
- Check / Path sensitive / Branch state: `Review`
- Destructive / Deletes volumes: `Review required`
- Auto PasteはMVPではOFF。将来はSafeなクリップに限って、ユーザーが明示的に許可した場合のみ検討する。

将来/オプション:

- Paste to front app
- Auto Paste
- Convert
- Summarize / reduce context
- Cleanup large clip
- Create snippet
- Share/sync

重要:

Auto PasteはMVPでは基本OFF。実装する場合も上級者向けオプションにする。Accessibility権限が必要であり、前面アプリにキーボード入力を送れる広い権限になるため。

## Detail View

カードを開いた詳細ビューでは、本文とメモを両方編集/確認できる。

### Detail View Layout

左:

- Full content preview
- Rendered / Raw / Code Blocks tabs if Markdown
- Theme preview if Code
- Command breakdown if Shell

右:

- Description
- When to use
- Before paste
- Variables
- Risk
- Source
- Last used context
- Tags
- Retention

### Memo Fields

必須ではないが、構造化して持つ。

```text
Description: これは何か
When to use: いつ使うか
Before paste: 貼る前に確認すること
Variables: 置き換える値
Risk: 注意点
Source: コピー元
Last used context: 最後に使った文脈
```

MVPでは全フィールドを常時表示しない。まずは以下を優先:

1. Description
2. When to use
3. Before paste
4. Risk

## Density Modes

`Compact`, `Normal`, `Large` は文字サイズや余白の違いではなく、ウィンドウ幅と閲覧モードの違いとして扱う。

共通ルール:

- 基本の文字サイズ、余白、カードのトーンは3サイズで揃える。
- サイズ差は、ウィンドウ幅、本文ブロックの表示量、ノート表示量、空欄編集導線、ボタン表現で作る。
- Compact/Normalでは本文ブロックをExpandすれば全文にアクセスできる。
- Largeでは本文ブロックを最初から広く表示する。
- Expand後もカードを無制限に伸ばさず、本文ブロック内スクロールで読む。
- 目安: Compact expandedは最大約240px、Normal expandedは最大約420px、Largeは最大約640px。
- 編集モードではサイズに関係なく全文を扱える。
- 短い本文でも3モードの差が出るように、LargeではDetails/編集/メタ情報の露出を増やす。

表示ルール:

| 項目 | Compact | Normal | Large |
| --- | --- | --- | --- |
| 用途 | 作業画面を見ながら素早く探す | 標準の確認と再利用 | 整理・編集・詳細確認 |
| ウィンドウ幅 | 画面幅の約40-50% | 画面幅の約60-70%。現Spike基準 | 画面幅の約80-95% |
| 背後の作業アプリ | しっかり見える | ある程度見える | あまり見えなくてよい |
| Header badges | 最小: Type, Risk, tokens/lines | Type, Risk, tokens/lines, matched | Type, Risk, tokens/lines, matched, source/usage |
| Title | 表示 | 表示 | 表示 |
| Body preview | 1行相当 | 2-4行相当 | 8-16行相当 |
| Description | 表示。空欄は `Add note` | 表示。空欄は `Add note` | 表示。空欄は `Add note` |
| When to use | 表示。空欄は `Add note` | 表示。空欄は `Add note` | 表示。空欄は `Add note` |
| Before | 1行 | 1-2行 | 2-4行 |
| 空欄Add note | カード上に表示 | カード上に表示 | カード上に表示 |
| Copy/Review | アイコン+短いラベル、または将来アイコン化 | 文字付き | 文字付き |
| 本文Expand | あり | あり | なし。最初から広く表示 |
| Details | 追加情報がある時だけ | 追加情報がある時だけ | 追加情報がある時だけ |
| 編集導線 | カード上に常時表示 | カード上に常時表示 | カード上に常時表示 |

タグの優先順位:

- `Vault`, `Type`, `Risk` は、閉じたカードでも優先して表示する。
- `Matched in ...` は検索中のみ表示する。
- `lines` と `tokens` は、短いクリップではノイズになりやすいため常時表示しない。
- `1 line`, `~1 tokens` のような低情報タグは、Normal以下では非表示にしてDetails内へ下げる。
- 大きい文脈量、複数行、Large contextだけは一覧で目立たせる。

初期値:

- 通常の保管庫一覧は `Normal`。
- 検索結果が多い場合は `Compact` へ切り替える余地を残す。
- 長いコード/Markdownの確認、メモ整理、保存済みクリップの棚卸しでは `Large` を使う。

### Compact

目的:

作業中のアプリを見ながら、履歴をすばやく探したいとき。

表示:

- Header badgesは最小限。
- 本文は1行相当。
- 長い本文は本文ブロックのExpandで展開できる。
- `Before` は1行だけ。
- `Description` / `When to use` も表示する。
- 空欄の `Add note` も出す。

使いどころ:

- Quick overlay
- 検索結果
- 作業画面を広く残したい時

### Normal

目的:

標準カード。今のSpikeの表示幅を基準に、本文と重要メモを確認して再利用する。

表示:

- Header badges
- 2-4行本文
- 長い本文は本文ブロックのExpandで展開できる。
- 入力済みの `Description` / `When to use`
- `Before` 1-2行
- Action row

使いどころ:

- 保管庫一覧の標準
- 日常的なコピー/Review

### Large

目的:

コード、Markdown、画像、複数行コマンド、メモを整理・編集しながら確認する。

表示:

- Header badges
- 8-16行程度の本文/コード/画像
- 入力済みメモを長めに表示
- 重要なリスク/変数
- 本文ブロックを最初から広く表示し、Expandボタンは出さない
- `Description`, `When to use`, `Before`, `Risk`, `Size`, `Usage` を短文でも見せる
- Action row

使いどころ:

- Editor保管庫
- Terminal CLI保管庫
- Fullscreen整理画面

## Vault-Specific Cards

## Chat Card

対象:

- AIプロンプト
- AI回答
- 調査メモ
- Markdown
- URL
- エラー文

表示優先:

1. Markdown/テキストの読みやすさ
2. コードブロックの有無
3. どのAI/アプリから来たか
4. メモ要約

追加バッジ:

- `Prompt`
- `Markdown`
- `Contains code`
- `From Claude`
- `From ChatGPT`
- `From Codex`

注意:

Chat保管庫では、Markdown内のShellコードブロックを検出して、危険コマンドが含まれる場合はカード上に警告を出す。

## Editor Card

対象:

- HTML/CSS/TS/JS/JSON
- ファイルパス
- コンポーネント名
- CSSカラー
- 設定ファイル断片

表示優先:

1. Shikiによるコードテーマプレビュー
2. 言語バッジ
3. メモ要約
4. カラー/パス/変数の強調

追加バッジ:

- `HTML`
- `TS`
- `CSS`
- `JSON`
- `Color`
- `Path`

テーマ:

- MVPでは標準ダークテーマ。
- Cursor/VS Code風テーマは検証済み。
- 将来的にVS Code/CursorテーマJSONインポートを検討。

## Terminal CLI Card

対象:

- Shell command
- Git command
- npm/pnpm/bun/yarn
- Docker
- brew
- curl
- chmod/chown
- rm/mv/cp

表示優先:

1. コマンド本文
2. 危険度
3. Before paste
4. 変数/パス
5. 実行前確認

追加バッジ:

- `Shell`
- `Git`
- `Package`
- `Docker`
- `Destructive`
- `Needs review`

Terminal CLIカードでは、便利さより安全性を優先する。

MVPではAuto Paste不可、またはデフォルトOFF。

## Risk States

### Safe

例:

- `pwd`
- `ls`
- `pnpm install`

表示:

- 控えめな緑/青
- 追加確認なし

### Check

例:

- `mv`
- `cp`
- `chmod`
- `docker compose down`

表示:

- 黄色/オレンジ
- Before pasteを表示

### Risk

例:

- `sudo`
- `curl | sh`
- `git reset --hard`

表示:

- オレンジ/赤
- Previewを推奨
- そのままペーストではなくCopy中心

### Destructive

例:

- `rm -rf`
- `git clean -fd`
- `docker system prune -a`

表示:

- 赤ラベル
- Before pasteを必ず表示
- Auto Paste不可
- 結合ペースト時も全体判定

## Multi-Select Combined Paste

目的:

複数コマンドや複数クリップを1つにまとめてコピー/ペーストする。

操作:

- Shift/Commandで複数選択。
- 選択バーを表示。
- `Preview combined`
- `Copy combined`
- `Paste combined` optional
- `Clear`

MVP:

- 改行結合
- プレビュー
- 結合後の危険判定
- コピー

MVPでやらない:

- 自動順次ペースト
- タイマー付き実行
- Enter送信

## Permissions and Paste Behavior

MVPでは、ユーザーが不安に感じる権限を避ける。

基本:

- `Copy`: Dev Clipboardがシステムクリップボードへセット。
- ユーザーが貼り先アプリで `Command+V`。
- Drag and dropはユーザー操作として提供。

避ける:

- 初期状態でAuto Pasteを要求しない。
- Accessibility権限を初回オンボーディングで要求しない。

将来:

- Auto Pasteは明示的にONにしたユーザーだけ。
- 保管庫ごとにON/OFF。
- Terminal CLIはデフォルトOFF。
- Destructive/RiskはAuto Paste不可。

## Empty States

### No Note

```text
このクリップに説明を追加できます。
何をするか、いつ使うか、貼る前の確認を書いておくと安全に再利用できます。
```

### No Vault Items

Chat:

```text
AIに貼るプロンプト、回答、調査メモを保存します。
```

Editor:

```text
コード、カラー、ファイルパス、設定断片を保存します。
```

Terminal CLI:

```text
よく使うコマンドを説明付きで保存します。
危険な操作は貼る前に確認できます。
```

## Data Model Draft

```ts
type ClipVault = "chat" | "editor" | "terminal";

type ClipKind =
  | "plain_text"
  | "rich_text"
  | "markdown"
  | "code"
  | "shell_command"
  | "url"
  | "color"
  | "image"
  | "file";

type RiskLevel = "safe" | "check" | "risk" | "destructive" | "unknown";

type ClipSizeMeta = {
  characterCount?: number;
  estimatedTokens?: number;
  lineCount?: number;
  byteSize?: number;
  formattedSize?: string;
  codeBlockCount?: number;
  imageDimensions?: {
    width: number;
    height: number;
  };
  contextWeight?: "low" | "medium" | "high" | "large";
};

type ClipNote = {
  description?: string;
  whenToUse?: string;
  beforePaste?: string;
  variables?: Array<{
    name: string;
    description?: string;
    defaultValue?: string;
  }>;
  riskNote?: string;
  source?: string;
  lastUsedContext?: string;
};

type Clip = {
  id: string;
  vault: ClipVault;
  kind: ClipKind;
  title?: string;
  content: string;
  plainText?: string;
  language?: string;
  note: ClipNote;
  sizeMeta: ClipSizeMeta;
  riskLevel: RiskLevel;
  tags: string[];
  isPinned: boolean;
  isSaved: boolean;
  isSecret: boolean;
  createdAt: string;
  copiedAt: string;
  lastPastedAt?: string;
  pasteCount: number;
  retentionPolicy: "default" | "forever" | "delete_after_days" | "delete_if_unused";
  retentionDays?: number;
  syncEnabled: boolean;
};
```

## HTML Mock Requirements

次に作るHTMLモックでは、最低限以下を表現する。

1. 左に保管庫ナビ: Chat / Editor / Terminal CLI
2. 中央にカード一覧
3. 右に詳細/メモパネル
4. EditorカードはShiki風コードプレビュー
5. Terminalカードは危険度とBefore pasteを強調
6. ChatカードはMarkdown/コードブロックを含む見え方
7. Compact / Normal / Largeの切り替えUI
8. 複数選択時の下部バー
9. Auto PasteではなくCopy中心のアクション
10. トークン数/行数/データサイズの表示
11. 大きいクリップを示す `Large` バッジ

2026-06-27 update:

`experiments/clip-card-mock/` に静的HTMLモックを作成した。

確認できたこと:

- 3保管庫ナビ、カード一覧、右側詳細パネルの構成は成立する。
- Editorカードで、Shiki/Cursor風のコードプレビューをカード内に置ける。
- Terminal CLIカードで、危険度とBefore pasteを強調できる。
- Chat/Markdownカードで、コードブロック数や推定トークン数をメタ情報として表示できる。
- トークン数/行数/データサイズは、カード上の軽い補助情報として成立する。
- 大きいものだけ `Large` バッジで目立たせる方針がよさそう。
- 複数選択バーは有効だが、下部カードを覆うため表示位置/高さは次回調整する。

2026-06-27 compact update:

`experiments/clip-card-mock/index-compact.html` に第2案を作成した。

確認できたこと:

- 右からせり出すスライドインパネル構成は、プロダクトの使い方に合う。
- 左サイドバーを廃止し、上部固定ナビにすることで保管庫アクセスが常時可能になる。
- カード上の情報は、Vault/Type/Risk/Title/短い本文/1行メモ/軽いメタ情報まで絞ると見やすい。
- HTML entrypointの詳細は、常時右カラムに置くより、Space preview/Finder preview的な第2階層に下げる方が自然。
- 右パネルを隠すレスポンシブではなく、狭い画面ではカード内アコーディオンやSpace previewで同じ情報にアクセスできる設計が必要。
- 複数選択バーは、最初のモックに近い下部中央フローティングを採用する。ユーザー確認では、この位置の方が操作対象として分かりやすい。

## Open Questions

1. カード上でメモを直接編集できるようにするか、詳細パネルだけで編集するか。
2. Quick overlayではメモをどこまで見せるか。
3. Terminal CLIカードの危険度をどの程度強く見せるか。
4. MarkdownカードはRenderedを優先するかRawを優先するか。
5. Editorカードのコード表示は横スクロールか折り返しか。
6. ドラッグ&ドロップをMVPに含めるか。
7. クリップ保存と単なる履歴の境界をどう見せるか。
8. トークン表示は常時表示するか、Chat/Editorだけに出すか。
9. データサイズ表示はカード上に常時出すか、大きいものだけ出すか。
10. Storage & Cleanup画面をMVPモックに含めるか。

## 2026-06-28 Implementation Notes

Tauri/React Spikeで、以下を実機確認した。

- クリップボード監視。
- クリップボードへのcopy-back。
- SQLite保存。
- 再起動後のカード復元。
- SQLite FTSの導入。
- Dev metadata検索。
- 検索結果の `Matched in Body` / `Matched in Dev metadata` 表示。
- `rm -rf dist` を `再帰的に削除`, `再起的に削除`, `再帰削除`, `再起削除`, `dist削除` で検索する検証。
- インラインBeforeメモ編集。
- 編集したBeforeメモのSQLite保存とFTS再インデックス。
- `ls dist` で `rm -rf dist` を `Matched in Before` として検索する検証。
- Dev Clipboardフォーカス中のclipboard changeを保存しない内部コピーガード。
- `Internal copy guard on` / `External capture on` の状態バッジ。

検索UIは共通コンポーネント化し、検索エンジンはモード別に分ける方針。

- Dev mode: SQLite FTS + Risk / Before / Description / Tags などのメタデータ検索。
- Plain mode: 将来的にN-gramまたは日本語tokenizerを検討。

MVPではDev modeを優先する。Plain modeは、通常文、資料、論文、Web記事、日本語メモを扱う将来モードとして拡張口を残す。

検索語そのものがクリップとして保存されると履歴が汚れるため、検索欄と同じ文字列がクリップボードに入った場合は保存しない。

Dev Clipboard自身の入力欄/編集欄からコピーした文字列も履歴ノイズになるため、アプリ内コピーは保存しないガードを追加した。
