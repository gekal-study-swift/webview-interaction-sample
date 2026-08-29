import Foundation
import Testing

@testable import Webview_Interaction_Sample

/// リンクの振り分けロジックのテスト。
///
/// `LinkPolicy`はUIKitに依存しないため、WebViewを起動せずに検証できる。
/// ここが壊れると、外部サイトがWebView内で開いて戻れなくなったり、
/// `tel:`がWebViewの読み込みエラーになったりする。
struct LinkPolicyTests {
    private let targetHost = "webview-interaction-sample.ios.demo.gekal.cn"

    @Test func resolve_loadsTheSameHostInTheWebView() {
        #expect(LinkPolicy.resolve(scheme: "https", host: targetHost, targetHost: targetHost) == .inWebView)
        #expect(LinkPolicy.resolve(scheme: "http", host: targetHost, targetHost: targetHost) == .inWebView)
        // ホスト名の大文字小文字は区別しない
        #expect(LinkPolicy.resolve(scheme: "HTTPS", host: targetHost.uppercased(), targetHost: targetHost) == .inWebView)
    }

    @Test func resolve_opensAnotherHostInTheSafariViewController() {
        #expect(LinkPolicy.resolve(scheme: "https", host: "example.com", targetHost: targetHost) == .safariViewController)
        // ホストが取れないhttp(s)もWebView内では開かない
        #expect(LinkPolicy.resolve(scheme: "https", host: nil, targetHost: targetHost) == .safariViewController)
        // 配信元が分からないときも、WebView内に閉じ込めない
        #expect(LinkPolicy.resolve(scheme: "https", host: targetHost, targetHost: nil) == .safariViewController)
    }

    @Test func resolve_handsNonWebSchemesToTheDeviceApps() {
        for scheme in ["tel", "mailto", "sms", "geo", "itms-apps"] {
            #expect(LinkPolicy.resolve(scheme: scheme, host: nil, targetHost: targetHost) == .externalApp)
        }
        #expect(LinkPolicy.resolve(scheme: nil, host: nil, targetHost: targetHost) == .externalApp)
    }

    @Test func isBrowsableURL_allowsOnlyHTTPAndHTTPS() {
        #expect(LinkPolicy.isBrowsableURL(scheme: "https"))
        #expect(LinkPolicy.isBrowsableURL(scheme: "HTTP"))
        // ブラウザ表示に渡すと危険なスキームを弾く
        #expect(!LinkPolicy.isBrowsableURL(scheme: "javascript"))
        #expect(!LinkPolicy.isBrowsableURL(scheme: "file"))
        #expect(!LinkPolicy.isBrowsableURL(scheme: nil))
    }

    @Test func isAllowed_acceptsIntentSchemeOnlyForTheIntentURIMode() {
        #expect(LinkPolicy.isAllowed(.intentURI, scheme: "intent"))
        #expect(!LinkPolicy.isAllowed(.intentURI, scheme: "https"))

        for mode in ExternalOpenMode.allCases where mode != .intentURI {
            #expect(LinkPolicy.isAllowed(mode, scheme: "https"))
            #expect(!LinkPolicy.isAllowed(mode, scheme: "intent"))
        }
    }

    @Test func appleMapsURL_convertsCoordinatesAndQuery() throws {
        let url = try #require(URL(string: "geo:35.681236,139.767125?q=%E6%9D%B1%E4%BA%AC%E9%A7%85"))
        let maps = try #require(LinkPolicy.appleMapsURL(fromGeoURI: url))

        let components = try #require(URLComponents(url: maps, resolvingAgainstBaseURL: false))
        #expect(components.scheme == "maps")
        #expect(components.queryItems?.first { $0.name == "ll" }?.value == "35.681236,139.767125")
        #expect(components.queryItems?.first { $0.name == "q" }?.value == "東京駅")
    }

    @Test func appleMapsURL_dropsThePlaceholderCoordinate() throws {
        // Androidは座標を持たない検索を geo:0,0?q=… と書く。そのまま渡すと大西洋上に飛ぶ
        let url = try #require(URL(string: "geo:0,0?q=Tokyo"))
        let maps = try #require(LinkPolicy.appleMapsURL(fromGeoURI: url))

        #expect(maps.absoluteString.contains("q=Tokyo"))
        #expect(!maps.absoluteString.contains("ll="))
    }

    @Test func appleMapsURL_returnsNilWhenThereIsNothingToShow() throws {
        // 座標も検索語も無ければマップに渡す意味がない
        #expect(LinkPolicy.appleMapsURL(fromGeoURI: try #require(URL(string: "geo:0,0"))) == nil)
        // geo:以外は対象外
        #expect(LinkPolicy.appleMapsURL(fromGeoURI: try #require(URL(string: "https://example.com"))) == nil)
    }

    @Test func browserFallbackURL_extractsTheFallbackFromAnIntentURI() throws {
        let uri = "intent://developer.android.com/#Intent;scheme=https;"
            + "S.browser_fallback_url=https%3A%2F%2Fdeveloper.android.com%2F;end"

        #expect(LinkPolicy.browserFallbackURL(fromIntentURI: uri)?.absoluteString == "https://developer.android.com/")
    }

    @Test func browserFallbackURL_returnsNilWhenItCannotBeOpenedSafely() {
        // フォールバック先が無い
        #expect(LinkPolicy.browserFallbackURL(fromIntentURI: "intent://example.com/#Intent;scheme=https;end") == nil)
        // http(s)以外のフォールバックは開かない
        let dangerous = "intent://x/#Intent;S.browser_fallback_url=javascript%3Aalert(1);end"
        #expect(LinkPolicy.browserFallbackURL(fromIntentURI: dangerous) == nil)
    }

    @Test func externalOpenMode_fallsBackToTheSafestMode() {
        #expect(ExternalOpenMode.from("IN_APP_OVERLAY") == .inAppOverlay)
        #expect(ExternalOpenMode.from("trusted_web_activity") == .trustedWebActivity)
        // Web側が新しいモードを送ってきても、開けない・危険な挙動にはしない
        #expect(ExternalOpenMode.from("SOMETHING_NEW") == .customTab)
        #expect(ExternalOpenMode.from(nil) == .customTab)
    }
}
