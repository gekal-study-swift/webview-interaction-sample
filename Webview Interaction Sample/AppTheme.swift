import SwiftUI
import UIKit

/// アプリの配色。既定は``system``（端末のダークモード設定に追従）。
enum AppTheme: String {
    case system
    case light
    case dark

    /// WebViewから渡される文字列を変換する。未知の値は``system``にフォールバックする。
    static func from(_ value: String?) -> AppTheme {
        guard let value else { return .system }
        return AppTheme(rawValue: value.lowercased()) ?? .system
    }

    /// ``system``はnilを返し、端末の設定に委ねる
    var colorScheme: ColorScheme? {
        switch self {
        case .system: nil
        case .light: .light
        case .dark: .dark
        }
    }
}

/// 配色を次回起動まで保持する。
///
/// 配色を選ぶのはWebView側（MUIがlocalStorageに保存する）で、そちらが真実の源。
/// ここに保存するのは、起動直後にWebViewが読み込まれるまでの間、
/// セーフエリアの余白とWebコンテンツの色が食い違ってちらつくのを防ぐためのミラー。
enum ThemePreference {
    private static let key = "appTheme"

    static func load() -> AppTheme {
        AppTheme.from(UserDefaults.standard.string(forKey: key))
    }

    static func save(_ theme: AppTheme) {
        UserDefaults.standard.set(theme.rawValue, forKey: key)
    }
}

/// WebViewに表示するWebコンテンツ (web/app/theme.ts) と同じ配色。
/// セーフエリアの余白とWebViewの背景を継ぎ目なく見せるために揃えている。
enum WebPalette {
    /// web/app/theme.tsのbackground.default
    static let background = UIColor { traits in
        traits.userInterfaceStyle == .dark ? UIColor(hex: 0x0E1414) : UIColor(hex: 0xF2F6F5)
    }

    /// web/app/theme.tsのbackground.paper
    static let surface = UIColor { traits in
        traits.userInterfaceStyle == .dark ? UIColor(hex: 0x161D1D) : UIColor(hex: 0xFFFFFF)
    }

    /// web/app/theme.tsのprimary.main
    static let primary = UIColor { traits in
        traits.userInterfaceStyle == .dark ? UIColor(hex: 0x5FD4C0) : UIColor(hex: 0x00695F)
    }
}

private extension UIColor {
    /// web/app/theme.tsの値をそのまま書き写せるようにする
    convenience init(hex: UInt32) {
        self.init(
            red: CGFloat((hex >> 16) & 0xFF) / 255,
            green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255,
            alpha: 1
        )
    }
}
