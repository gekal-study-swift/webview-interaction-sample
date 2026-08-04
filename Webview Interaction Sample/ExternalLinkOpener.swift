import SafariServices
import UIKit

/// SFSafariViewControllerの見た目。アプリの配色に合わせるために渡す。
struct SafariStyle {
    let barTintColor: UIColor
    let controlTintColor: UIColor
}

/// 外部リンクの開き方をまとめたもの。
///
/// ``ExternalOpenMode``ごとにiOSの別々の仕組みを使う。
/// どれを選ぶかの判断は``LinkPolicy``にあり、ここは実際に開くだけ。
///
/// Android版と同じモード名を受け取るが、`intent://`とTrusted Web ActivityはiOSに相当する
/// 仕組みが無い。黙って別の挙動にすると何が起きたか分からないため、その旨を知らせてから開く。
extension UIViewController {
    func openExternalLink(_ rawURL: String, mode: ExternalOpenMode, style: SafariStyle) {
        guard let url = URL(string: rawURL), LinkPolicy.isAllowed(mode, scheme: url.scheme) else {
            NSLog("[ExternalLinkOpener] %@では扱えないURLのため無視します: %@", mode.rawValue, rawURL)
            return
        }

        switch mode {
        case .inAppOverlay:
            presentInAppOverlay(url)

        case .customTab:
            presentSafari(url, style: style, partial: false)

        case .partialCustomTab:
            presentSafari(url, style: style, partial: true)

        case .warmedCustomTab:
            presentWarmedSafari(url, style: style)

        case .appLink:
            openAsAppLink(url, style: style)

        case .browserChooser:
            presentAppChooser(url)

        case .newDocument:
            openInDefaultBrowser(url)

        case .intentURI:
            openIntentURIFallback(rawURL, style: style)

        case .trustedWebActivity:
            showToast(message: "iOSにTrusted Web Activityはありません。Safariで開きます", duration: 3)
            presentSafari(url, style: style, partial: false)
        }
    }

    /// アプリ内オーバーレイ（2つ目のWKWebView）で開く。
    private func presentInAppOverlay(_ url: URL) {
        let browser = InAppBrowserViewController(url: url)
        browser.modalPresentationStyle = .fullScreen
        present(browser, animated: true)
    }

    /// SFSafariViewControllerで開く。
    ///
    /// `partial`がtrueのときはシート状に部分表示する（下にアプリが見えたまま重なる）。
    /// AndroidのCustom Tabsと違い、描画するのはSafariではなくアプリ内のViewControllerなので、
    /// ブラウザの有無による退化は起きない。
    private func presentSafari(_ url: URL, style: SafariStyle, partial: Bool, warming: SFSafariViewController.PrewarmingToken? = nil) {
        let configuration = SFSafariViewController.Configuration()
        configuration.barCollapsingEnabled = false

        let safari = SFSafariViewController(url: url, configuration: configuration)
        safari.preferredBarTintColor = style.barTintColor
        safari.preferredControlTintColor = style.controlTintColor
        safari.dismissButtonStyle = .close

        if partial {
            // Android版の部分表示（画面の7割）に合わせる
            safari.modalPresentationStyle = .pageSheet
            safari.sheetPresentationController?.detents = [.medium(), .large()]
            safari.sheetPresentationController?.prefersGrabberVisible = true
            safari.sheetPresentationController?.preferredCornerRadius = 16
        }

        present(safari, animated: true) {
            // 表示まで維持する必要があるため、ここまで持ち回してから破棄する
            warming?.invalidate()
        }
    }

    /// 事前にコネクションを張ってからSFSafariViewControllerを開く。表示までの待ちが短くなる。
    ///
    /// AndroidのウォームアップはCustom Tabsサービスへの接続が必要で非同期だが、
    /// iOSは`prewarmConnections(to:)`を呼ぶだけでよい。
    private func presentWarmedSafari(_ url: URL, style: SafariStyle) {
        let token = SFSafariViewController.prewarmConnections(to: [url])
        presentSafari(url, style: style, partial: false, warming: token)
    }

    /// 対応アプリがあればそのアプリで開く（Universal Links）。
    ///
    /// `universalLinksOnly`は、そのURLを受け持つアプリが入っていないとfalseで返る。
    /// それを見てSFSafariViewControllerに落とすことで、
    /// 「アプリがあればアプリ、無ければアプリ内ブラウザ」になる。
    private func openAsAppLink(_ url: URL, style: SafariStyle) {
        UIApplication.shared.open(url, options: [.universalLinksOnly: true]) { [weak self] opened in
            guard !opened else { return }
            NSLog("[ExternalLinkOpener] このリンクを開けるアプリがないためSafariで開きます: %@", url.absoluteString)
            self?.presentSafari(url, style: style, partial: false)
        }
    }

    /// 既定のブラウザに直行させず、ユーザーにアプリを選ばせる。
    ///
    /// iOSにIntentのチューザーは無いため、同じ役割を果たす共有シートを使う。
    private func presentAppChooser(_ url: URL) {
        let activity = UIActivityViewController(activityItems: [url], applicationActivities: nil)
        activity.popoverPresentationController?.sourceView = view
        activity.popoverPresentationController?.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 1, height: 1)
        present(activity, animated: true)
    }

    /// 既定のブラウザを別アプリとして開く。Appスイッチャーに別項目として並ぶ。
    private func openInDefaultBrowser(_ url: URL) {
        UIApplication.shared.open(url)
    }

    /// `intent://`のフォールバック先を開く。
    ///
    /// iOSに`intent://`を解釈する仕組みは無いため、Androidが対応アプリを見つけられなかったときと
    /// 同じ結果（`S.browser_fallback_url`を開く）にそろえる。
    private func openIntentURIFallback(_ rawURL: String, style: SafariStyle) {
        guard let fallback = LinkPolicy.browserFallbackURL(fromIntentURI: rawURL) else {
            showToast(message: "iOSはintent://を扱えず、フォールバック先も指定されていません", duration: 3)
            return
        }
        showToast(message: "iOSはintent://を扱えないため、フォールバック先を開きます", duration: 3)
        presentSafari(fallback, style: style, partial: false)
    }

    /// `tel:`や`mailto:`などのURIを対応するアプリで開く。
    ///
    /// 電話は`tel:`（ダイヤル画面の確認が入る）を使う。
    /// 即座に発信する仕組みはiOSには無いため、Android版の`ACTION_DIAL`と同じ結果になる。
    func openWithExternalApp(_ url: URL) {
        UIApplication.shared.open(url, options: [:]) { [weak self] opened in
            guard !opened else { return }
            NSLog("[ExternalLinkOpener] このURIを開けるアプリがありません: %@", url.absoluteString)
            self?.showToast(message: "対応するアプリが見つかりませんでした")
        }
    }
}
