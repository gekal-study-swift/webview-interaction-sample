'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useColorScheme } from '@mui/material/styles';

/** 配色が確定しない場合でも、この時間が過ぎたら本体を描画する。 */
const FALLBACK_TIMEOUT_MS = 2000;

/**
 * 配色が確定するまで中身を描画せず、ローディングを表示する。
 *
 * `useColorScheme()` の `colorScheme` はサーバーと最初のクライアントレンダリングでは
 * `undefined` で、`InitColorSchemeScript` とマウント時の効果で `light` / `dark` に確定する。
 * この間に本体を描画するとライトで一瞬表示されてからダークに切り替わるため、
 * 確定するまではテーマに依存しない CSS (`boot-style.tsx`) だけで作ったローディングを出す。
 */
export function ThemeGate({ children }: { children: ReactNode }) {
  const { colorScheme } = useColorScheme();
  const [timedOut, setTimedOut] = useState(false);

  // 万一 colorScheme が確定しない環境でも、ローディングのまま固まらないようにする
  useEffect(() => {
    const timer = window.setTimeout(() => setTimedOut(true), FALLBACK_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, []);

  if (!colorScheme && !timedOut) {
    return (
      <div className="boot-screen" role="status" aria-label="テーマを準備しています">
        <div className="boot-spinner" />
      </div>
    );
  }

  return <>{children}</>;
}
