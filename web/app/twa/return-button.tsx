'use client';

import { useEffect, useState } from 'react';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';

/** 閉じられなかったときに遷移へ切り替えるまでの待ち時間。 */
const CLOSE_FALLBACK_MS = 300;

interface Context {
  /** TWA / Custom Tabs として開かれている（＝閉じればアプリに戻る）。 */
  launchedFromApp: boolean;
  /** アプリの WebView 内で表示されている（＝閉じる対象がない）。 */
  inWebView: boolean;
}

/**
 * TWA / Custom Tabs で開かれている場合は「閉じて」アプリに戻る。
 *
 * このページは Chrome 側で動くため `AndroidInterface` は注入されない。
 * ブリッジがあるのはアプリの WebView に読み込まれたときだけで、
 * その場合は閉じる対象がないのでデモ画面へ遷移する。
 */
export function ReturnButton({ demoUrl }: { demoUrl: string }) {
  const [context, setContext] = useState<Context | null>(null);

  useEffect(() => {
    setContext({
      launchedFromApp:
        window.matchMedia('(display-mode: standalone)').matches || document.referrer.startsWith('android-app://'),
      inWebView: Boolean(window.AndroidInterface),
    });
  }, []);

  const shouldClose = context?.launchedFromApp === true && !context.inWebView;

  const handleClick = () => {
    if (!shouldClose) {
      window.location.href = demoUrl;
      return;
    }

    // TWA / Custom Tabs は自分で閉じられる
    window.close();

    // 閉じられない環境ではページが残るため、遷移に切り替える
    window.setTimeout(() => {
      window.location.href = demoUrl;
    }, CLOSE_FALLBACK_MS);
  };

  return (
    <Stack spacing={0.5}>
      <Button variant="outlined" onClick={handleClick} disabled={context === null} fullWidth>
        {shouldClose ? 'アプリに戻る' : 'デモ画面に戻る'}
      </Button>
      <Typography variant="caption" color="text.secondary">
        {shouldClose
          ? 'このページを閉じてアプリに戻ります。閉じられない場合はデモ画面へ移動します。'
          : 'アプリから開かれていないため、デモ画面へ移動します。'}
      </Typography>
    </Stack>
  );
}
