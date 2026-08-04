/**
 * vConsole を有効にするかの判定。ローダーと表示（実行環境カード）で共有する。
 *
 * 既定は **ビルド時フラグ** `NEXT_PUBLIC_VCONSOLE`（`true` / `1` で有効）。Next.js が
 * `next build` 時にインライン展開する。URL の `?vconsole=1` / `0` があればそちらで上書きする。
 */
export const VCONSOLE_BUILD_ENABLED =
  process.env.NEXT_PUBLIC_VCONSOLE === 'true' || process.env.NEXT_PUBLIC_VCONSOLE === '1';

export function isVConsoleEnabled(search: string): boolean {
  const flag = new URLSearchParams(search).get('vconsole');
  if (flag === '1' || flag === 'true') return true;
  if (flag === '0' || flag === 'false') return false;
  return VCONSOLE_BUILD_ENABLED;
}
