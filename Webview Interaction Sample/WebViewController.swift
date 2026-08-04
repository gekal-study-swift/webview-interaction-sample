import SafariServices
import SwiftUI
import UIKit
import WebKit

final class WebViewController: UIViewController {
    private static let targetURL = URL(string: "https://webview-interaction-sample.ios.demo.gekal.cn/index.html?env=debug")!
    private static let unreachableURL = URL(string: "https://unreachable.invalid/")!

    /// 配信元のホスト。これ以外のhttp(s)はアプリ内ブラウザで開く
    private static let targetHost = targetURL.host

    /// WebViewで選ばれた配色をSwiftUI側に伝える。
    /// 配色の適用はSwiftUIのpreferredColorSchemeに一本化している（ContentViewを参照）
    var onAppThemeChanged: ((AppTheme) -> Void)?

    private var webView: WKWebView!
    private let loadingIndicator = UIActivityIndicatorView(style: .large)
    private let errorView = UIStackView()
    private let errorDetailLabel = UILabel()
    private var callbackTasks: [String: DispatchWorkItem] = [:]

    /// アプリ自身が読み込ませたURL。
    ///
    /// Androidの`loadUrl()`は`shouldOverrideUrlLoading`を通らないが、iOSは`decidePolicyFor`に来る。
    /// これが無いと、エラー再現用の到達できないURLまで「外部リンク」と判定されてしまう。
    private var appRequestedURL: URL?

    private var state: LoadState = .loading {
        didSet {
            guard state != oldValue else { return }
            render()
        }
    }

    private var safariStyle: SafariStyle {
        SafariStyle(barTintColor: WebPalette.surface, controlTintColor: WebPalette.primary)
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        configureView()
        configureWebView()
        load(Self.targetURL)
    }

    deinit {
        callbackTasks.values.forEach { $0.cancel() }
        webView?.configuration.userContentController.removeScriptMessageHandler(forName: "nativeBridge")
    }

    private func configureView() {
        // セーフエリアの余白をWebコンテンツと同じ色にして、継ぎ目なく見せる
        view.backgroundColor = WebPalette.background

        loadingIndicator.translatesAutoresizingMaskIntoConstraints = false
        loadingIndicator.hidesWhenStopped = true
        view.addSubview(loadingIndicator)

        let title = UILabel()
        title.text = "ページを読み込めませんでした"
        title.textColor = .systemRed
        title.font = .preferredFont(forTextStyle: .headline)
        title.textAlignment = .center

        let message = UILabel()
        message.text = "通信状況を確認してから再試行してください。"
        message.textAlignment = .center
        message.numberOfLines = 0

        errorDetailLabel.font = .preferredFont(forTextStyle: .caption1)
        errorDetailLabel.textColor = .secondaryLabel
        errorDetailLabel.textAlignment = .center
        errorDetailLabel.numberOfLines = 0

        let retryButton = UIButton(type: .system)
        retryButton.configuration = .filled()
        retryButton.configuration?.title = "再試行"
        retryButton.addTarget(self, action: #selector(retry), for: .touchUpInside)

        errorView.axis = .vertical
        errorView.alignment = .center
        errorView.spacing = 12
        errorView.translatesAutoresizingMaskIntoConstraints = false
        [title, message, errorDetailLabel, retryButton].forEach(errorView.addArrangedSubview)
        errorView.isHidden = true
        view.addSubview(errorView)

        NSLayoutConstraint.activate([
            loadingIndicator.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            loadingIndicator.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            errorView.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            errorView.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            errorView.leadingAnchor.constraint(greaterThanOrEqualTo: view.leadingAnchor, constant: 24),
            errorView.trailingAnchor.constraint(lessThanOrEqualTo: view.trailingAnchor, constant: -24),
        ])
    }

    private func configureWebView() {
        UIDevice.current.isBatteryMonitoringEnabled = true

        let controller = WKUserContentController()
        controller.add(WeakScriptMessageHandler(self), name: "nativeBridge")
        controller.addUserScript(WKUserScript(
            source: bridgeScript(),
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))

        let configuration = WKWebViewConfiguration()
        configuration.userContentController = controller
        configuration.websiteDataStore = .default()
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = true

        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.isInspectable = true
        webView.translatesAutoresizingMaskIntoConstraints = false
        webView.isOpaque = false
        // 読み込み完了までの白い一瞬と、行き過ぎスクロール時の白い帯を防ぐ
        webView.backgroundColor = WebPalette.background
        webView.scrollView.backgroundColor = WebPalette.background
        view.insertSubview(webView, at: 0)

        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
        ])
    }

    private func bridgeScript() -> String {
        let deviceInfo = jsonString([
            "manufacturer": "Apple",
            "model": UIDevice.current.model,
            "androidVersion": UIDevice.current.systemVersion,
            "sdkInt": ProcessInfo.processInfo.operatingSystemVersion.majorVersion,
            "appVersion": appVersion,
            "packageName": Bundle.main.bundleIdentifier ?? "",
            "locale": Locale.current.identifier,
            "timeZone": TimeZone.current.identifier,
        ])
        let batteryInfo = jsonString([
            "level": UIDevice.current.batteryLevel < 0 ? -1 : Int(UIDevice.current.batteryLevel * 100),
            "charging": [.charging, .full].contains(UIDevice.current.batteryState),
        ])

        return """
        (() => {
          const post = (method, args = []) => window.webkit.messageHandlers.nativeBridge.postMessage({ method, args });
          window.AndroidInterface = {
            showToast: (message, longDuration = false) => post('showToast', [message, longDuration]),
            openExternalLink: (url, mode) => post('openExternalLink', [url, mode]),
            reloadPage: () => post('reloadPage'),
            simulateLoadError: () => post('simulateLoadError'),
            setAppTheme: theme => post('setAppTheme', [theme]),
            getDeviceInfo: () => \(javaScriptLiteral(deviceInfo)),
            getBatteryStatus: () => \(javaScriptLiteral(batteryInfo)),
            vibrate: milliseconds => post('vibrate', [milliseconds]),
            copyToClipboard: (label, text) => post('copyToClipboard', [label, text]),
            shareText: text => post('shareText', [text]),
            requestNativeCallback: (requestId, delayMillis) => post('requestNativeCallback', [requestId, delayMillis])
          };
        })();
        """
    }

    private var appVersion: String {
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0"
        let build = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "1"
        return "\(version) (\(build))"
    }

    private func jsonString(_ value: [String: Any]) -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: value),
              let string = String(data: data, encoding: .utf8) else { return "{}" }
        return string
    }

    private func javaScriptLiteral(_ string: String) -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: [string]),
              let array = String(data: data, encoding: .utf8) else { return "'{}'" }
        return String(array.dropFirst().dropLast())
    }

    private func load(_ url: URL) {
        appRequestedURL = url
        state = LoadStateReducer.onLoadRequested()
        webView.load(URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData))
    }

    @objc private func retry() { load(Self.targetURL) }

    private func render() {
        switch state {
        case .loading:
            loadingIndicator.startAnimating()
            errorView.isHidden = true
            webView.isHidden = false

        case .loaded:
            loadingIndicator.stopAnimating()
            errorView.isHidden = true
            webView.isHidden = false

        case .error(let detail):
            loadingIndicator.stopAnimating()
            errorDetailLabel.text = detail
            errorView.isHidden = false
            webView.isHidden = true
            // エラー画面を出すときはWebViewを空にして、失敗したページを残さない
            webView.load(URLRequest(url: LoadStateReducer.blankURL))
        }
    }

    private func handleBridgeMessage(_ body: Any) {
        guard let payload = body as? [String: Any], let method = payload["method"] as? String else { return }
        let args = payload["args"] as? [Any] ?? []

        switch method {
        case "showToast":
            let message = args.first as? String ?? ""
            let isLong = args.dropFirst().first as? Bool ?? false
            showToast(message: message, duration: isLong ? 3.5 : 2)
            evaluate("window.handleReturnValue?.('Hello from iOS!')")
        case "openExternalLink":
            guard let rawURL = args.first as? String else { return }
            openExternalLink(
                rawURL,
                mode: ExternalOpenMode.from(args.dropFirst().first as? String),
                style: safariStyle
            )
        case "reloadPage": webView.reload()
        case "simulateLoadError": load(Self.unreachableURL)
        case "setAppTheme": onAppThemeChanged?(AppTheme.from(args.first as? String))
        case "vibrate": UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        case "copyToClipboard": UIPasteboard.general.string = args.dropFirst().first as? String
        case "shareText":
            guard let text = args.first as? String else { return }
            let activity = UIActivityViewController(activityItems: [text], applicationActivities: nil)
            activity.popoverPresentationController?.sourceView = view
            activity.popoverPresentationController?.sourceRect = CGRect(
                x: view.bounds.midX,
                y: view.bounds.midY,
                width: 1,
                height: 1
            )
            present(activity, animated: true)
        case "requestNativeCallback": scheduleCallback(args)
        default: break
        }
    }

    private func scheduleCallback(_ args: [Any]) {
        guard let requestID = args.first as? String else { return }
        let delay = min(max((args.dropFirst().first as? NSNumber)?.intValue ?? 0, 0), 10_000)
        let payload = jsonString([
            "type": "callback",
            "requestId": requestID,
            "message": "ネイティブが \(delay)ms 後に応答しました",
        ])
        let work = DispatchWorkItem { [weak self] in
            self?.evaluate("window.onNativeEvent?.(\(self?.javaScriptLiteral(payload) ?? "'{}'"))")
            self?.callbackTasks.removeValue(forKey: requestID)
        }
        callbackTasks[requestID]?.cancel()
        callbackTasks[requestID] = work
        DispatchQueue.main.asyncAfter(deadline: .now() + .milliseconds(delay), execute: work)
    }

    private func evaluate(_ script: String) { webView.evaluateJavaScript(script) }
}

extension WebViewController: WKScriptMessageHandler {
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        handleBridgeMessage(message.body)
    }
}

extension WebViewController: WKNavigationDelegate {
    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        state = LoadStateReducer.onPageStarted(state, url: webView.url)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        state = LoadStateReducer.onPageFinished(state, url: webView.url)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        state = LoadStateReducer.onNavigationFailed(state, error: error)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        state = LoadStateReducer.onNavigationFailed(state, error: error)
    }

    /// `tel:`や`mailto:`はWebViewが読み込めずエラーになるため、端末のアプリに渡す。
    /// http(s)でも配信元と異なるホストはアプリ内ブラウザで開く。
    /// WebView内で遷移させるとURLが見えないうえ戻る手段がなく、デモページに戻れなくなるため。
    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }

        // アプリ自身が読み込ませたURL（初回・再試行・エラー再現・空ページ）はリンク遷移ではない
        if url == appRequestedURL || url == LoadStateReducer.blankURL {
            decisionHandler(.allow)
            return
        }

        switch LinkPolicy.resolve(scheme: url.scheme, host: url.host, targetHost: Self.targetHost) {
        case .inWebView:
            decisionHandler(.allow)

        case .safariViewController:
            decisionHandler(.cancel)
            openExternalLink(url.absoluteString, mode: .customTab, style: safariStyle)

        case .externalApp:
            decisionHandler(.cancel)
            openWithExternalApp(url)
        }
    }

    /// HTTPエラーは`didFail`に来ないため、レスポンスを見てエラー画面に切り替える。
    /// サブフレーム（画像やiframeなど）の失敗ではエラー画面を出さない。
    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationResponse: WKNavigationResponse,
        decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void
    ) {
        guard navigationResponse.isForMainFrame,
              let response = navigationResponse.response as? HTTPURLResponse,
              response.statusCode >= 400
        else {
            decisionHandler(.allow)
            return
        }

        decisionHandler(.cancel)
        state = LoadStateReducer.onHTTPError(
            state,
            isForMainFrame: navigationResponse.isForMainFrame,
            statusCode: response.statusCode
        )
    }
}

extension WebViewController: WKUIDelegate {
    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        // window.open()はdecidePolicyForを通らないため、ここで受け取って
        // 通常のリンクと同じ経路（アプリ内ブラウザ / 外部アプリ）に流す
        if let url = navigationAction.request.url {
            openExternalLink(url.absoluteString, mode: .customTab, style: safariStyle)
        }
        return nil
    }
}

private final class WeakScriptMessageHandler: NSObject, WKScriptMessageHandler {
    weak var delegate: WKScriptMessageHandler?
    init(_ delegate: WKScriptMessageHandler) { self.delegate = delegate }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        delegate?.userContentController(userContentController, didReceive: message)
    }
}
