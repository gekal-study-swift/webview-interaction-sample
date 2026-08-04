//
//  ContentView.swift
//  Webview Interaction Sample
//
//  Created by 劉紅営 on 2025/05/10.
//

import SwiftUI

struct ContentView: View {
    // 前回の選択を初期値にして、WebViewが読み込まれるまでのちらつきを防ぐ。
    // 選択の真実の源はWebView側（MUIがlocalStorageに保存）で、
    // 読み込み後にsetAppThemeで上書きされる。
    @State private var appTheme = ThemePreference.load()
    @State private var universalLink: URL?

    var body: some View {
        WebViewContainer(
            onAppThemeChanged: { theme in
                appTheme = theme
                ThemePreference.save(theme)
            },
            universalLink: universalLink
        )
        .ignoresSafeArea()
        // 他のアプリからこのサイトのリンクを開いたとき、Safariではなくこのアプリが起動する。
        // 対象ドメインはエンタイトルメントとサイト側のapple-app-site-associationで宣言している。
        .onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { activity in
            universalLink = activity.webpageURL
        }
        // ステータスバーとホームインジケータ周辺の配色もアプリの選択に追従させる。
        // UIViewControllerのoverrideUserInterfaceStyleを直接変えても
        // SwiftUIが環境の配色で上書きしてしまうため、ここを唯一の指定箇所にする。
        .preferredColorScheme(appTheme.colorScheme)
    }
}
