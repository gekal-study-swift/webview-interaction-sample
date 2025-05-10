//
//  WebViewController.swift
//  Webview Interaction Sample
//
//  Created by 劉紅営 on 2025/05/10.
//

import UIKit
import WebKit

class WebViewController: UIViewController, WKScriptMessageHandler {
    var webView: WKWebView!

    override func viewDidLoad() {
        super.viewDidLoad()
        setupWebView()
        loadRemoteHTML()
    }

    func setupWebView() {
        let contentController = WKUserContentController()
        contentController.add(self, name: "iosListener") // JSからのメッセージ受信用

        let config = WKWebViewConfiguration()
        config.userContentController = contentController

        webView = WKWebView(frame: view.bounds, configuration: config)
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(webView)
    }

    func loadRemoteHTML() {
        if let url = URL(string: "https://gekal-study-swift.github.io/webview-interaction-sample/index.html") {
            let request = URLRequest(url: url)
            webView.load(request)
        }
    }

    // JavaScript → Swift
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if message.name == "iosListener", let msg = message.body as? String {
            print("JavaScriptから受信: \(msg)")
            self.showToast(message: msg)
            
            // Swift → JavaScript
            let script = "handleReturnValue('Hello from Swift!')"
            webView.evaluateJavaScript(script, completionHandler: nil)
        }
    }
}
