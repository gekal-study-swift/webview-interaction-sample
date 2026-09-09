'use client';

import { useState } from 'react';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import IosShareIcon from '@mui/icons-material/IosShare';
import TuneIcon from '@mui/icons-material/Tune';
import VibrationIcon from '@mui/icons-material/Vibration';

import { useBridge } from '../bridge-provider';
import { SectionCard } from './section-card';

const PATTERNS: Record<string, number> = { 短い: 80, 標準: 300, 長い: 800 };

export function SystemCard() {
  const { hydrated, callNative, notify } = useBridge();
  const [duration, setDuration] = useState(300);
  const [text, setText] = useState('WebView Interaction Sample');

  const copy = () => {
    callNative('copyToClipboard', ['WebView Sample', text]);
    notify('クリップボードへのコピーを依頼しました', 'info');
  };

  return (
    <SectionCard
      icon={<TuneIcon />}
      title="端末機能の呼び出し"
      subheader="バイブレーション・クリップボード・共有シート"
      badge="JS → Native"
      badgeColor="secondary"
    >
      <Stack spacing={2.5}>
        <Stack spacing={1}>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="subtitle2">バイブレーション</Typography>
            <Typography variant="caption" color="text.secondary">
              {duration} ms
            </Typography>
          </Stack>
          <Slider
            value={duration}
            min={50}
            max={1000}
            step={50}
            onChange={(_, value) => setDuration(value as number)}
            aria-label="バイブレーションの長さ (ミリ秒)"
            valueLabelDisplay="auto"
          />
          <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={duration}
              onChange={(_, value) => value !== null && setDuration(value as number)}
            >
              {Object.entries(PATTERNS).map(([label, value]) => (
                <ToggleButton key={label} value={value} sx={{ px: 1.5 }}>
                  {label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            <Button
              variant="contained"
              startIcon={<VibrationIcon />}
              onClick={() => callNative('vibrate', [duration])}
              disabled={!hydrated}
              sx={{ ml: 'auto' }}
            >
              振動させる
            </Button>
          </Stack>
        </Stack>

        <Divider />

        <Stack spacing={1.5}>
          <Typography variant="subtitle2">クリップボード / 共有</Typography>
          <TextField
            label="テキスト"
            value={text}
            onChange={(event) => setText(event.target.value)}
            multiline
            minRows={2}
          />
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<ContentCopyIcon />}
              onClick={copy}
              disabled={!hydrated || !text}
              fullWidth
            >
              コピー
            </Button>
            <Button
              variant="outlined"
              startIcon={<IosShareIcon />}
              onClick={() => callNative('shareText', [text])}
              disabled={!hydrated || !text}
              fullWidth
            >
              共有
            </Button>
          </Stack>
        </Stack>
      </Stack>
    </SectionCard>
  );
}
