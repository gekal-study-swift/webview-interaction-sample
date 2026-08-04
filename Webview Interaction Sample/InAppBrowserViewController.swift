import UIKit
import WebKit

/// 外部サイトをアプリ内に重ねて表示するオーバーレイ。
///
/// SFSafariViewControllerと違ってSafariに依存しないため、どの端末でも同じ見た目になる。
/// 代わりにSafariのセッションやセキュリティ表示は共有されないので、
/// 実サービスのログイン（OAuth）には使わないこと。GoogleはWebViewでのサインインを拒否する。
///
/// 外部サイトを読み込むため、ブリッジのスクリプトは**注入しない**。
final class InAppBrowserViewController: UIViewController {
    private let url: URL
    private var webView: WKWebView!
    private var progressObservation: NSKeyValueObservation?

    private let progressView = UIProgressView(progressViewStyle: .bar)
    private let stateLabel = UILabel()
    private let hostLabel = UILabel()
    private let loadingView = UIView()
    private let loadingProgressLabel = UILabel()
    private let failedView = UIView()
    private let failedDetailLabel = UILabel()

    private var state: LoadState = .loading {
        didSet { render() }
    }

    init(url: URL) {
        self.url = url
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = WebPalette.background
        configureWebView()
        configureHeader()
        configureOverlays()
        render()
        load()
    }

    private func configureWebView() {
        webView = WKWebView(frame: .zero, configuration: WKWebViewConfiguration())
        webView.navigationDelegate = self
        webView.translatesAutoresizingMaskIntoConstraints = false
        webView.isOpaque = false
        webView.backgroundColor = WebPalette.background
        webView.scrollView.backgroundColor = WebPalette.background
        view.addSubview(webView)

        // 何%まで進んだかを出して、止まっていないことを示す
        progressObservation = webView.observe(\.estimatedProgress, options: .new) { [weak self] webView, _ in
            self?.updateProgress(Float(webView.estimatedProgress))
        }
    }

    /// 外部サイトであることと接続先、進捗を示すヘッダー。
    private func configureHeader() {
        // SF Symbolsを使わず、Android版と同じく記号で表現する
        let closeButton = UIButton(type: .system)
        closeButton.setTitle("✕", for: .normal)
        closeButton.titleLabel?.font = .preferredFont(forTextStyle: .title3)
        closeButton.addTarget(self, action: #selector(close), for: .touchUpInside)
        closeButton.translatesAutoresizingMaskIntoConstraints = false

        stateLabel.font = .preferredFont(forTextStyle: .caption2)
        stateLabel.textColor = .secondaryLabel

        hostLabel.text = url.host
        hostLabel.font = .preferredFont(forTextStyle: .subheadline)
        hostLabel.lineBreakMode = .byTruncatingTail

        let titles = UIStackView(arrangedSubviews: [stateLabel, hostLabel])
        titles.axis = .vertical

        let bar = UIStackView(arrangedSubviews: [closeButton, titles])
        bar.axis = .horizontal
        bar.alignment = .center
        bar.spacing = 4
        bar.isLayoutMarginsRelativeArrangement = true
        bar.directionalLayoutMargins = .init(top: 4, leading: 8, bottom: 4, trailing: 12)

        progressView.progressTintColor = WebPalette.primary

        let header = UIStackView(arrangedSubviews: [bar, progressView])
        header.axis = .vertical
        header.backgroundColor = .secondarySystemBackground
        header.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(header)

        NSLayoutConstraint.activate([
            // ボタンに幅を与えないと、横方向の余りを吸って見出しを押し出してしまう
            closeButton.widthAnchor.constraint(equalToConstant: 44),
            closeButton.heightAnchor.constraint(equalToConstant: 44),

            header.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            header.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            header.trailingAnchor.constraint(equalTo: view.trailingAnchor),

            webView.topAnchor.constraint(equalTo: header.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
        ])
    }

    /// 読み込み中と失敗はWebViewの上に重ねて出す。
    private func configureOverlays() {
        let indicator = UIActivityIndicatorView(style: .large)
        indicator.startAnimating()

        let loadingTitle = UILabel()
        loadingTitle.text = "読み込み中…"
        loadingTitle.font = .preferredFont(forTextStyle: .headline)

        let loadingHost = UILabel()
        loadingHost.text = url.host
        loadingHost.font = .preferredFont(forTextStyle: .caption1)
        loadingHost.textColor = .secondaryLabel

        loadingProgressLabel.font = .preferredFont(forTextStyle: .caption2)
        loadingProgressLabel.textColor = .secondaryLabel

        configureOverlay(loadingView, arrangedSubviews: [indicator, loadingTitle, loadingHost, loadingProgressLabel])

        let failedTitle = UILabel()
        failedTitle.text = "ページを読み込めませんでした"
        failedTitle.textColor = .systemRed
        failedTitle.font = .preferredFont(forTextStyle: .headline)

        failedDetailLabel.font = .preferredFont(forTextStyle: .caption1)
        failedDetailLabel.textColor = .secondaryLabel
        failedDetailLabel.textAlignment = .center
        failedDetailLabel.numberOfLines = 0

        let retryButton = UIButton(type: .system)
        retryButton.configuration = .filled()
        retryButton.configuration?.title = "再試行"
        retryButton.addTarget(self, action: #selector(retry), for: .touchUpInside)

        let closeButton = UIButton(type: .system)
        closeButton.configuration = .plain()
        closeButton.configuration?.title = "閉じる"
        closeButton.addTarget(self, action: #selector(close), for: .touchUpInside)

        configureOverlay(failedView, arrangedSubviews: [failedTitle, failedDetailLabel, retryButton, closeButton])
    }

    /// WebViewの全面を覆い、内容を中央に置く。
    private func configureOverlay(_ container: UIView, arrangedSubviews: [UIView]) {
        container.backgroundColor = WebPalette.background
        container.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(container)

        let stack = UIStackView(arrangedSubviews: arrangedSubviews)
        stack.axis = .vertical
        stack.alignment = .center
        stack.spacing = 8
        stack.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(stack)

        NSLayoutConstraint.activate([
            container.topAnchor.constraint(equalTo: webView.topAnchor),
            container.leadingAnchor.constraint(equalTo: webView.leadingAnchor),
            container.trailingAnchor.constraint(equalTo: webView.trailingAnchor),
            container.bottomAnchor.constraint(equalTo: webView.bottomAnchor),

            stack.centerXAnchor.constraint(equalTo: container.centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: container.centerYAnchor),
            stack.leadingAnchor.constraint(greaterThanOrEqualTo: container.leadingAnchor, constant: 24),
            stack.trailingAnchor.constraint(lessThanOrEqualTo: container.trailingAnchor, constant: -24),
        ])
    }

    private func load() {
        state = LoadStateReducer.onLoadRequested()
        webView.load(URLRequest(url: url))
    }

    @objc private func retry() { load() }

    @objc private func close() { dismiss(animated: true) }

    private func updateProgress(_ progress: Float) {
        progressView.setProgress(progress, animated: true)
        loadingProgressLabel.text = "\(Int(progress * 100))%"
    }

    private func render() {
        let isLoading = state == .loading
        stateLabel.text = isLoading ? "外部サイト · 読み込み中" : "外部サイト"
        progressView.isHidden = !isLoading
        loadingView.isHidden = !isLoading

        if case .error(let detail) = state {
            failedDetailLabel.text = detail
            failedView.isHidden = false
        } else {
            failedView.isHidden = true
        }
    }
}

extension InAppBrowserViewController: WKNavigationDelegate {
    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        updateProgress(0)
        state = LoadStateReducer.onPageStarted(state, url: webView.url)
    }

    /// 最初の描画ができた時点で読み込み中の表示を消す。
    func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
        state = LoadStateReducer.onPageFinished(state, url: webView.url)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        state = LoadStateReducer.onPageFinished(state, url: webView.url)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        state = LoadStateReducer.onNavigationFailed(state, error: error)
    }

    func webView(
        _ webView: WKWebView,
        didFailProvisionalNavigation navigation: WKNavigation!,
        withError error: Error
    ) {
        state = LoadStateReducer.onNavigationFailed(state, error: error)
    }
}
