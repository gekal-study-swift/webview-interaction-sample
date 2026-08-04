# WebView Interaction Sample (iOS)

Android 版と同じ Web ページと JavaScript Bridge API を、WKWebView で動かす iOS サンプルです。
同じ Web ページを両 OS で動かし、ネイティブ側の作りの違いを見比べられるようにしています。

WebView URL: <https://webview-interaction-sample.ios.demo.gekal.cn/index.html?env=debug>

Web ページは `window.AndroidInterface` を呼び出します。iOS では同じ名前の API を
`WKUserScript` で注入し、`WKScriptMessageHandler` でネイティブに橋渡ししています。

## 対応機能

- JavaScript / Native の双方向通信
- Toast、端末・バッテリー情報、触覚フィードバック
- クリップボード、共有シート、遅延コールバック
- Web / Native のテーマ同期
- リロード、読み込みエラー画面、再試行
- 同一ホスト内遷移と外部リンクの安全な振り分け

## 構成

| パス | 内容 |
| --- | --- |
| `Webview Interaction Sample/` | iOS アプリ本体 |
| `web/` | WebView に表示する Next.js + MUI のページ（Android 版と同じ実装） |
| `scripts/build-and-install.sh` | 実機向けのビルド・インストール・起動 |
| `scripts/app-icon/` | アプリアイコンのベクタ原本と生成スクリプト |
| `.github/workflows/pages.yml` | `web/` をビルドして GitHub Pages へデプロイ |

アプリ本体のファイルは、Android 版と役割を対応させています。

| iOS | Android | 役割 |
| --- | --- | --- |
| `WebViewController.swift` | `MainActivity.kt` | WebView の生成、ブリッジ、遷移の振り分け |
| `WebViewContainer.swift` | – | SwiftUI から `WebViewController` を使うためのラッパー |
| `ContentView.swift` | `MainActivity.kt` の Compose 部分 | 配色の状態を持ち、画面全体に適用する |
| `AppTheme.swift` | `AppTheme.kt` / `ui/theme/Color.kt` | 配色の種類、保存、Web と揃えた色 |
| `LinkPolicy.swift` | `LinkPolicy.kt` | リンクをどこで開くかの判定 |
| `ExternalLinkOpener.swift` | `ExternalLinkOpener.kt` | 開き方ごとの起動処理 |
| `InAppBrowserViewController.swift` | `InAppBrowser.kt` | 外部サイトを重ねて表示するオーバーレイ |
| `LoadState.swift` | `LoadState.kt` | 読み込み状態の遷移ロジック |

`LinkPolicy.swift` と `LoadState.swift` は UIKit に依存しないため、
シミュレータや実機なしで検証できます（Android 版の同名ファイルと同じ方針）。

## 実機で動かす

接続中の iPhone を確認し、ビルド・インストール・起動まで行います。

```shell
xcrun devicectl list devices
```

```shell
./scripts/build-and-install.sh
```

iOS 端末が 1 台なら自動で選択し、複数接続されている場合は番号付きの一覧から選択できます。
非対話実行では `--device <UDID または端末名>` または `IOS_DEVICE` で明示指定できます。

`--configuration Release` で Release ビルド、`--no-launch` でインストールのみを実行できます。

### 署名

Development Team はプロジェクト設定の `DEVELOPMENT_TEAM`（`N8RU3D7VY6`）を使用します。
未設定の場合はコード署名証明書から検出し、複数ある場合は一覧から選択します。
別の Team でビルドする場合は Team ID を指定します。

```shell
./scripts/build-and-install.sh --device <UDID または端末名> --team <TEAM_ID>
```

事前に、その Team の Apple ID を Xcode > Settings > Accounts でサインインしておく必要があります。
また初回インストール後は、端末で
設定 > 一般 > VPN とデバイス管理 > デベロッパ App から開発元を信頼するまでアプリを起動できません。

現在の Bundle ID `cn.gekal.ios.WebviewInteractionSample` は無料の Personal Team
`N8RU3D7VY6` で登録しています。有料 Team（`3C654MC27L`）に切り替える場合は、
その Apple ID をサインインしたうえで Team ID を指定します。

```shell
./scripts/build-and-install.sh --team 3C654MC27L
```

### よくある失敗

| メッセージ | 原因と対処 |
| --- | --- |
| `No Account for Team "<TEAM_ID>"` | その Team の Apple ID が Xcode にサインインされていない |
| `Failed Registering Bundle Identifier` | その Bundle ID を別の Team が登録済み。Team を変えるか Bundle ID を変える |
| `profile has not been explicitly trusted by the user` | 端末側で開発者証明書を信頼する |
| Provisioning Profile の期限切れ | Personal Team は有効期限が 7 日。再ビルドすると更新される |

## Web 画面

Android 版と同じ Next.js + MUI の実装を `web/` に置いています。

```shell
cd web && pnpm install --frozen-lockfile && pnpm dev
```

静的サイトを生成する場合は次のとおりです。成果物は `web/out` に出力されます。

```shell
cd web && pnpm build
```

`web/public/CNAME` に設定した `webview-interaction-sample.ios.demo.gekal.cn` のルートから配信します。
`main` への push 時に GitHub Actions がビルドして GitHub Pages へデプロイします。
Pull Request ではビルドまでを実行し、デプロイは行いません。

## 外部リンクの開き方

Web ページは Android 版と同じモード名（`ExternalOpenMode`）を渡してきます。
iOS に同じ仕組みが無いものは、最も近い挙動に読み替えています。

| モード | Android | iOS |
| --- | --- | --- |
| `IN_APP_OVERLAY` | 2 つ目の WebView を重ねる | 2 つ目の WKWebView を重ねる（`InAppBrowserViewController`） |
| `CUSTOM_TAB` | Custom Tabs（全画面） | `SFSafariViewController`（全画面） |
| `PARTIAL_CUSTOM_TAB` | Custom Tabs（ボトムシート） | `SFSafariViewController` をシート表示（`.medium()`） |
| `WARMED_CUSTOM_TAB` | `warmup()` + `mayLaunchUrl()` | `SFSafariViewController.prewarmConnections(to:)` |
| `APP_LINK` | `FLAG_ACTIVITY_REQUIRE_NON_BROWSER` | Universal Links（`universalLinksOnly`）、失敗時は Safari |
| `BROWSER_CHOOSER` | `Intent.createChooser()` | 共有シート（`UIActivityViewController`） |
| `NEW_DOCUMENT` | `FLAG_ACTIVITY_NEW_DOCUMENT` | 既定ブラウザを別アプリとして開く |
| `INTENT_URI` | `Intent.parseUri()` | 相当なし。`S.browser_fallback_url` だけを開く |
| `TRUSTED_WEB_ACTIVITY` | TWA | 相当なし。Safari で開く |

同一ホストの http(s) だけを WebView 内で読み込み、それ以外の http(s) は
`SFSafariViewController`、`tel:` や `mailto:` などは端末のアプリに渡します。

## 配色

`web/app/theme.ts` の色を `AppTheme.swift` の `WebPalette` に写し、
セーフエリアの余白と WebView の背景を同じ色にして継ぎ目なく見せています。

| 用途 | Light | Dark |
| --- | --- | --- |
| 背景 | `#F2F6F5` | `#0E1414` |
| サーフェス | `#FFFFFF` | `#161D1D` |
| プライマリ | `#00695F` | `#5FD4C0` |

配色の選択は WebView 側（MUI が localStorage に保存）が真実の源です。
ネイティブは `setAppTheme` で受け取って `UserDefaults` にミラーし、
次回起動時のちらつきを防ぎます。適用は SwiftUI の `preferredColorScheme` に一本化しています。

## アプリアイコン

Android 版の `ic_launcher_foreground.xml` と同じ意匠を `scripts/app-icon/icon.svg` に持たせ、
通常・ダーク・ティントの 1024x1024 PNG を生成します。意匠を変えたら SVG を編集して再実行してください。

```shell
./scripts/app-icon/generate.sh
```

生成には `rsvg-convert` が必要です（`brew install librsvg`）。
