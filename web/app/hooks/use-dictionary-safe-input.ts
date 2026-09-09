'use client';

import { useCallback, useEffect, useRef } from 'react';

type InputElement = HTMLInputElement | HTMLTextAreaElement;

/**
 * iOS のユーザ辞書（テキスト置換）や日本語の予測変換で入る文字を、
 * React の制御コンポーネントで取りこぼさないための同期フック。
 *
 * WKWebView / Safari は次のケースで、React による `value` の再適用と
 * タイミングが競合し、末尾の 1 文字が欠ける・カーソルが先頭へ飛ぶことがある。
 *   - テキスト置換の自動展開（`input` の inputType が `insertReplacementText`）
 *   - 日本語 IME の未確定文字がある状態での変換確定
 *
 * 対策として React の合成 `onChange` には頼らず、要素のネイティブ
 * `input` / `compositionend` を直接購読し、実際の `element.value` を
 * 唯一の真実として state へ戻す。composition 中の中間 `input` は無視する。
 *
 * @param value 現在の state 値（制御コンポーネントの `value` と同じもの）
 * @param onValueChange 確定した値を state に反映するコールバック
 * @returns MUI TextField に渡す `inputRef` と、制御コンポーネントの警告回避用の no-op `onChange`
 */
export function useDictionarySafeInput(value: string, onValueChange: (next: string) => void) {
  const ref = useRef<InputElement | null>(null);
  const isComposing = useRef(false);
  // リスナーを貼り直さずに最新の値・コールバックを参照するための保持
  const latest = useRef({ value, onValueChange });
  latest.current = { value, onValueChange };

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const flush = () => {
      if (isComposing.current) return;
      const { value: current, onValueChange: emit } = latest.current;
      if (element.value !== current) emit(element.value);
    };

    const handleInput = () => flush();
    const handleCompositionStart = () => {
      isComposing.current = true;
    };
    const handleCompositionEnd = () => {
      isComposing.current = false;
      // 確定直後は `input` が後追いで来ることがあるため、次のタスクでも読む
      queueMicrotask(flush);
    };

    element.addEventListener('input', handleInput);
    element.addEventListener('compositionstart', handleCompositionStart);
    element.addEventListener('compositionend', handleCompositionEnd);
    return () => {
      element.removeEventListener('input', handleInput);
      element.removeEventListener('compositionstart', handleCompositionStart);
      element.removeEventListener('compositionend', handleCompositionEnd);
    };
  }, []);

  // 同期はネイティブイベントに一本化する。React の合成 `onChange` は
  // composition 中に重複発火するため使わないが、制御コンポーネントの
  // 警告（value あり onChange なし）を避けるために空ハンドラを渡す。
  const noopChange = useCallback(() => {}, []);

  return { inputRef: ref, onChange: noopChange };
}
