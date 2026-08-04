'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CampaignIcon from '@mui/icons-material/Campaign';
import SendIcon from '@mui/icons-material/Send';
import SouthWestIcon from '@mui/icons-material/SouthWest';

import { useBridge } from '../bridge-provider';
import { monoFontFamily } from '../theme';
import { SectionCard } from './section-card';

export function ToastCard() {
  const { hydrated, callNative, returnValue } = useBridge();
  const [message, setMessage] = useState('Hello from WebView!');
  const [longDuration, setLongDuration] = useState(false);

  const showToast = () => {
    // 引数 1 個 / 2 個で別のネイティブメソッド（オーバーロード）が呼ばれる
    callNative('showToast', longDuration ? [message, true] : [message]);
  };

  return (
    <SectionCard
      icon={<CampaignIcon />}
      title="トースト表示"
      subheader="JS から呼び出し、ネイティブが応答を返す往復デモ"
      badge="JS → Native → JS"
      badgeColor="primary"
    >
      <Stack spacing={2}>
        <TextField
          label="メッセージ"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          slotProps={{ htmlInput: { 'aria-label': 'トーストのメッセージ' } }}
        />
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}
        >
          <FormControlLabel
            control={<Switch checked={longDuration} onChange={(event) => setLongDuration(event.target.checked)} />}
            label={longDuration ? 'LENGTH_LONG' : 'LENGTH_SHORT'}
          />
          {/* E2E テストはアクセシブル名 "Show Toast" でこのボタンを探す */}
          <Button variant="contained" endIcon={<SendIcon />} onClick={showToast} disabled={!hydrated || !message}>
            Show Toast
          </Button>
        </Stack>

        <Paper
          variant="outlined"
          sx={{
            p: 1.5,
            bgcolor: 'action.hover',
            borderStyle: returnValue ? 'solid' : 'dashed',
            borderColor: returnValue ? 'success.main' : 'divider',
          }}
        >
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
            <SouthWestIcon fontSize="small" color={returnValue ? 'success' : 'disabled'} />
            <Typography variant="subtitle2" color="text.secondary">
              handleReturnValue() の受信内容
            </Typography>
          </Stack>
          <Box
            id="message"
            sx={{
              fontFamily: monoFontFamily,
              fontSize: 14,
              wordBreak: 'break-word',
              minHeight: 20,
              color: returnValue ? 'text.primary' : 'text.disabled',
            }}
          >
            {returnValue ? `Received: ${returnValue}` : ''}
          </Box>
          {!returnValue && (
            <Typography variant="caption" color="text.disabled">
              まだ受信していません
            </Typography>
          )}
        </Paper>
      </Stack>
    </SectionCard>
  );
}
