import Foundation
import Testing
import UIKit
import WebKit

@testable import Webview_Interaction_Sample

/// 起動中のアプリのWebViewをテストから操作するための薄いドライバ。
///
/// テストバンドルはアプリ本体をホストにして動く（ビルド設定の`TEST_HOST`）ため、
/// 画面に出ている本物の``WebViewController``をそのまま掴める。
/// Web側の操作は指タップではなく`evaluateJavaScript`でDOMを直接叩く。
/// デモページは縦に長く、タップだと画面外のボタンまでスクロールが必要で不安定になるため
/// （Android版の`WebViewDriver`と同じ方針）。
///
/// ブリッジ・`WKNavigationDelegate`・トースト・`UserDefaults`は本物が動くので、
/// ブラウザ相手のPlaywrightでは確認できない往復をここで検証する。
@MainActor
struct WebViewDriver {
    let controller: WebViewController
    let webView: WKWebView

    /// 画面に出ているWebViewを掴む。アプリの起動直後はまだ無いため、現れるまで待つ。
    static func attach(timeout: Duration = .seconds(30)) async throws -> WebViewDriver {
        let deadline = ContinuousClock.now + timeout
        while ContinuousClock.now < deadline {
            if let controller = findWebViewController(),
               let webView = controller.view.firstDescendant(of: WKWebView.self) {
                return WebViewDriver(controller: controller, webView: webView)
            }
            try await Task.sleep(for: .milliseconds(200))
        }
        throw DriverError("アプリのWebViewが見つかりません（アプリがホストとして起動しているか確認してください）")
    }

    /// ページの読み込みとハイドレーションが終わるまで待つ。
    ///
    /// Reactのハイドレーションが終わるまでボタンは押せず、`window.handleReturnValue`も
    /// 用意されていないため、DOMだけでなくブリッジの受け口が揃うまで待つ。
    func waitUntilReady(timeout: Duration = .seconds(45)) async throws {
        try await waitUntil("デモページの準備", timeout: timeout) {
            try await self.eval(
                """
                document.readyState === 'complete'
                  && typeof window.AndroidInterface === 'object'
                  && typeof window.handleReturnValue === 'function'
                  && Array.from(document.querySelectorAll('button'))
                       .some(button => button.textContent.includes('Show Toast') && !button.disabled)
                """
            ) == "true"
        }
    }

    /// JSの式を評価して結果を文字列で返す。`null` / `undefined`は空文字になる。
    ///
    /// `evaluateJavaScript`は返せない型（undefinedなど）で例外を投げるため、必ず文字列に変換して返す。
    @discardableResult
    func eval(_ expression: String) async throws -> String {
        let script = "String(((() => (\(expression)))()) ?? '')"
        let result = try await webView.evaluateJavaScript(script)
        return result as? String ?? ""
    }

    /// 副作用だけを目的にJSを実行する。
    @discardableResult
    func run(_ statements: String) async throws -> String {
        try await eval("(() => { \(statements); return 'ok'; })()")
    }

    /// JSの条件式が成立するまで待つ。
    func awaitTrue(_ description: String, _ expression: String, timeout: Duration = .seconds(20)) async throws {
        try await waitUntil(description, timeout: timeout) {
            try await self.eval(expression) == "true"
        }
    }

    /// ネイティブ側の条件が成立するまで待つ。
    func waitUntil(
        _ description: String,
        timeout: Duration = .seconds(20),
        _ condition: () async throws -> Bool
    ) async throws {
        let deadline = ContinuousClock.now + timeout
        while ContinuousClock.now < deadline {
            // 読み込み中のページに評価を依頼すると実行コンテキストごと差し替わって失敗することがある。
            // 待っている途中の失敗は、まだ条件が揃っていないだけとして扱う。
            if (try? await condition()) == true { return }
            try await Task.sleep(for: .milliseconds(200))
        }
        throw DriverError("タイムアウトしました: \(description)")
    }

    /// 画面の様子をテスト結果に添付する。
    ///
    /// 添付したPNGは`.xcresult`に入り、`scripts/test-report.py`が取り出してレポートに並べる。
    /// 失敗したときに「何が出ていたのか」を後から見られるようにするため、
    /// 各テストの節目で呼ぶ（Android版の`ScreenshotRule`に相当）。
    func capture(_ name: String) {
        guard let image = Self.screenshot(), let png = image.pngData() else { return }
        Attachment.record(png, named: "\(name).png")
    }

    /// 表示中のウィンドウを1枚に重ねて描画する。
    /// トーストはアプリとは別のウィンドウに載るため、1つだけ描くと写らない。
    private static func screenshot() -> UIImage? {
        let visible = windows.filter { !$0.isHidden && $0.bounds.width > 0 }
        guard let bounds = visible.first?.bounds else { return nil }

        return UIGraphicsImageRenderer(bounds: bounds).image { _ in
            for window in visible {
                window.drawHierarchy(in: window.bounds, afterScreenUpdates: true)
            }
        }
    }

    /// 画面に出ているトーストの文言。出ていなければnil。
    ///
    /// トーストはアプリのウィンドウとは別の専用ウィンドウに載る（``Toast``）ため、
    /// WebViewを含まないウィンドウのラベルを読めば、デモ画面の文言と混ざらない。
    var visibleToastMessage: String? {
        for window in Self.windows where Self.findWebViewController(in: window) == nil {
            guard let root = window.rootViewController?.view else { continue }
            if let label = root.descendants(of: UILabel.self).first(where: \.isVisibleInHierarchy) {
                return label.text
            }
        }
        return nil
    }

    /// ネイティブのエラー画面が出ているか。
    var isShowingErrorScreen: Bool {
        controller.view.descendants(of: UILabel.self)
            .contains { $0.text == "ページを読み込めませんでした" && $0.isVisibleInHierarchy }
    }

    /// エラー画面の「再試行」を押す。
    func tapRetry() throws {
        let retry = controller.view.descendants(of: UIButton.self)
            .first { $0.configuration?.title == "再試行" || $0.currentTitle == "再試行" }
        guard let retry else { throw DriverError("再試行ボタンが見つかりません") }
        retry.sendActions(for: .touchUpInside)
    }

    // MARK: - 画面の探索

    private static var windows: [UIWindow] {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
    }

    private static func findWebViewController() -> WebViewController? {
        windows.lazy.compactMap(findWebViewController(in:)).first
    }

    private static func findWebViewController(in window: UIWindow) -> WebViewController? {
        window.rootViewController.flatMap(findWebViewController(in:))
    }

    private static func findWebViewController(in controller: UIViewController) -> WebViewController? {
        if let found = controller as? WebViewController { return found }
        for child in controller.children {
            if let found = findWebViewController(in: child) { return found }
        }
        return controller.presentedViewController.flatMap(findWebViewController(in:))
    }
}

struct DriverError: Error, CustomStringConvertible {
    let description: String
    init(_ description: String) { self.description = description }
}

extension UIView {
    /// 自分自身から祖先まで、いずれも隠されていないか。
    /// `isHidden`は親が隠れていても`false`のままのため、親をたどって確かめる。
    var isVisibleInHierarchy: Bool {
        sequence(first: self, next: \.superview).allSatisfy { !$0.isHidden && $0.alpha > 0.01 }
    }

    func descendants<T: UIView>(of type: T.Type) -> [T] {
        subviews.flatMap { subview -> [T] in
            let nested = subview.descendants(of: type)
            return (subview as? T).map { [$0] + nested } ?? nested
        }
    }

    func firstDescendant<T: UIView>(of type: T.Type) -> T? {
        descendants(of: type).first
    }
}
