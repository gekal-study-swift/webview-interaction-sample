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
  /** ホーム画面に追加した PWA として起動されると true になる。 */
  standalone: boolean;
  /** UA に `Safari/` が無ければ WKWebView（アプリ内表示）。 */
  webView: boolean;
  /** アプリがブリッジを注入しているか。注入されるのはメインの WebView だけ。 */
  bridge: boolean;
  origin: string;
  path: string;
  userAgent: string;
}

/**
 * Safari と WKWebView の判別。
 *
 * Safari と SFSafariViewController の UA には `Version/x.y … Safari/604.1` が付くが、
 * WKWebView の UA は `Mobile/15E148` で終わり `Safari/` を含まない。
 */
const isWebViewUserAgent = (userAgent: string) => !/Safari\//.test(userAgent);

/** このページの表示のされ方。iOS で取りうる 3 通り。 */
type Surface = 'app-webview' | 'in-app-overlay' | 'safari';

function detectSurface(detection: Detection): Surface {
  if (detection.bridge) return 'app-webview';
  return detection.webView ? 'in-app-overlay' : 'safari';
}

const SURFACE_TEXT: Record<Surface, { title: string; body: string; severity: 'success' | 'info' }> = {
  'app-webview': {
    title: 'アプリのメイン WebView で表示中',
    body: 'アプリが注入したブリッジ（AndroidInterface）を検出しました。デモ画面と同じ WebView です。',
    severity: 'success',
  },
  'in-app-overlay': {
    title: 'アプリ内オーバーレイで表示中',
    body: 'ブリッジは無く、UA は WKWebView のものです。アプリが重ねて表示している 2 つ目の WebView で、URL バーはありません。',
    severity: 'success',
  },
  safari: {
    title: 'Safari / SFSafariViewController での表示',
    body: '上部に URL バーがあるはずです。iOS では SFSafariViewController の URL バーを隠せないため、TWA のような全画面表示にはなりません。',
    severity: 'info',
  },
};

export function TwaStatus() {
  const [detection, setDetection] = useState<Detection | null>(null);

  // window 依存の値は SSR と一致しないため、マウント後に取得する
  useEffect(() => {
    const userAgent = window.navigator.userAgent;
    setDetection({
      standalone: window.matchMedia('(display-mode: standalone)').matches,
      webView: isWebViewUserAgent(userAgent),
      bridge: Boolean(window.AndroidInterface),
      origin: window.location.origin,
      path: window.location.pathname,
      userAgent,
    });
  }, []);

  if (!detection) {
    return <Skeleton variant="rounded" height={220} />;
  }

  const surface = detectSurface(detection);
  const text = SURFACE_TEXT[surface];

  return (
    <Stack spacing={3}>
      <Alert severity={text.severity} variant="outlined">
        <AlertTitle>{text.title}</AlertTitle>
        {text.body}
      </Alert>

      <Box>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          判定に使っている値
        </Typography>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={1.5}>
            <Detected
              label="window.AndroidInterface"
              ok={detection.bridge}
              value={detection.bridge ? 'あり' : 'なし'}
              hint="アプリがブリッジを注入するのはメインの WebView だけ"
            />
            <Divider />
            <Detected
              label="UA に Safari/ を含まない"
              ok={detection.webView}
              value={detection.webView ? 'true' : 'false'}
              hint="WKWebView の UA は Mobile/15E148 で終わり、Safari/ が付かない"
            />
            <Divider />
            <Detected
              label="display-mode: standalone"
              ok={detection.standalone}
              value={detection.standalone ? 'true' : 'false'}
              hint="ホーム画面に追加した PWA として起動すると true になる"
            />
            <Chip
              size="small"
              color={surface === 'safari' ? 'default' : 'success'}
              variant="outlined"
              label={`判定: ${text.title}`}
              sx={{ alignSelf: 'flex-start' }}
            />
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
          サイトとアプリを結び付ける仕組み
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Android の Trusted Web Activity は、サイトとアプリが互いを指し示していることを Chrome
          が確認できたときだけ URL バーを隠します。iOS に URL バーを隠す仕組みはありませんが、
          「サイトとアプリが同じ持ち主であることを確認する」部分は Universal Links が担っています。
          検証が通ると、他のアプリからこのサイトのリンクを開いたときに Safari ではなくアプリが起動します。
        </Typography>
        <Stack spacing={1}>
          <Paper variant="outlined" sx={{ p: 1.5 }}>
            <Typography variant="caption" color="text.secondary">
              サイト側
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: monoFontFamily, wordBreak: 'break-all' }}>
              <Link href="/.well-known/apple-app-site-association">/.well-known/apple-app-site-association</Link>
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Team ID と Bundle ID を登録（Android の assetlinks.json に相当）
            </Typography>
          </Paper>
          <Paper variant="outlined" sx={{ p: 1.5 }}>
            <Typography variant="caption" color="text.secondary">
              アプリ側
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: monoFontFamily, wordBreak: 'break-all' }}>
              Associated Domains エンタイトルメント
            </Typography>
            <Typography variant="caption" color="text.secondary">
              このページのオリジンを applinks: で宣言。有料の Apple Developer Program が必要
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
