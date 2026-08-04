'use client';

import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useColorScheme } from '@mui/material/styles';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import PhoneAndroidIcon from '@mui/icons-material/PhoneAndroid';

import { useBridge } from '../bridge-provider';

function ColorSchemeToggle() {
  // mode は 'system' を取りうるため、実際に適用されている colorScheme で判定する。
  // mode === 'dark' で判定すると、システムがダークの状態でも isDark が false になり、
  // 初回タップの setMode('dark') が現状と同じ配色を指定するだけで何も変わらない。
  const { colorScheme, setMode } = useColorScheme();

  // SSR と初回レンダリングでは colorScheme が undefined になる（= ライト扱い）
  const isDark = colorScheme === 'dark';

  return (
    <Tooltip title={isDark ? 'ライトモードに切り替え' : 'ダークモードに切り替え'}>
      <IconButton
        color="inherit"
        aria-label="カラーテーマを切り替える"
        onClick={() => setMode(isDark ? 'light' : 'dark')}
      >
        {isDark ? <LightModeIcon /> : <DarkModeIcon />}
      </IconButton>
    </Tooltip>
  );
}

export function AppHeader() {
  const { hydrated, connected } = useBridge();

  return (
    <AppBar
      position="sticky"
      sx={{
        backdropFilter: 'blur(12px)',
        backgroundColor: 'rgba(var(--mui-palette-background-defaultChannel) / 0.8)',
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <Toolbar sx={{ gap: 1.5 }}>
        <Box
          sx={{
            display: 'grid',
            placeItems: 'center',
            width: 38,
            height: 38,
            borderRadius: 2,
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            flexShrink: 0,
          }}
        >
          <PhoneAndroidIcon fontSize="small" />
        </Box>
        <Stack sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography variant="h1" component="h1" noWrap>
            WebView Example
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            Android WebView ⇄ JavaScript ブリッジ デモ
          </Typography>
        </Stack>
        <Chip
          size="small"
          variant={connected ? 'filled' : 'outlined'}
          color={connected ? 'success' : 'default'}
          icon={connected ? <LinkIcon /> : <LinkOffIcon />}
          label={!hydrated ? '確認中' : connected ? '接続済み' : '未接続'}
        />
        <ColorSchemeToggle />
      </Toolbar>
    </AppBar>
  );
}
