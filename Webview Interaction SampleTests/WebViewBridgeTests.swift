import Foundation
import Testing
import UIKit

@testable import Webview_Interaction_Sample

/// アプリ込みのブリッジのテスト。
///
/// 起動中のアプリが実際に読み込んでいるページに対して、本物のブリッジ越しに往復させる。
/// Playwrightのテストは`window.AndroidInterface`をモックするため、
/// 「注入されたブリッジが本当に動くか」「ネイティブが何を返すか」はここでしか確かめられない。
///
/// 配信中のページを読み込むためネットワーク接続が必要。
/// 1つのWebViewを共有するので、テストは直列に実行する。
@MainActor
@Suite(.serialized)
struct WebViewBridgeTests {
    /// 各テストの入口。前のテストが再読み込みしていても、準備が整うまで待ってから始める。
    private func openDemo() async throws -> WebViewDriver {
        let driver = try await WebViewDriver.attach()
        try await driver.waitUntilReady()
        return driver
    }

    @Test func demoPage_isReadyOnLaunch() async throws {
        let driver = try await openDemo()

        // レポートに載せる、起動直後のデモ画面
        driver.capture("デモ画面")
        #expect(try await driver.eval("document.title").isEmpty == false)
    }

    @Test func bridge_exposesEveryMethodTheWebPageCalls() async throws {
        let driver = try await openDemo()

        // web/types/android.d.tsが宣言しているメソッド。iOS側も同じ名前で公開する
        let expected = [
            "showToast", "getDeviceInfo", "getBatteryStatus", "vibrate", "copyToClipboard",
            "shareText", "requestNativeCallback", "setAppTheme", "reloadPage", "simulateLoadError",
            "openExternalLink",
        ]

        for method in expected {
            let type = try await driver.eval("typeof window.AndroidInterface.\(method)")
            #expect(type == "function", "\(method)() が注入されていません")
        }
    }

    @Test func showToast_roundTripsThroughTheNativeSide() async throws {
        let driver = try await openDemo()

        // 前のテストの結果が画面に残っていても取り違えないよう、毎回違う文言を送る
        let message = "テストからのトースト \(UUID().uuidString.prefix(8))"

        // ページ自身のハンドラは残したまま、テストからも受け取れるようにする
        try await driver.run(
            """
            window.__returnValue = '';
            const original = window.handleReturnValue;
            window.handleReturnValue = value => { window.__returnValue = value; original?.(value); };
            window.AndroidInterface.showToast(\(driver.jsString(message)))
            """
        )

        // ネイティブはトーストを出し、handleReturnValue()で呼び返す
        try await driver.awaitTrue("handleReturnValue() の受信", "window.__returnValue === 'Hello from iOS!'")

        // ページはその値を #message に描画する
        try await driver.awaitTrue(
            "受信内容の表示",
            "document.querySelector('#message')?.textContent === 'Received: Hello from iOS!'"
        )

        // ネイティブ側のトーストには、Webから渡した文言がそのまま出る
        try await driver.waitUntil("トーストの表示") { driver.visibleToastMessage == message }

        // 出はじめは半透明のため、フェードインが終わってから撮る
        try await Task.sleep(for: .milliseconds(300))
        driver.capture("トースト表示中")
    }

    @Test func getDeviceInfo_reportsTheRunningApp() async throws {
        let driver = try await openDemo()

        let raw = try await driver.eval("window.AndroidInterface.getDeviceInfo()")
        let info = try #require(
            try JSONSerialization.jsonObject(with: Data(raw.utf8)) as? [String: Any],
            "端末情報がJSONとして読めません: \(raw)"
        )

        // ブラウザのモックでは作れない、実行中のアプリそのものの値
        #expect(info["bundleIdentifier"] as? String == Bundle.main.bundleIdentifier)
        #expect(info["systemName"] as? String == UIDevice.current.systemName)
        #expect(info["systemVersion"] as? String == UIDevice.current.systemVersion)
        #expect(info["manufacturer"] as? String == "Apple")
        // Androidの`Build.MODEL`相当。UIDevice.modelは"iPhone"としか返さないため独自に取っている
        #expect((info["model"] as? String)?.isEmpty == false)

        // 画面にも反映されている
        try await driver.awaitTrue(
            "端末情報の表示",
            "document.body.textContent.includes(\(driver.jsString(Bundle.main.bundleIdentifier ?? "")))"
        )
    }

    @Test func getBatteryStatus_isKeptUpToDateFromTheNativeSide() async throws {
        let driver = try await openDemo()

        // iOSの`getBatteryStatus()`は同期的に返す必要があり、呼ばれてからネイティブに聞けない。
        // ネイティブが変化のたびに値を差し替えるための受け口が用意されている
        #expect(try await driver.eval("typeof window.__updateBatteryStatus") == "function")

        let raw = try await driver.eval("window.AndroidInterface.getBatteryStatus()")
        let status = try #require(
            try JSONSerialization.jsonObject(with: Data(raw.utf8)) as? [String: Any],
            "バッテリー状態がJSONとして読めません: \(raw)"
        )

        // シミュレータでは取得できず-1になる。実機では0〜100
        let level = try #require(status["level"] as? Int)
        #expect(level == -1 || (0...100).contains(level))
        #expect(status["charging"] is Bool)
    }

    @Test func requestNativeCallback_answersAfterTheRequestedDelay() async throws {
        let driver = try await openDemo()

        // ページ自身のハンドラは残したまま、テストからも受け取れるようにする
        try await driver.run(
            """
            window.__testEvent = '';
            const original = window.onNativeEvent;
            window.onNativeEvent = json => { window.__testEvent = json; original?.(json); };
            window.AndroidInterface.requestNativeCallback('test-callback', 300)
            """
        )

        try await driver.awaitTrue(
            "onNativeEvent() の受信",
            "window.__testEvent.includes('test-callback') && window.__testEvent.includes('300ms')"
        )
    }

    @Test func setAppTheme_isMirroredIntoUserDefaults() async throws {
        let driver = try await openDemo()

        // アプリ本体の設定を書き換えるため、終わったら元に戻す
        let original = ThemePreference.load()
        defer { ThemePreference.save(original) }

        // 保存済みの値がたまたま一致していて素通りするのを防ぐ
        ThemePreference.save(.system)

        try await driver.run("window.AndroidInterface.setAppTheme('dark')")
        try await driver.waitUntil("配色の保存") { ThemePreference.load() == .dark }

        try await driver.run("window.AndroidInterface.setAppTheme('light')")
        try await driver.waitUntil("配色の保存") { ThemePreference.load() == .light }
    }

    @Test func reloadPage_reloadsTheWebView() async throws {
        let driver = try await openDemo()

        // 再読み込みでJSの実行コンテキストごと消える目印を置く
        try await driver.run("window.__beforeReload = true")
        try await driver.run("window.AndroidInterface.reloadPage()")

        try await driver.awaitTrue("再読み込み", "typeof window.__beforeReload === 'undefined'", timeout: .seconds(45))
        try await driver.waitUntilReady()
    }

    @Test func simulateLoadError_showsTheNativeErrorScreenAndRecoversOnRetry() async throws {
        let driver = try await openDemo()

        try await driver.run("window.AndroidInterface.simulateLoadError()")

        // 到達できないURLを読み込ませ、ネイティブ側のエラー画面に切り替わる
        try await driver.waitUntil("エラー画面の表示", timeout: .seconds(45)) { driver.isShowingErrorScreen }
        #expect(driver.webView.isHidden, "エラー画面を出すときは、失敗したページを残さない")
        driver.capture("エラー画面")

        try driver.tapRetry()

        try await driver.waitUntil("エラー画面が閉じること", timeout: .seconds(45)) { !driver.isShowingErrorScreen }
        try await driver.waitUntilReady()
        driver.capture("再試行のあと")
    }
}

private extension WebViewDriver {
    /// Swiftの文字列をJSのリテラルにする。
    func jsString(_ value: String) -> String {
        let escaped = value
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "'", with: "\\'")
        return "'\(escaped)'"
    }
}
