'use client';

import { useEffect } from 'react';

import { isVConsoleEnabled } from './vconsole-config';

/**
 * WebView 上でログとネットワーク通信を確認するための vConsole を読み込む。
 *
 * バンドルを膨らませないよう動的 import で、有効なときだけ読み込む。
 * ネットワークパネルは XHR / fetch を捕捉するため、なるべく早く初期化する。
 */
export function VConsoleLoader() {
  useEffect(() => {
    if (!isVConsoleEnabled(window.location.search)) {
      return;
    }

    let cancelled = false;
    let instance: { destroy: () => void } | undefined;

    import('vconsole').then(({ default: VConsole }) => {
      if (cancelled) {
        return;
      }
      // アプリの配色に合わせる（InitColorSchemeScript が <html> に付けたクラスで判定）
      const dark = document.documentElement.classList.contains('dark');
      instance = new VConsole({ theme: dark ? 'dark' : 'light' });
    });

    return () => {
      cancelled = true;
      instance?.destroy();
    };
  }, []);

  return null;
}
