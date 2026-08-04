'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

export type LogDirection = 'js-to-native' | 'native-to-js' | 'info';
export type LogLevel = 'info' | 'success' | 'warning' | 'error';

export interface LogEntry {
  id: number;
  at: string;
  direction: LogDirection;
  level: LogLevel;
  label: string;
  detail?: string;
}

export interface Notice {
  message: string;
  level: LogLevel;
}

type BridgeMethod = keyof AndroidInterface;
type CallableBridge = Record<string, ((...args: unknown[]) => unknown) | undefined>;

interface BridgeContextValue {
  /** ハイドレーション完了後に true。SSR との差分を避けるため描画分岐に使う。 */
  hydrated: boolean;
  /** `window.AndroidInterface` が存在するか。 */
  connected: boolean;
  /** ネイティブが提供しているメソッド名。 */
  availableMethods: string[];
  /** ネイティブが特定のメソッドを提供しているか。 */
  supports: (method: BridgeMethod) => boolean;
  /** ネイティブメソッドを呼び出し、結果をログに残す。 */
  callNative: <T = unknown>(method: BridgeMethod, args?: unknown[]) => T | undefined;
  /** `requestNativeCallback` の応答を Promise で待つ。 */
  requestCallback: (delayMillis: number) => Promise<NativeEvent>;
  /** `handleReturnValue` で受け取った最新の値。 */
  returnValue: string;
  logs: LogEntry[];
  clearLogs: () => void;
  log: (entry: Omit<LogEntry, 'id' | 'at'>) => void;
  notice: Notice | null;
  notify: (message: string, level?: LogLevel) => void;
  dismissNotice: () => void;
}

const BridgeContext = createContext<BridgeContextValue | null>(null);

/** ネイティブが提供しうるメソッド名（存在チェックのプローブに使う）。 */
const KNOWN_METHODS: BridgeMethod[] = [
  'showToast',
  'getDeviceInfo',
  'getBatteryStatus',
  'vibrate',
  'copyToClipboard',
  'shareText',
  'requestNativeCallback',
  'setAppTheme',
  'reloadPage',
  'simulateLoadError',
  'openExternalLink',
];

const timestamp = () =>
  new Date().toLocaleTimeString('ja-JP', { hour12: false }) +
  '.' +
  String(new Date().getMilliseconds()).padStart(3, '0');

const formatArgs = (args: unknown[]) =>
  args.map((arg) => (typeof arg === 'string' ? `'${arg}'` : String(arg))).join(', ');

/** コンソール出力での方向の見出し。 */
const DIRECTION_LABEL: Record<LogDirection, string> = {
  'js-to-native': 'JS → Native',
  'native-to-js': 'Native → JS',
  info: 'Bridge',
};

/**
 * ブリッジのやり取りを WebView のコンソールにも出す。
 * vConsole など端末上のコンソールで JS ⇄ Native の入出力を追えるようにするため。
 */
function emitConsole(entry: Omit<LogEntry, 'id' | 'at'>) {
  const tag = `[Bridge] ${DIRECTION_LABEL[entry.direction]}: ${entry.label}`;
  const method = entry.level === 'error' ? console.error : entry.level === 'warning' ? console.warn : console.log;
  if (entry.detail !== undefined) {
    method(tag, entry.detail);
  } else {
    method(tag);
  }
}

export function BridgeProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [connected, setConnected] = useState(false);
  const [availableMethods, setAvailableMethods] = useState<string[]>([]);
  const [returnValue, setReturnValue] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [notice, setNotice] = useState<Notice | null>(null);

  const logId = useRef(0);
  const pending = useRef(new Map<string, (event: NativeEvent) => void>());

  const log = useCallback((entry: Omit<LogEntry, 'id' | 'at'>) => {
    setLogs((current) => [{ ...entry, id: (logId.current += 1), at: timestamp() }, ...current].slice(0, 100));
    // 画面のイベントログに加えて、WebView のコンソール（vConsole）にも出す
    emitConsole(entry);
  }, []);

  const notify = useCallback((message: string, level: LogLevel = 'info') => setNotice({ message, level }), []);
  const dismissNotice = useCallback(() => setNotice(null), []);
  const clearLogs = useCallback(() => setLogs([]), []);

  // Native -> JS のエントリポイントを window に公開する
  useEffect(() => {
    window.handleReturnValue = (value: string) => {
      setReturnValue(value);
      log({ direction: 'native-to-js', level: 'success', label: `handleReturnValue('${value}')` });
    };

    window.onNativeEvent = (json: string) => {
      let event: NativeEvent;
      try {
        event = JSON.parse(json) as NativeEvent;
      } catch {
        log({
          direction: 'native-to-js',
          level: 'error',
          label: 'onNativeEvent()',
          detail: `JSON の解析に失敗: ${json}`,
        });
        return;
      }
      log({ direction: 'native-to-js', level: 'success', label: `onNativeEvent(${event.type})`, detail: json });
      const requestId = event.requestId;
      if (requestId && pending.current.has(requestId)) {
        pending.current.get(requestId)?.(event);
        pending.current.delete(requestId);
      }
    };

    // 注入されたオブジェクトのメソッドが列挙可能とは限らないため、既知の名前も併せて調べる
    const bridge = window.AndroidInterface as CallableBridge | undefined;
    const candidates = new Set([...KNOWN_METHODS, ...Object.keys(bridge ?? {})]);
    const methods = [...candidates].filter((key) => typeof bridge?.[key] === 'function');

    setHydrated(true);
    setConnected(Boolean(window.AndroidInterface));
    setAvailableMethods(methods);
    log({
      direction: 'info',
      level: window.AndroidInterface ? 'success' : 'warning',
      label: window.AndroidInterface ? 'AndroidInterface を検出しました' : 'AndroidInterface が見つかりません',
      detail: window.AndroidInterface ? methods.join(', ') : 'ブラウザで表示中のため JS -> Native は動作しません',
    });

    const pendingCallbacks = pending.current;
    return () => {
      delete window.handleReturnValue;
      delete window.onNativeEvent;
      pendingCallbacks.clear();
    };
  }, [log]);

  const supports = useCallback(
    (method: BridgeMethod) => typeof (window.AndroidInterface as CallableBridge | undefined)?.[method] === 'function',
    [],
  );

  const callNative = useCallback(
    <T,>(method: BridgeMethod, args: unknown[] = []): T | undefined => {
      const bridge = window.AndroidInterface as CallableBridge | undefined;
      const fn = bridge?.[method];

      if (typeof fn !== 'function') {
        log({
          direction: 'js-to-native',
          level: 'warning',
          label: `${method}(${formatArgs(args)})`,
          detail: 'ネイティブ側にこのメソッドがありません',
        });
        notify(`${method}() はこの環境では利用できません`, 'warning');
        return undefined;
      }

      try {
        const result = fn.apply(bridge, args);
        log({
          direction: 'js-to-native',
          level: 'success',
          label: `${method}(${formatArgs(args)})`,
          detail: result === undefined ? undefined : String(result),
        });
        return result as T;
      } catch (error) {
        log({
          direction: 'js-to-native',
          level: 'error',
          label: `${method}(${formatArgs(args)})`,
          detail: error instanceof Error ? error.message : String(error),
        });
        notify(`${method}() の呼び出しに失敗しました`, 'error');
        return undefined;
      }
    },
    [log, notify],
  );

  const requestCallback = useCallback(
    (delayMillis: number) =>
      new Promise<NativeEvent>((resolve, reject) => {
        const requestId = `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
        const timer = window.setTimeout(() => {
          pending.current.delete(requestId);
          reject(new Error('ネイティブからの応答がタイムアウトしました'));
        }, delayMillis + 5000);

        pending.current.set(requestId, (event) => {
          window.clearTimeout(timer);
          resolve(event);
        });

        if (!supports('requestNativeCallback')) {
          window.clearTimeout(timer);
          pending.current.delete(requestId);
          callNative('requestNativeCallback', [requestId, delayMillis]);
          reject(new Error('requestNativeCallback() はこの環境では利用できません'));
          return;
        }

        callNative('requestNativeCallback', [requestId, delayMillis]);
      }),
    [callNative, supports],
  );

  const value = useMemo<BridgeContextValue>(
    () => ({
      hydrated,
      connected,
      availableMethods,
      supports,
      callNative,
      requestCallback,
      returnValue,
      logs,
      clearLogs,
      log,
      notice,
      notify,
      dismissNotice,
    }),
    [
      hydrated,
      connected,
      availableMethods,
      supports,
      callNative,
      requestCallback,
      returnValue,
      logs,
      clearLogs,
      log,
      notice,
      notify,
      dismissNotice,
    ],
  );

  return <BridgeContext.Provider value={value}>{children}</BridgeContext.Provider>;
}

export function useBridge() {
  const context = useContext(BridgeContext);
  if (!context) {
    throw new Error('useBridge must be used within a BridgeProvider');
  }
  return context;
}
