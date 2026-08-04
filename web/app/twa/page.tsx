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
  title: 'Trusted Web Activity デモ',
  description: 'TWA として起動されているかを判定して表示する専用ページ',
};

/**
 * TWA 専用のデモページ。
 *
 * メインのデモ画面をそのまま開くと、TWA で表示されているのか通常のブラウザなのかが
 * 見分けられないため、判定結果だけを大きく出す専用ページを分けている。
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
              <Typography variant="h1">TWA 判定ページ</Typography>
              <Typography variant="body2" color="text.secondary">
                このページが Trusted Web Activity として全画面表示されているかどうかを、ページ自身が判定して表示します。
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
