'use client';

import { useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { monoFontFamily } from '../theme';

interface Detection {
  /** TWA / PWA として起動されると Chrome が standalone にする。 */
  standalone: boolean;
  /** TWA からの起動では `android-app://<パッケージ名>` になる。 */
  referrer: string;
  origin: string;
  path: string;
  userAgent: string;
}

/** `android-app://` から起動元のパッケージ名を取り出す。 */
const packageFromReferrer = (referrer: string) =>
  referrer.startsWith('android-app://') ? referrer.replace('android-app://', '').replace(/\/$/, '') : null;

export function TwaStatus() {
  const [detection, setDetection] = useState<Detection | null>(null);

  // window 依存の値は SSR と一致しないため、マウント後に取得する
  useEffect(() => {
    setDetection({
      standalone: window.matchMedia('(display-mode: standalone)').matches,
      referrer: document.referrer,
      origin: window.location.origin,
      path: window.location.pathname,
      userAgent: window.navigator.userAgent,
    });
  }, []);

  if (!detection) {
    return <Skeleton variant="rounded" height={220} />;
  }

  const launcher = packageFromReferrer(detection.referrer);
  // 2 つとも満たしていれば、検証を通った TWA として全画面表示されている
  const verified = detection.standalone && launcher !== null;

  return (
    <Stack spacing={3}>
      <Alert severity={verified ? 'success' : 'info'} variant="outlined">
        <AlertTitle>{verified ? '検証済みの TWA として表示中' : 'TWA としては表示されていません'}</AlertTitle>
        {verified ? (
          <>
            URL バーのない全画面で開かれています。このページのオリジンとアプリの署名が Digital Asset Links
            で結び付いていることを Chrome が確認できた状態です。
          </>
        ) : (
          <>
            通常のブラウザ / Custom Tabs での表示です。上部に URL バーがあるはずです。 アプリの「Trusted Web
            Activity」ボタンから開くと、検証が通っていれば URL バーが消えます。
          </>
        )}
      </Alert>

      <Box>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          判定に使っている値
        </Typography>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={1.5}>
            <Detected
              label="display-mode: standalone"
              ok={detection.standalone}
              value={detection.standalone ? 'true' : 'false'}
              hint="TWA / PWA として起動されると true になる"
            />
            <Divider />
            <Detected
              label="document.referrer"
              ok={launcher !== null}
              value={detection.referrer || '(空)'}
              hint="TWA からの起動では android-app://<パッケージ名> になる"
            />
            {launcher && (
              <Chip
                size="small"
                color="success"
                variant="outlined"
                label={`起動元: ${launcher}`}
                sx={{ alignSelf: 'flex-start' }}
              />
            )}
          </Stack>
        </Paper>
      </Box>

      <Box>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          このページ
        </Typography>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={0.5}>
            <Row label="オリジン" value={detection.origin} />
            <Row label="パス" value={detection.path} />
          </Stack>
        </Paper>
      </Box>

      <Box>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          検証の仕組み
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          TWA で URL バーが隠れるには、サイトとアプリが互いを指し示している必要があります。 片方でも欠けると Chrome は
          URL バーを表示したままにします（偽装を防ぐための仕様です）。
        </Typography>
        <Stack spacing={1}>
          <Paper variant="outlined" sx={{ p: 1.5 }}>
            <Typography variant="caption" color="text.secondary">
              サイト側
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: monoFontFamily, wordBreak: 'break-all' }}>
              <Link href="/.well-known/assetlinks.json">/.well-known/assetlinks.json</Link>
            </Typography>
            <Typography variant="caption" color="text.secondary">
              パッケージ名と署名証明書の SHA-256 を登録
            </Typography>
          </Paper>
          <Paper variant="outlined" sx={{ p: 1.5 }}>
            <Typography variant="caption" color="text.secondary">
              アプリ側
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: monoFontFamily, wordBreak: 'break-all' }}>
              AndroidManifest.xml の asset_statements
            </Typography>
            <Typography variant="caption" color="text.secondary">
              このページのオリジンを宣言
            </Typography>
          </Paper>
        </Stack>
      </Box>

      <Box>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          User Agent
        </Typography>
        <Typography variant="caption" sx={{ fontFamily: monoFontFamily, wordBreak: 'break-all' }}>
          {detection.userAgent}
        </Typography>
      </Box>
    </Stack>
  );
}

function Detected({ label, ok, value, hint }: { label: string; ok: boolean; value: string; hint: string }) {
  return (
    <Stack spacing={0.25}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Typography variant="body2" sx={{ fontFamily: monoFontFamily, fontWeight: 600 }}>
          {label}
        </Typography>
        <Chip size="small" color={ok ? 'success' : 'default'} variant="outlined" label={ok ? 'OK' : '該当なし'} />
      </Stack>
      <Typography variant="body2" sx={{ fontFamily: monoFontFamily, wordBreak: 'break-all' }}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {hint}
      </Typography>
    </Stack>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between' }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontFamily: monoFontFamily, textAlign: 'right', wordBreak: 'break-all' }}>
        {value}
      </Typography>
    </Stack>
  );
}
