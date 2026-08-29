import Foundation
import SwiftUI
import Testing

@testable import Webview_Interaction_Sample

/// 配色の変換と保存のテスト。
///
/// 配色を選ぶのはWebView側で、ネイティブは受け取った文字列を解釈して保存するだけ。
/// 未知の値でクラッシュしないことと、保存した値が次回起動で読めることを見る。
struct AppThemeTests {
    @Test func from_acceptsTheValuesTheWebSends() {
        #expect(AppTheme.from("light") == .light)
        #expect(AppTheme.from("dark") == .dark)
        #expect(AppTheme.from("system") == .system)
        #expect(AppTheme.from("DARK") == .dark)
    }

    @Test func from_fallsBackToSystemForUnknownValues() {
        // 端末の設定に従うのが、どの配色とも食い違わない安全な既定
        #expect(AppTheme.from("sepia") == .system)
        #expect(AppTheme.from(nil) == .system)
        #expect(AppTheme.from("") == .system)
    }

    @Test func colorScheme_leavesSystemToTheDevice() {
        #expect(AppTheme.system.colorScheme == nil)
        #expect(AppTheme.light.colorScheme == .light)
        #expect(AppTheme.dark.colorScheme == .dark)
    }

    @Test func themePreference_roundTripsThroughUserDefaults() {
        // アプリ本体の設定を書き換えるため、終わったら元に戻す
        let original = ThemePreference.load()
        defer { ThemePreference.save(original) }

        ThemePreference.save(.dark)
        #expect(ThemePreference.load() == .dark)

        ThemePreference.save(.system)
        #expect(ThemePreference.load() == .system)
    }
}
