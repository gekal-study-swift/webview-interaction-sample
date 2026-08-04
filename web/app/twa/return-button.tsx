'use client';

import { useEffect, useState } from 'react';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';

/**
 * デモ画面へ戻るボタン。
 *
 * Android 版では TWA / Custom Tabs を `window.close()` で閉じてアプリに戻れるが、
 * iOS の SFSafariViewController とアプリ内オーバーレイはページ側から閉じられない。
 * そのため、どこで表示されていてもデモ画面への遷移だけを行い、
 * アプリに戻るには画面上のどのボタンを押せばよいかを案内する。
 */
export function ReturnButton({ demoUrl }: { demoUrl: string }) {
  const [inWebView, setInWebView] = useState<boolean | null>(null);

  useEffect(() => {
    // ブリッジが注入されているのはアプリのメイン WebView だけ
    setInWebView(Boolean(window.AndroidInterface));
  }, []);

  return (
    <Stack spacing={0.5}>
      <Button
        variant="outlined"
        onClick={() => {
          window.location.href = demoUrl;
        }}
        disabled={inWebView === null}
        fullWidth
      >
        デモ画面に戻る
      </Button>
      <Typography variant="caption" color="text.secondary">
        {inWebView
          ? 'アプリのメイン WebView で表示されているため、そのままデモ画面へ移動します。'
          : 'iOS ではページ側からこの画面を閉じられません。アプリに戻るには、上部の「完了」または「✕」を押してください。'}
      </Typography>
    </Stack>
  );
}
