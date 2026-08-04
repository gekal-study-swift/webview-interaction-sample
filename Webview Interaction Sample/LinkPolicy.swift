import Foundation

/// リンクをどこで開くか。
enum Navigation {
    /// WebView内でそのまま読み込む。
    case inWebView

    /// SFSafariViewController（アプリ内ブラウザ）でアプリの上に重ねて開く。
    /// URLバーが出るので外部サイトだと分かり、閉じれば元の画面に戻れる。
    case safariViewController

    /// 端末のアプリ（電話・メール・地図など）に渡す。
    case externalApp
}

/// 外部サイトの開き方。WebView側から明示的に指定できるようにしている。
///
/// 名前はAndroid版の`ExternalOpenMode`と揃えてあり、Webページは同じ文字列を渡してくる。
/// iOSに同じ仕組みが無いものは、最も近い挙動に読み替える（詳細は`ExternalLinkOpener`）。
enum ExternalOpenMode: String, CaseIterable {
    /// アプリ内オーバーレイ（2つ目のWKWebView）。ブラウザに依存せず見た目が一定。
    case inAppOverlay = "IN_APP_OVERLAY"

    /// SFSafariViewController（全画面）。Safariが描画するため、実サービスのログインでも使える。
    case customTab = "CUSTOM_TAB"

    /// SFSafariViewControllerをシート状に部分表示する。下にアプリが見えたまま重なる。
    case partialCustomTab = "PARTIAL_CUSTOM_TAB"

    /// 事前にコネクションを張ってから開く。表示が速くなる。
    case warmedCustomTab = "WARMED_CUSTOM_TAB"

    /// 対応アプリがあればそちらで開き、無ければSFSafariViewControllerに落とす（Universal Links）。
    case appLink = "APP_LINK"

    /// 既定のブラウザに直行させず、ユーザーにアプリを選ばせる。
    case browserChooser = "BROWSER_CHOOSER"

    /// 別アプリとして開く。Appスイッチャーに別項目として並ぶ。
    case newDocument = "NEW_DOCUMENT"

    /// Androidの`intent://`。iOSに相当する仕組みは無い。
    case intentURI = "INTENT_URI"

    /// AndroidのTrusted Web Activity。iOSに相当する仕組みは無い。
    case trustedWebActivity = "TRUSTED_WEB_ACTIVITY"

    /// WebViewから渡される文字列を変換する。未知の値は最も無難な``customTab``にする。
    static func from(_ value: String?) -> ExternalOpenMode {
        guard let value else { return .customTab }
        return ExternalOpenMode(rawValue: value.uppercased()) ?? .customTab
    }
}

/// リンクの遷移先を決めるロジック。
///
/// UIKitに依存しないため、シミュレータや実機なしのユニットテストで検証できる。
enum LinkPolicy {
    private static let webSchemes: Set<String> = ["http", "https"]

    /// - Parameters:
    ///   - scheme: リンクのスキーム
    ///   - host: リンクのホスト
    ///   - targetHost: 配信元のホスト
    ///
    /// 配信元と同じホストのhttp(s)だけWebView内で読み込む。
    /// 外部サイトをWebView内で開くと、URLが見えないまま別サイトを表示することになり、
    /// 戻る手段もない。SFSafariViewControllerならURLバーで接続先が分かり、閉じれば元の画面に戻れる。
    static func resolve(scheme: String?, host: String?, targetHost: String?) -> Navigation {
        guard let scheme = scheme?.lowercased(), webSchemes.contains(scheme) else {
            return .externalApp
        }
        guard let targetHost, host?.lowercased() == targetHost.lowercased() else {
            return .safariViewController
        }
        return .inWebView
    }

    /// WebViewから渡されたURLをブラウザ表示に使ってよいか。
    /// `javascript:`や`file:`などを開かせないよう、http(s)だけを許可する。
    static func isBrowsableURL(scheme: String?) -> Bool {
        guard let scheme = scheme?.lowercased() else { return false }
        return webSchemes.contains(scheme)
    }

    /// 開き方ごとに許可するスキーム。
    /// ``ExternalOpenMode/intentURI``だけは`intent:`を受け取る必要がある。
    static func isAllowed(_ mode: ExternalOpenMode, scheme: String?) -> Bool {
        if mode == .intentURI {
            return scheme?.lowercased() == "intent"
        }
        return isBrowsableURL(scheme: scheme)
    }

    /// `intent://…;S.browser_fallback_url=…;end`からフォールバック先を取り出す。
    ///
    /// iOSに`intent://`を解釈する仕組みは無いため、Androidが対応アプリを見つけられなかったときと
    /// 同じようにフォールバック先だけを開く。
    static func browserFallbackURL(fromIntentURI uri: String) -> URL? {
        for field in uri.split(separator: ";") {
            guard field.hasPrefix("S.browser_fallback_url=") else { continue }
            let encoded = field.dropFirst("S.browser_fallback_url=".count)
            guard let decoded = encoded.removingPercentEncoding, let url = URL(string: decoded) else { return nil }
            return isBrowsableURL(scheme: url.scheme) ? url : nil
        }
        return nil
    }
}
