'use client';

import type { ReactNode } from 'react';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import EmailIcon from '@mui/icons-material/Email';
import LayersIcon from '@mui/icons-material/Layers';
import OpenInBrowserIcon from '@mui/icons-material/OpenInBrowser';
import LinkIcon from '@mui/icons-material/Link';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PlaceIcon from '@mui/icons-material/Place';
import SmsIcon from '@mui/icons-material/Sms';

import { useBridge } from '../bridge-provider';
import { SectionCard } from './section-card';

interface LinkSample {
  icon: ReactNode;
  label: string;
  href: string;
  /** ネイティブ側がどう扱うかの説明。 */
  handledBy: string;
}

const LINKS: LinkSample[] = [
  {
    icon: <EmailIcon />,
    label: 'メールを作成',
    href: 'mailto:support@example.com?subject=WebView%20Interaction%20Sample',
    handledBy: 'ACTION_SENDTO でメールアプリへ',
  },
  {
    icon: <SmsIcon />,
    label: 'SMS を作成',
    href: 'sms:+81312345678?body=WebView%20Interaction%20Sample',
    handledBy: 'ACTION_SENDTO で SMS アプリへ',
  },
  {
    icon: <PlaceIcon />,
    label: '地図で開く',
    href: 'geo:35.681236,139.767125?q=東京駅',
    handledBy: 'ACTION_VIEW で地図アプリへ',
  },
];

export function LinkCard() {
  const { log } = useBridge();

  return (
    <SectionCard
      icon={<LinkIcon />}
      title="リンクの種類"
      subheader="WebView が自身で読み込めないスキームの動作確認"
      badge="Web → Native"
      badgeColor="secondary"
    >
      <Stack spacing={1.5}>
        <List dense disablePadding>
          {LINKS.map((link) => (
            <ListItemButton
              key={link.href}
              component="a"
              href={link.href}
              disableGutters
              sx={{ borderRadius: 2, px: 1 }}
              // 遷移はネイティブ側が横取りするため、Web からは記録だけ行う
              onClick={() =>
                log({
                  direction: 'js-to-native',
                  level: 'info',
                  label: link.href,
                  detail: link.handledBy,
                })
              }
            >
              <ListItemIcon sx={{ minWidth: 36, color: 'primary.main' }}>{link.icon}</ListItemIcon>
              <ListItemText
                primary={link.label}
                secondary={link.handledBy}
                slotProps={{
                  primary: { variant: 'body2', sx: { fontWeight: 600 } },
                  secondary: { variant: 'caption' },
                }}
              />
              <Chip
                size="small"
                variant="outlined"
                label={`${link.href.split(':')[0]}:`}
                sx={{ height: 20, fontSize: 11 }}
              />
            </ListItemButton>
          ))}
        </List>

        <Typography variant="caption" color="text.secondary">
          電話（<code>tel:</code>）は「表示サンプル」、外部サイトは「外部リンクの開き方」にあります。ネイティブは{' '}
          <code>shouldOverrideUrlLoading</code> でこれらを受け取り、対応するアプリへ渡します。
        </Typography>
      </Stack>
    </SectionCard>
  );
}
