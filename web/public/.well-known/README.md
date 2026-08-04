# Universal Links

`apple-app-site-association`（AASA）は、このサイトとアプリが同一の持ち主であることを iOS に示すファイルです。
Android の `assetlinks.json`（Digital Asset Links）に相当します。

これがあると、他のアプリからこのサイトのリンクを開いたときに Safari ではなくアプリが起動します。
アプリ側の `APP_LINK` モード（`UIApplication.open(_:options:[.universalLinksOnly: true])`）も、
検証が通っている場合だけアプリを開き、通らなければ `SFSafariViewController` に落ちます。

## 配置と形式

- 置き場所はオリジン直下の `/.well-known/apple-app-site-association`（**拡張子は付けない**）
- HTTPS でリダイレクトなしに配信すること
- `appIDs` は `<Team ID>.<Bundle ID>`

| 項目 | 値 |
| --- | --- |
| Team ID | `3C654MC27L` |
| Bundle ID | `cn.gekal.ios.WebviewInteractionSample` |

## アプリ側の宣言

`Webview Interaction Sample/Webview Interaction Sample.entitlements` の
`com.apple.developer.associated-domains` に `applinks:` で対象ドメインを書きます。
サイト側とアプリ側が対になって初めて検証が通ります。

**Associated Domains は有料の Apple Developer Program が必要**で、無料の Personal Team では使えません。
Personal Team で指定すると、Provisioning Profile を作れずビルドが失敗します。

```
Cannot create a iOS App Development provisioning profile for "cn.gekal.ios.WebviewInteractionSample".
Personal development teams do not support the Associated Domains capability.
```

そのため既定ではエンタイトルメントをビルドに紐づけていません。
有料 Team（`3C654MC27L`）でビルドできる状態にしたうえで、
Xcode のターゲット設定 > Signing & Capabilities で Associated Domains を追加するか、
`project.pbxproj` のアプリターゲットの Debug / Release 両方に次の 1 行を入れると有効になります。

```
CODE_SIGN_ENTITLEMENTS = "Webview Interaction Sample/Webview Interaction Sample.entitlements";
```

## 検証

配信後、Apple の CDN が取得できているかを確認できます。

```shell
curl -sI https://webview-interaction-sample.ios.demo.gekal.cn/.well-known/apple-app-site-association
```

```shell
curl -s "https://app-site-association.cdn-apple.com/a/v1/webview-interaction-sample.ios.demo.gekal.cn"
```

CDN のキャッシュが更新されるまで時間がかかります。開発中は端末の
設定 > デベロッパ > Associated Domains Development を有効にすると、CDN を経由せず直接取得させられます。

## Android 版との違い

| | Android | iOS |
| --- | --- | --- |
| ファイル | `/.well-known/assetlinks.json` | `/.well-known/apple-app-site-association` |
| アプリの識別 | パッケージ名 + 署名証明書の SHA-256 | Team ID + Bundle ID |
| アプリ側の宣言 | `AndroidManifest.xml` の `asset_statements` / intent-filter | Associated Domains エンタイトルメント |
| 主な用途 | App Links、Trusted Web Activity | Universal Links |

iOS に Trusted Web Activity（URL バーを隠して全画面表示する仕組み）に相当するものはありません。
