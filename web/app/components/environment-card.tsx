'use client';

import { useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';

import { useBridge } from '../bridge-provider';
import { monoFontFamily } from '../theme';
import { isVConsoleEnabled } from '../vconsole-config';
import { SectionCard } from './section-card';

interface WebEnvironment {
  env: string;
  userAgent: string;
  viewport: string;
  pixelRatio: string;
  language: string;
  vConsole: boolean;
}

export function EnvironmentCard() {
  const { hydrated, connected, availableMethods } = useBridge();
  const [web, setWeb] = useState<WebEnvironment | null>(null);

  // window 依存の値は SSR と一致しないため、マウント後に取得する
  useEffect(() => {
    setWeb({
      env: new URLSearchParams(window.location.search).get('env') ?? '(未指定)',
      userAgent: window.navigator.userAgent,
      viewport: `${window.innerWidth} × ${window.innerHeight}`,
      pixelRatio: String(window.devicePixelRatio),
      language: window.navigator.language,
      vConsole: isVConsoleEnabled(window.location.search),
    });
  }, []);

  const rows: Array<[string, string]> = web
    ? [
        ['env クエリ', web.env],
        ['vConsole', web.vConsole ? '有効' : '無効'],
        ['ビューポート', web.viewport],
        ['DPR', web.pixelRatio],
        ['言語', web.language],
      ]
    : [];

  return (
    <SectionCard
      icon={<TravelExploreIcon />}
      title="実行環境"
      subheader="ブリッジの検出状況と WebView の情報"
      badge="Web"
    >
      <Stack spacing={2}>
        {hydrated && !connected && (
          <Alert severity="warning" variant="outlined">
            <code>window.AndroidInterface</code> が見つかりません。ブラウザで表示しているため、JS → Native
            の呼び出しは記録のみ行われます。
          </Alert>
        )}

        <Stack spacing={0.75}>
          <Typography variant="subtitle2" color="text.secondary">
            利用可能なネイティブメソッド
          </Typography>
          {!hydrated ? (
            <Skeleton variant="rounded" height={32} />
          ) : availableMethods.length > 0 ? (
            <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap' }}>
              {availableMethods.map((method) => (
                <Chip key={method} size="small" label={`${method}()`} color="primary" variant="outlined" />
              ))}
            </Stack>
          ) : (
            <Typography variant="body2" color="text.disabled">
              検出されませんでした
            </Typography>
          )}
        </Stack>

        <Stack spacing={0.5}>
          {rows.map(([label, value]) => (
            <Stack key={label} direction="row" spacing={2} sx={{ justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">
                {label}
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: monoFontFamily, textAlign: 'right' }}>
                {value}
              </Typography>
            </Stack>
          ))}
          {!web && <Skeleton variant="rounded" height={72} />}
        </Stack>

        {web && (
          <Stack spacing={0.5}>
            <Typography variant="subtitle2" color="text.secondary">
              User Agent
            </Typography>
            <Typography variant="caption" sx={{ fontFamily: monoFontFamily, wordBreak: 'break-all' }}>
              {web.userAgent}
            </Typography>
          </Stack>
        )}
      </Stack>
    </SectionCard>
  );
}
