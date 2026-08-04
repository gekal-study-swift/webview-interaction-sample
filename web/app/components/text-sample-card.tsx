'use client';

import Divider from '@mui/material/Divider';
import Link from '@mui/material/Link';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import PhoneIcon from '@mui/icons-material/Phone';
import TranslateIcon from '@mui/icons-material/Translate';

import { useBridge } from '../bridge-provider';
import { SectionCard } from './section-card';

/** 全角括弧などの描画確認用サンプル（移行前の index.html から引き継ぎ）。 */
const ITEMS = ['[※] First item（項目１）', '[※] Second item（項目２）', '[※] Third item（項目３）'];

/** 表示用と `tel:` 用で書式が異なる（tel: は区切り文字を含めない）。 */
const PHONE_LABEL = '03-1234-5678';
const PHONE_NUMBER = '+81312345678';

export function TextSampleCard() {
  const { log } = useBridge();

  return (
    <SectionCard
      icon={<TranslateIcon />}
      title="表示サンプル"
      subheader="全角文字のレンダリングと tel: リンク"
      badge="Web"
    >
      <Stack spacing={2}>
        <List dense disablePadding>
          {ITEMS.map((item) => (
            <ListItem key={item} disableGutters sx={{ py: 0.25 }}>
              <ListItemText primary={item} slotProps={{ primary: { variant: 'body2' } }} />
            </ListItem>
          ))}
        </List>

        <Divider />

        <Stack spacing={0.5}>
          <Typography variant="subtitle2" color="text.secondary">
            電話をかける
          </Typography>
          <Link
            href={`tel:${PHONE_NUMBER}`}
            underline="hover"
            variant="body1"
            sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, fontWeight: 600, width: 'fit-content' }}
            // tel: への遷移はネイティブ側が横取りするため、Web からは記録だけ行う
            onClick={() =>
              log({
                direction: 'js-to-native',
                level: 'info',
                label: `tel:${PHONE_NUMBER}`,
                detail: 'ネイティブが shouldOverrideUrlLoading で受け取り、電話アプリを開きます',
              })
            }
          >
            <PhoneIcon fontSize="small" />
            {PHONE_LABEL}
          </Link>
          <Typography variant="caption" color="text.secondary">
            WebView は <code>tel:</code> を自身で読み込もうとして失敗するため、ネイティブ側で発信アプリに渡しています。
          </Typography>
        </Stack>
      </Stack>
    </SectionCard>
  );
}
