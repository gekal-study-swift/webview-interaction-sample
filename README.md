# WebView Interaction Sample (iOS)

Android 版と同じ Web ページと JavaScript Bridge API を、WKWebView で動かす iOS サンプルです。
同じ Web ページを両 OS で動かし、ネイティブ側の作りの違いを見比べられるようにしています。

WebView URL は構成ごとに分けています（Android 版の `configs/debug.json` / `configs/release.json` に相当）。

| 構成 | URL |
| --- | --- |
| Debug | `https://webview-interaction-sample.ios.demo.gekal.cn/index.html?env=debug&vconsole=1` |
| Release | `https://webview-interaction-sample.ios.demo.gekal.cn/index.html?env=release` |

`vconsole=1` は端末上でログとネットワーク通信を見るための vConsole を有効にするクエリです。
ビルド時フラグ `NEXT_PUBLIC_VCONSOLE`（GitHub のリポジトリ変数）でも有効にできますが、
そちらは公開サイト全体に効くため、開発ビルドからは URL で上書きしています。

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
| `Webview Interaction SampleTests/` | ロジックのユニットテストと、アプリ込みのブリッジのテスト |
| `web/` | WebView に表示する Next.js + MUI のページ（Android 版と同じ実装） |
| `e2e/` | Playwright を使用したエンドツーエンドテスト（ブラウザ上でブリッジをモック） |
| `scripts/build-and-install.sh` | 実機向けのビルド・インストール・起動 |
| `scripts/test.sh` | テストの実行（`e2e` / `unit` / `app` / `all`） |
| `scripts/test-report.py` | テスト結果とキャプチャを 1 枚の HTML にまとめる |
| `scripts/app-icon/` | アプリアイコンのベクタ原本と生成スクリプト |
| `.github/workflows/pages.yml` | `web/` をビルドして GitHub Pages へデプロイ |
| `.github/workflows/playwright.yml` | `e2e/` の Playwright テストを実行 |

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

## ブリッジ API

Web ページは `window.AndroidInterface` を呼び出します（型定義は `web/types/android.d.ts`）。
iOS でも同じ名前・同じ引数で公開していますが、次の 4 点は仕組みが違うため作りが異なります。

**戻り値** — Android の `@JavascriptInterface` は値を同期で返せますが、
`postMessage()` は返せません（呼び出しは常に Promise を返す）。
そのため値を返す `getDeviceInfo` / `getBatteryStatus` は JS 側に値を持たせ、
それ以外は戻り値を捨てて Android と同じ「値を返さない呼び出し」に揃えています。

**バッテリー** — Android は呼ばれるたびに `BatteryManager` を読めますが、iOS は同期的に問い合わせられません。
`UIDevice` の変化通知を受けてネイティブから JS 側の値を先に更新しています。

**端末情報** — `androidVersion` / `sdkInt` / `packageName` の代わりに
`systemName` / `systemVersion` / `bundleIdentifier` を返します。`sdkInt` に相当するものは無いため含めません。
`model` は `UIDevice.model`（"iPhone" としか返さない）ではなく機種識別子（`iPhone18,1`）です。

**バイブレーション** — iOS に時間を指定して振動させる仕組みは無いため、
Web から渡されるミリ秒を触覚フィードバックの強さ（`light` / `medium` / `heavy`）に読み替えています。

トーストは iOS に無いため、`Toast.swift` で見た目と表示時間（`LENGTH_SHORT` / `LENGTH_LONG`）だけ合わせています。
`UIAlertController` と違い操作を妨げず、モーダルの上にも出せるよう専用のウィンドウに載せています。

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
pnpm --dir web install --frozen-lockfile
pnpm --dir web dev
```

静的サイトを生成する場合は次のとおりです。成果物は `web/out` に出力されます。

```shell
pnpm --dir web build
```

`web/public/CNAME` に設定した `webview-interaction-sample.ios.demo.gekal.cn` のルートから配信します。
`main` への push 時に GitHub Actions がビルドして GitHub Pages へデプロイします。
Pull Request ではビルドまでを実行し、デプロイは行いません。

## テスト

`scripts/test.sh` から実行します。三段構えで、ブリッジの両側を分担して見ています。

| スコープ | 対象 | 実行環境 | ブリッジの扱い |
| --- | --- | --- | --- |
| `e2e` | Web 側のロジック | ブラウザ（CI で自動実行） | `window.AndroidInterface` をモック |
| `unit` | UIKit に依存しない Swift のロジック | シミュレータ | 使わない |
| `app` | アプリ込みのブリッジの往復 | シミュレータ（アプリを起動） | 本物 |

```shell
./scripts/test.sh              # E2E（既定）
./scripts/test.sh e2e --project chromium
./scripts/test.sh unit         # ロジックのユニットテスト
./scripts/test.sh app          # アプリ込みのブリッジのテスト
./scripts/test.sh all          # unit + app + e2e
./scripts/test.sh all --open   # 終わったらレポートを開く
```

依存関係と Playwright のブラウザはスクリプトが必要に応じて取得します。
`--` の後ろに書いた引数は Playwright にそのまま渡ります（`./scripts/test.sh e2e -- -g "外部リンク"`）。

### レポート

実行が終わると、結果とキャプチャを 1 枚にまとめたレポートを生成します（失敗したときも生成します）。

```
.build/reports/index.html
```

| 載るもの | 元データ |
| --- | --- |
| スコープごとの成否・件数・実行時間・実行環境 | `.build/reports/{unit,app}.xcresult` と `e2e/test-results/results.json` |
| 失敗の詳細 | 同上 |
| **1 件ごとの結果**（スイート別、結果と所要時間） | 同上 |
| アプリ込みのテストのキャプチャ | `.xcresult` の添付（`WebViewDriver.capture()`） |
| E2E のキャプチャ | `e2e/test-results/screenshots/` と失敗時の自動キャプチャ |

1 件ごとの一覧はスコープごとに畳んであり、**失敗したスコープだけ開いた状態**で出ます。
キャプチャはそのテストの行の下に並ぶので、どのテストの画面かを追えます。
E2E は同じテストのブラウザ違いが隣り合うように並べています。

テストを流し直さずに作り直すこともできます。

```shell
./scripts/test-report.py         # 直近の結果から再生成
./scripts/test-report.py --open  # 生成してブラウザで開く
```

1 件ごとの実行内容やトレースは Playwright 自身のレポートが詳しいので、そちらは残したまま参照しています。

```shell
pnpm --dir e2e exec playwright show-report
```

### E2E（`e2e/`、Playwright）

配信中の Web ページをブラウザで開き、`window.AndroidInterface` をモックして
Web 側のロジックを検証します（Android 版の `e2e/` と同じ構成）。
検証するのは**画面の表示とネイティブに渡す引数**までで、
受け取ったあとのネイティブの挙動は `app` スコープが担当します。

対象の URL は `e2e/.env` の `WEBVIEW_URL` で指定します（既定は公開中の Debug URL）。
`--url` で上書きできるため、`pnpm --dir web dev` で動かしたローカルのページも対象にできます。
`main` への push と Pull Request で GitHub Actions が実行します。

| 観点 | 内容 |
| --- | --- |
| ブリッジの往復 | `showToast()` → `handleReturnValue()`、イベントログとコンソールへの出力 |
| 端末情報 | `getDeviceInfo()` / `getBatteryStatus()` の同期呼び出しと、`__updateBatteryStatus()` での更新 |
| 非同期コールバック | `requestNativeCallback()` → `onNativeEvent()` |
| リンク | `tel:` / `mailto:` / `sms:` / `geo:` の href |
| 外部リンク | 9 つのモードで `openExternalLink()` に渡る URL とモード名、`window.open()` の扱い |
| アプリ内表示の判定 | `twa.html` が UA とブリッジの有無から表示のされ方を判定すること |
| ページの読み込み | `reloadPage()` / `simulateLoadError()` |
| 配色 | 初回マウントと切り替え時の `setAppTheme()` |
| vConsole | `?vconsole=1` / `0` とビルド時フラグの合成結果 |

アプリ内表示の判定は UA の `Safari/` の有無で分かれるため、
実行するブラウザに左右されないよう、テスト側で iOS の UA を指定しています。

### ユニット（`Webview Interaction SampleTests/`）

判定・変換のロジックだけを `enum` に切り出してあるため、WebView を起動せずに検証できます。

| ファイル | 内容 |
| --- | --- |
| `LinkPolicyTests.swift` | 同一ホストか外部か、`geo:` → マップ URL の変換、`intent://` のフォールバック抽出、未知のモードの既定 |
| `LoadStateTests.swift` | 読み込み状態の遷移（`about:blank` の除外、キャンセルとエラーの区別、サブフレームの HTTP エラー） |
| `AppThemeTests.swift` | 配色文字列の解釈と `UserDefaults` への保存 |

### アプリ込み（`WebViewBridgeTests.swift`）

テストバンドルはアプリをホストにして動く（ビルド設定の `TEST_HOST`）ため、
画面に出ている**本物の `WebViewController` を掴んで `evaluateJavaScript` で DOM を叩けます**。
Web 側の操作をタップではなく JS で行うのは、デモページが縦に長くタップだと不安定になるためで、
Android 版の `WebViewDriver` と同じ方針です（`WebViewDriver.swift`）。

Playwright はブリッジをモックするため、ここでしか確かめられないものを担当します。

| 観点 | 内容 |
| --- | --- |
| ブリッジの注入 | `web/types/android.d.ts` が宣言する 11 メソッドが実際に生えていること |
| `showToast()` | ネイティブがトーストを出し、`handleReturnValue('Hello from iOS!')` で呼び返すこと |
| `getDeviceInfo()` | 実行中のアプリの Bundle ID・OS 名・OS バージョンが返ること |
| `getBatteryStatus()` | 同期で返せるよう `__updateBatteryStatus()` が用意されていること |
| `requestNativeCallback()` | 指定した遅延のあと `onNativeEvent()` で応答が返ること |
| `setAppTheme()` | 受け取った配色が `UserDefaults` にミラーされること |
| `reloadPage()` | JS の実行コンテキストごと再読み込みされること |
| `simulateLoadError()` | ネイティブのエラー画面が出て、「再試行」で元のページに戻れること |

配信中のページを読み込むためネットワーク接続が必要です。
1 つの WebView を共有するので、テストは `.serialized` で直列に実行しています。
バッテリー残量はシミュレータでは `-1` になるため、実機でのみ 0〜100 を返します。

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

`geo:` は Android の地図アプリ向けのスキームで iOS に対応アプリが無いため、
`maps://?ll=<緯度,経度>&q=<検索語>` に読み替えてマップアプリに渡します
（`LinkPolicy.appleMapsURL(fromGeoURI:)`）。

### Universal Links

Android の `assetlinks.json`（Digital Asset Links）に相当するのが Universal Links です。
サイト側に `web/public/.well-known/apple-app-site-association`、
アプリ側に Associated Domains エンタイトルメントを置き、両方そろって初めて検証が通ります。
検証が通ると、他のアプリからこのサイトのリンクを開いたときに Safari ではなくアプリが起動し、
`ContentView` の `onContinueUserActivity` が受け取って WebView に読み込みます。
`APP_LINK` モードもこの検証結果を使います。

**Associated Domains は有料の Apple Developer Program が必要**で、無料の Personal Team では使えません。
そのため既定ではエンタイトルメントをビルドに紐づけていません。
有効にする手順は [`web/public/.well-known/README.md`](web/public/.well-known/README.md) にあります。

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
