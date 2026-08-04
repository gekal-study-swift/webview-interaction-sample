# Webview 交互サンプル

Android 版と同じ Web ページおよび JavaScript Bridge API を WKWebView で動かす iOS サンプルです。

## WebView URL

<https://webview-interaction-sample.ios.demo.gekal.cn/index.html?env=debug>

## 対応機能

- JavaScript / Native の双方向通信
- Toast、端末・バッテリー情報、触覚フィードバック
- クリップボード、共有シート、遅延コールバック
- Web / Native テーマ同期
- リロード、読込エラー表示、再試行
- 同一ホスト内遷移と外部リンクの安全な振り分け

## 外部リンクの開き方

Webページは Android 版と同じモード名（`ExternalOpenMode`）を渡してきます。
iOS に同じ仕組みが無いものは、最も近い挙動に読み替えています。

| モード | Android | iOS |
| --- | --- | --- |
| `IN_APP_OVERLAY` | 2つ目の WebView を重ねる | 2つ目の WKWebView を重ねる（`InAppBrowserViewController`） |
| `CUSTOM_TAB` | Custom Tabs（全画面） | `SFSafariViewController`（全画面） |
| `PARTIAL_CUSTOM_TAB` | Custom Tabs（ボトムシート） | `SFSafariViewController` をシート表示（`.medium()`） |
| `WARMED_CUSTOM_TAB` | `warmup()` + `mayLaunchUrl()` | `SFSafariViewController.prewarmConnections(to:)` |
| `APP_LINK` | `FLAG_ACTIVITY_REQUIRE_NON_BROWSER` | Universal Links（`universalLinksOnly`）、失敗時は Safari |
| `BROWSER_CHOOSER` | `Intent.createChooser()` | 共有シート（`UIActivityViewController`） |
| `NEW_DOCUMENT` | `FLAG_ACTIVITY_NEW_DOCUMENT` | 既定ブラウザを別アプリとして開く |
| `INTENT_URI` | `Intent.parseUri()` | 相当なし。`S.browser_fallback_url` だけを開く |
| `TRUSTED_WEB_ACTIVITY` | TWA | 相当なし。Safari で開く |

判定ロジックは `LinkPolicy.swift`、起動は `ExternalLinkOpener.swift` にあります。

## Web画面

Android版と同じNext.js + MUIの実装を `/web` に配置しています。

```shell
cd web
pnpm install --frozen-lockfile
pnpm dev
```

静的サイトを生成する場合:

```shell
cd web
pnpm build
```

成果物は `web/out` に生成されます。`web/public/CNAME`に設定した
`webview-interaction-sample.ios.demo.gekal.cn`のルートから配信します。

`main`へのpush時はGitHub Actionsがビルドし、GitHub Pagesへデプロイします。
Pull Requestではビルドまでを実行し、デプロイは行いません。

## 署名

接続中のiPhoneを確認し、実機向けにビルド・インストール・起動します。

```shell
xcrun devicectl list devices
./scripts/build-and-install.sh
```

iOS端末が1台なら自動で選択し、複数接続されている場合は番号付きの一覧から選択できます。
自動実行では`--device <UDIDまたは端末名>`または`IOS_DEVICE`で明示指定できます。

Development Teamはプロジェクト設定の`DEVELOPMENT_TEAM`（`N8RU3D7VY6`）を使用します。
未設定の場合はコード署名証明書から検出し、複数ある場合は一覧から選択します。
CIなどの非対話実行や別のTeamでビルドする場合はTeam IDを指定します。

```shell
./scripts/build-and-install.sh --device <UDIDまたは端末名> --team <TEAM_ID>
```

`--configuration Release`でReleaseビルド、`--no-launch`でインストールのみを実行できます。

### 事前準備

自動署名にはTeamのApple IDがXcodeにサインインされている必要があります。
Xcode > Settings > Accountsで追加してください。サインインしていないTeamを指定すると
`No Account for Team "<TEAM_ID>"`でビルドが失敗します。

初回インストール後は、端末で開発者証明書を信頼するまでアプリを起動できません。
設定 > 一般 > VPNとデバイス管理 > デベロッパApp から開発元を信頼してください。

現在のBundle ID `cn.gekal.ios.WebviewInteractionSample`は無料のPersonal Team
`N8RU3D7VY6`で登録しています。Personal TeamはProvisioning Profileの有効期限が7日のため、
期限切れの際は再度ビルドし直してください。

有料Team（`3C654MC27L`）に切り替える場合は、そのApple IDをXcodeにサインインしたうえで
Team IDを指定します。Bundle IDはTeam間で共有できないため、変更が必要になる場合があります。

```shell
./scripts/build-and-install.sh --team 3C654MC27L
```

## App Distribution

```shell
```
