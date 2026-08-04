/**
 * JavaScript の実行前に適用される、テーマ確定前用のスタイル。
 *
 * MUI は `colorSchemeSelector: 'class'` のため、`InitColorSchemeScript` が
 * `<html>` に `light` / `dark` クラスを付けるまで配色が決まらない。
 * その間の描画がライト固定にならないよう、`prefers-color-scheme` で
 * 背景色とローディング表示の色を先に決めておく。
 *
 * 値は `theme.ts` の `colorSchemes` と揃えること。
 */
const css = `
:root {
  color-scheme: light;
  --boot-bg: #f2f6f5;
  --boot-track: rgba(0, 0, 0, 0.12);
  --boot-accent: #00695f;
  background-color: var(--boot-bg);
}

@media (prefers-color-scheme: dark) {
  :root {
    color-scheme: dark;
    --boot-bg: #0e1414;
    --boot-track: rgba(255, 255, 255, 0.16);
    --boot-accent: #5fd4c0;
  }
}

/* ユーザーが明示的に選んだ配色は、システム設定より優先する */
:root.light {
  color-scheme: light;
  --boot-bg: #f2f6f5;
  --boot-track: rgba(0, 0, 0, 0.12);
  --boot-accent: #00695f;
}

:root.dark {
  color-scheme: dark;
  --boot-bg: #0e1414;
  --boot-track: rgba(255, 255, 255, 0.16);
  --boot-accent: #5fd4c0;
}

.boot-screen {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  background-color: var(--boot-bg);
}

.boot-spinner {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 3px solid var(--boot-track);
  border-top-color: var(--boot-accent);
  animation: boot-spin 0.8s linear infinite;
}

@keyframes boot-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .boot-spinner {
    animation-duration: 2.4s;
  }
}
`;

export function BootStyle() {
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
