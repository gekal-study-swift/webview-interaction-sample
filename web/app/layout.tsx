import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import CssBaseline from '@mui/material/CssBaseline';
import InitColorSchemeScript from '@mui/material/InitColorSchemeScript';
import { ThemeProvider } from '@mui/material/styles';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';

import { basePath } from '../base-path';
import { BootStyle } from './boot-style';
import theme from './theme';
import { VConsoleLoader } from './vconsole-loader';

export const metadata: Metadata = {
  title: 'WebView Example',
  description: 'Android WebView と JavaScript の相互作用デモ',
  // app/favicon.ico は link タグが自動生成されず、basePath 配下に置かれるため
  // ルートの /favicon.ico を見に行くブラウザからは解決できない。
  // ここで宣言すると icon.svg の自動生成タグも上書きされるので、両方を明示する。
  icons: {
    icon: [
      { url: `${basePath}/icon.svg`, type: 'image/svg+xml', sizes: 'any' },
      { url: `${basePath}/favicon.ico`, type: 'image/x-icon', sizes: '16x16 32x32 48x48' },
    ],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f2f6f5' },
    { media: '(prefers-color-scheme: dark)', color: '#0e1414' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <BootStyle />
      </head>
      <body>
        <InitColorSchemeScript attribute="class" defaultMode="system" />
        <AppRouterCacheProvider options={{ key: 'mui' }}>
          <ThemeProvider theme={theme} defaultMode="system">
            <CssBaseline />
            {children}
            <VConsoleLoader />
          </ThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
