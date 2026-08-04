//
//  WebViewContainer.swift
//  Webview Interaction Sample
//
//  Created by 劉紅営 on 2025/05/10.
//

import SwiftUI

struct WebViewContainer: UIViewControllerRepresentable {
    let onAppThemeChanged: (AppTheme) -> Void

    func makeUIViewController(context: Context) -> WebViewController {
        let controller = WebViewController()
        controller.onAppThemeChanged = onAppThemeChanged
        return controller
    }

    // makeUIViewControllerは一度しか実行されないため、最新のクロージャを渡し直す
    func updateUIViewController(_ uiViewController: WebViewController, context: Context) {
        uiViewController.onAppThemeChanged = onAppThemeChanged
    }
}
