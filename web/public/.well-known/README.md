# Digital Asset Links

`assetlinks.json` は Trusted Web Activity（`TRUSTED_WEB_ACTIVITY` モード）で URL バーを隠すために、
このサイトとアプリが同一の持ち主であることを Chrome に示すファイルです。
オリジン直下 (`/.well-known/assetlinks.json`) に置く必要があります。

`sha256_cert_fingerprints` は署名証明書のものです。

| 用途 | 取得元 |
| --- | --- |
| リリースビルド | `app/debug.jks`（alias: `samle-sign-alias`） |
| デバッグビルド | 開発機の `~/.android/debug.keystore` |

デバッグ用は**この開発機の鍵**なので、別の環境でビルドしたデバッグ APK では検証が通りません。
その場合は自分の環境の値を追加してください。

```bash
keytool -list -v -keystore app/debug.jks -alias samle-sign-alias -storepass 123456 | grep SHA256:
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android | grep SHA256:
```

アプリ側の宣言は `app/src/main/res/values/strings.xml` の `asset_statements` と
`AndroidManifest.xml` の `<meta-data android:name="asset_statements">` です。
