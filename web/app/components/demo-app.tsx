'use client';

import { useEffect } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useColorScheme } from '@mui/material/styles';

import { BridgeProvider, useBridge } from '../bridge-provider';
import { AppHeader } from './app-header';
import { DeviceInfoCard } from './device-info-card';
import { EnvironmentCard } from './environment-card';
import { EventLogCard } from './event-log-card';
import { ExternalLinkCard } from './external-link-card';
import { LinkCard } from './link-card';
import { NativeCallbackCard } from './native-callback-card';
import { PageControlCard } from './page-control-card';
import { SystemCard } from './system-card';
import { TextSampleCard } from './text-sample-card';
import { ThemeGate } from './theme-gate';
import { ToastCard } from './toast-card';

/**
 * Web の配色をネイティブ側にも反映させる。
 * ステータスバー / ナビゲーションバー周辺の余白が WebView の背景と食い違わないよう、
 * 初回マウント時と切り替え時の両方で通知する。
 */
function NativeThemeSync() {
  const { colorScheme } = useColorScheme();
  const { hydrated, supports, callNative } = useBridge();

  useEffect(() => {
    if (!hydrated || !colorScheme || !supports('setAppTheme')) {
      return;
    }
    callNative('setAppTheme', [colorScheme]);
  }, [hydrated, colorScheme, supports, callNative]);

  return null;
}

function NoticeSnackbar() {
  const { notice, dismissNotice } = useBridge();

  return (
    <Snackbar
      open={Boolean(notice)}
      autoHideDuration={4000}
      onClose={dismissNotice}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert onClose={dismissNotice} severity={notice?.level === 'success' ? 'success' : (notice?.level ?? 'info')}>
        {notice?.message}
      </Alert>
    </Snackbar>
  );
}

export function DemoApp() {
  return (
    <BridgeProvider>
      <NativeThemeSync />
      <ThemeGate>
        <Box sx={{ minHeight: '100dvh', bgcolor: 'background.default' }}>
          <AppHeader />
          <Container maxWidth="sm" component="main" sx={{ py: 3 }}>
            <Stack spacing={2}>
              <ToastCard />
              <NativeCallbackCard />
              <DeviceInfoCard />
              <SystemCard />
              <EnvironmentCard />
              <PageControlCard />
              <TextSampleCard />
              <LinkCard />
              <ExternalLinkCard />
              <EventLogCard />
            </Stack>
            <Typography variant="caption" color="text.disabled" component="p" sx={{ mt: 3, textAlign: 'center' }}>
              Next.js (静的エクスポート) + MUI / GitHub Pages で配信
            </Typography>
          </Container>
        </Box>
      </ThemeGate>
      <NoticeSnackbar />
    </BridgeProvider>
  );
}
