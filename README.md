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

Development Teamはプロジェクト設定の`DEVELOPMENT_TEAM`（`3C654MC27L`）を使用します。
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

無料のPersonal Teamでは、Provisioning Profileの有効期限が7日になり、
他のTeamが登録済みのBundle IDは使用できません
（`Failed Registering Bundle Identifier`）。
`cn.gekal.ios.Webview-Interaction-Sample`はPersonal Teamでは登録できないため、
有料Teamのアカウントでビルドしてください。

## App Distribution

```shell
```
