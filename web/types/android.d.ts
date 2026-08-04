/**
 * Android の WebView から注入される JavaScript Interface と、
 * ネイティブ側が `evaluateJavascript` で呼び出すグローバル関数の型定義。
 *
 * @see app/src/main/java/cn/gekal/android/myapplicationwebviewinteractionsample/JavaScriptInterface.kt
 */

declare global {
  /**
   * ブラウザで開いた場合や、古いネイティブアプリから読み込まれた場合はメソッドが
   * 存在しないため、すべて optional として定義し実行時にチェックする。
   */
  interface AndroidInterface {
    /** トースト表示。ネイティブは応答として `handleReturnValue` を呼び返す。 */
    showToast?: {
      (message: string): void;
      (message: string, longDuration: boolean): void;
    };
    /** 端末情報を JSON 文字列で同期的に返す。 */
    getDeviceInfo?: () => string;
    /** バッテリー状態を JSON 文字列で同期的に返す。 */
    getBatteryStatus?: () => string;
    /** 端末を振動させる。 */
    vibrate?: (milliseconds: number) => void;
    /** クリップボードにコピーする。 */
    copyToClipboard?: (label: string, text: string) => void;
    /** 共有シートを開く。 */
    shareText?: (text: string) => void;
    /** 指定ミリ秒後に `onNativeEvent` で非同期に応答させる。 */
    requestNativeCallback?: (requestId: string, delayMillis: number) => void;
    /** ネイティブ側の配色を Web と揃える。`'light'` / `'dark'` / `'system'`。 */
    setAppTheme?: (theme: 'light' | 'dark' | 'system') => void;
    /** 外部リンクを指定した方式で開く。mode は ExternalOpenMode の名前。 */
    openExternalLink?: (url: string, mode: string) => void;
    /** WebView が表示しているページを再読み込みする。 */
    reloadPage?: () => void;
    /** 到達できない URL を読み込み、ネイティブのエラー画面を意図的に表示させる（デモ用）。 */
    simulateLoadError?: () => void;
  }

  /** ネイティブから `onNativeEvent` に渡されるイベント。 */
  interface NativeEvent {
    type: string;
    requestId?: string;
    message?: string;
    [key: string]: unknown;
  }

  interface Window {
    /** JS -> Native。Android 側で `addJavascriptInterface(..., "AndroidInterface")` として注入される。 */
    AndroidInterface?: AndroidInterface;
    /** Native -> JS。Android 側から `handleReturnValue('...')` として呼び出される。 */
    handleReturnValue?: (value: string) => void;
    /** Native -> JS。Android 側から `onNativeEvent('<json>')` として呼び出される。 */
    onNativeEvent?: (json: string) => void;
  }
}

export {};
