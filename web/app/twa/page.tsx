import type { Metadata } from 'next';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { basePath } from '../../base-path';
import { ThemeGate } from '../components/theme-gate';
import { ReturnButton } from './return-button';
import { TwaStatus } from './twa-status';

export const metadata: Metadata = {
  title: 'アプリ内表示の判定',
  description: 'このページがどこで表示されているかを判定して示す専用ページ',
};

/**
 * 表示のされ方を確かめるためのデモページ。
 *
 * メインのデモ画面をそのまま開くと、アプリ内で表示されているのか Safari なのかが
 * 見分けられないため、判定結果だけを大きく出す専用ページを分けている。
 *
 * Android 版では TWA として全画面表示されているかの判定に使っているページ。
 * iOS に TWA は無いため、判定内容を iOS の表示経路に合わせてある。
 */
export default function TwaPage() {
  return (
    <ThemeGate>
      <Box sx={{ minHeight: '100dvh', bgcolor: 'background.default' }}>
        <Container maxWidth="sm" component="main" sx={{ py: 4 }}>
          <Stack spacing={3}>
            <Stack spacing={1}>
              <Typography variant="overline" color="primary.main">
                Trusted Web Activity
              </Typography>
              <Typography variant="h1">アプリ内表示の判定ページ</Typography>
              <Typography variant="body2" color="text.secondary">
                iOS に Trusted Web Activity（URL バーを隠して全画面表示する仕組み）はありません。
                代わりに、このページが今どこで表示されているのかを、ページ自身が判定して表示します。
              </Typography>
            </Stack>

            <TwaStatus />

            <ReturnButton demoUrl={`${basePath}/index.html`} />
          </Stack>
        </Container>
      </Box>
    </ThemeGate>
  );
}
