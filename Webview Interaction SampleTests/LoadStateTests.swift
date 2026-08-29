import Foundation
import Testing
import WebKit

@testable import Webview_Interaction_Sample

/// 読み込み状態の遷移ロジックのテスト。
///
/// `WKNavigationDelegate`のコールバックは順番も回数も一定しないため、
/// 状態の決定だけを`LoadStateReducer`に切り出してある。
/// ここが壊れると、読み込めているのにエラー画面が出たり、その逆になったりする。
struct LoadStateTests {
    private let page = URL(string: "https://webview-interaction-sample.ios.demo.gekal.cn/index.html")!
    private let blank = LoadStateReducer.blankURL

    @Test func onPageStarted_ignoresTheBlankPage() {
        // エラー画面を出すときに読み込むabout:blankで、状態を巻き戻さない
        #expect(LoadStateReducer.onPageStarted(.error(detail: "失敗"), url: blank) == .error(detail: "失敗"))
        #expect(LoadStateReducer.onPageStarted(.loaded, url: page) == .loading)
    }

    @Test func onPageFinished_completesOnlyWhileLoading() {
        #expect(LoadStateReducer.onPageFinished(.loading, url: page) == .loaded)
        // about:blankの読み込み完了で、エラー画面を消してしまわない
        #expect(LoadStateReducer.onPageFinished(.error(detail: "失敗"), url: blank) == .error(detail: "失敗"))
        #expect(LoadStateReducer.onPageFinished(.loaded, url: page) == .loaded)
    }

    @Test func onNavigationFailed_keepsTheStateForCancellations() {
        // 外部リンクをSafariに渡すと.cancelを返すため、失敗として通知される
        let cancelled = NSError(domain: NSURLErrorDomain, code: NSURLErrorCancelled)
        #expect(LoadStateReducer.onNavigationFailed(.loaded, error: cancelled) == .loaded)

        // レスポンス側で遷移を止めたときのWebKitのエラー
        let policyChange = NSError(domain: "WebKitErrorDomain", code: 102)
        #expect(LoadStateReducer.onNavigationFailed(.loaded, error: policyChange) == .loaded)
    }

    @Test func onNavigationFailed_showsTheErrorScreenForRealFailures() {
        let offline = NSError(domain: NSURLErrorDomain, code: NSURLErrorNotConnectedToInternet)

        guard case .error(let detail) = LoadStateReducer.onNavigationFailed(.loading, error: offline) else {
            Issue.record("エラー状態になっていません")
            return
        }
        #expect(detail.contains("\(NSURLErrorNotConnectedToInternet)"))
    }

    @Test func onHTTPError_ignoresSubframes() {
        // 画像やiframeの404でデモ画面全体を隠さない
        #expect(LoadStateReducer.onHTTPError(.loaded, isForMainFrame: false, statusCode: 404) == .loaded)

        // 説明文は端末の言語で変わるため、状態とステータスコードだけを見る
        guard case .error(let detail) = LoadStateReducer.onHTTPError(.loading, isForMainFrame: true, statusCode: 404) else {
            Issue.record("エラー状態になっていません")
            return
        }
        #expect(detail.hasPrefix("HTTP 404"))
    }

    @Test func isCancellation_distinguishesCancellationsFromFailures() {
        #expect(LoadStateReducer.isCancellation(NSError(domain: NSURLErrorDomain, code: NSURLErrorCancelled)))
        #expect(LoadStateReducer.isCancellation(NSError(domain: "WebKitErrorDomain", code: 102)))
        #expect(!LoadStateReducer.isCancellation(NSError(domain: NSURLErrorDomain, code: NSURLErrorTimedOut)))
        // 同じコードでもドメインが違えばキャンセルではない
        #expect(!LoadStateReducer.isCancellation(NSError(domain: NSURLErrorDomain, code: 102)))
    }

    @Test func errorDetail_tellsWhatWentWrong() {
        let error = NSError(domain: NSURLErrorDomain, code: NSURLErrorCannotFindHost)
        #expect(LoadStateReducer.resourceErrorDetail(error).contains("code: \(NSURLErrorCannotFindHost)"))
        #expect(LoadStateReducer.httpErrorDetail(statusCode: 503).hasPrefix("HTTP 503"))
    }
}
