import Foundation

/// WebViewの読み込み状態。
enum LoadState: Equatable {
    case loading
    case loaded

    /// メインフレームの読み込みに失敗した状態。`detail`は原因の概要。
    case error(detail: String)
}

/// `WKNavigationDelegate`のコールバックから次の``LoadState``を決めるロジック。
///
/// UIKitに依存しないため、シミュレータや実機なしのユニットテストで検証できる。
/// `WebViewController`側はこの結果をそのまま表示に反映するだけにしている。
enum LoadStateReducer {
    /// エラー時にWebViewを空にするためのURL。状態遷移の対象にしない。
    static let blankURL = URL(string: "about:blank")!

    /// 読み込みの開始（初回 / 再試行 / 再読み込み）。
    static func onLoadRequested() -> LoadState { .loading }

    static func onPageStarted(_ current: LoadState, url: URL?) -> LoadState {
        url == blankURL ? current : .loading
    }

    static func onPageFinished(_ current: LoadState, url: URL?) -> LoadState {
        url != blankURL && current == .loading ? .loaded : current
    }

    /// 読み込みエラー。
    ///
    /// 遷移をキャンセルしたときの通知（外部リンクをSafariに渡した場合など）は失敗ではないため、
    /// エラー画面を出さずに現在の状態を保つ。
    static func onNavigationFailed(_ current: LoadState, error: Error) -> LoadState {
        isCancellation(error) ? current : .error(detail: resourceErrorDetail(error))
    }

    /// HTTPエラー。サブフレーム（画像やiframeなど）の失敗でエラー画面を出さないよう、
    /// メインフレームのときだけ``LoadState/error(detail:)``に遷移する。
    static func onHTTPError(_ current: LoadState, isForMainFrame: Bool, statusCode: Int) -> LoadState {
        isForMainFrame ? .error(detail: httpErrorDetail(statusCode: statusCode)) : current
    }

    /// キャンセル系のエラーか。
    ///
    /// - `NSURLErrorCancelled`: `decidePolicyFor`で`.cancel`を返したときなど
    /// - `WebKitErrorFrameLoadInterruptedByPolicyChange` (102): レスポンス側で遷移を止めたとき
    static func isCancellation(_ error: Error) -> Bool {
        let error = error as NSError
        if error.domain == NSURLErrorDomain, error.code == NSURLErrorCancelled { return true }
        return error.domain == "WebKitErrorDomain" && error.code == 102
    }

    static func resourceErrorDetail(_ error: Error) -> String {
        let error = error as NSError
        return "\(error.localizedDescription) (code: \(error.code))"
    }

    static func httpErrorDetail(statusCode: Int) -> String {
        let reason = HTTPURLResponse.localizedString(forStatusCode: statusCode)
        return "HTTP \(statusCode) \(reason)".trimmingCharacters(in: .whitespaces)
    }
}
