'use client';

import { useCallback, useEffect, useRef, type ChangeEvent } from 'react';

type InputElement = HTMLInputElement | HTMLTextAreaElement;

/**
 * 自動補完・自動修正・自動大文字化・スペルチェックを入力欄で無効化する属性。
 *
 * トーストの文言やコピー用テキストのような一時的な入力では、これらがかえって
 * 邪魔になるため切る。ただし iOS 26 では `autocorrect="off"` でもユーザ辞書の
 * テキスト置換（`insertReplacementText`）は止まらないため、それは
 * `useDictionarySafeInput` の `beforeinput` 側で `preventDefault()` して抑止する。
 *
 * MUI TextField には `slotProps={{ htmlInput: { ...dictionaryOffInputProps } }}` で渡す。
 */
export const dictionaryOffInputProps = {
  autoComplete: 'off',
  autoCorrect: 'off',
  autoCapitalize: 'off',
  spellCheck: false,
} as const;

/**
 * 入力欄でユーザ辞書のテキスト置換を無効化しつつ、日本語 IME の変換確定などで
 * 入る文字を React の制御コンポーネントで取りこぼさないためのフック。
 *
 * - `beforeinput` の `inputType === 'insertReplacementText'` を `preventDefault()` し、
 *   ユーザ辞書の自動展開（`omw` → `On my way!` など）を止める。打った文字はそのまま残る。
 *   （日本語の変換は `insertCompositionText` 系なので影響しない。）
 * - `onChange` は通常どおり state を更新するが、変換中（未確定）の中間 `onChange` は無視し、
 *   `compositionend` で確定値をまとめて反映する。iOS の WKWebView は `compositionend` の
 *   後に `onChange` を出さないことがあるため、確定値をそこで直接 state へ入れる。
 *   （no-op な `onChange` にすると、React が制御コンポーネントの `value` を戻して
 *   変換した文字が消えるため、実ハンドラのままにする。）
 * - 保険として、要素のネイティブ `input` も購読し、`onChange` が来ない経路で
 *   `element.value` がずれていたら state へ戻す（composition 中は無視）。
 *
 * @param value 現在の state 値（制御コンポーネントの `value` と同じもの）
 * @param onValueChange 確定した値を state に反映するコールバック
 * @returns MUI TextField に渡す `inputRef` と `onChange`
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

    const sync = () => {
      if (isComposing.current) return;
      const { value: current, onValueChange: emit } = latest.current;
      if (element.value !== current) emit(element.value);
    };

    const handleBeforeInput = (event: Event) => {
      // ユーザ辞書のテキスト置換を入力欄では無効化する。
      // iOS 26 では autocorrect="off" でも展開されるため beforeinput で止める。
      if ((event as InputEvent).inputType === 'insertReplacementText') {
        event.preventDefault();
      }
    };
    const handleInput = () => sync();
    const handleCompositionStart = () => {
      isComposing.current = true;
    };
    const handleCompositionEnd = () => {
      isComposing.current = false;
      // React の onChange が後追いで来ないことがあるため、ここで確実に反映する
      sync();
      queueMicrotask(sync);
    };

    element.addEventListener('beforeinput', handleBeforeInput);
    element.addEventListener('input', handleInput);
    element.addEventListener('compositionstart', handleCompositionStart);
    element.addEventListener('compositionend', handleCompositionEnd);
    return () => {
      element.removeEventListener('beforeinput', handleBeforeInput);
      element.removeEventListener('input', handleInput);
      element.removeEventListener('compositionstart', handleCompositionStart);
      element.removeEventListener('compositionend', handleCompositionEnd);
    };
  }, []);

  const onChange = useCallback((event: ChangeEvent<InputElement>) => {
    // 変換中（未確定）の中間 onChange は反映しない。compositionend でまとめて入れる。
    if (isComposing.current) return;
    latest.current.onValueChange(event.target.value);
  }, []);

  return { inputRef: ref, onChange };
}
