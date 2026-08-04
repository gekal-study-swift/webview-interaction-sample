'use client';

import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import BoltIcon from '@mui/icons-material/Bolt';

import { useBridge } from '../bridge-provider';
import { monoFontFamily } from '../theme';
import { SectionCard } from './section-card';

export function NativeCallbackCard() {
  const { hydrated, requestCallback } = useBridge();
  const [delay, setDelay] = useState(1000);
  const [pendingSince, setPendingSince] = useState<number | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const request = async () => {
    setResult(null);
    setError(null);
    const startedAt = Date.now();
    setPendingSince(startedAt);
    try {
      const event = await requestCallback(delay);
      setResult(`${event.message ?? event.type} (実測 ${Date.now() - startedAt} ms)`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      setPendingSince(null);
    }
  };

  return (
    <SectionCard
      icon={<BoltIcon />}
      title="非同期コールバック"
      subheader="ネイティブが遅延して onNativeEvent() を呼び返す"
      badge="Native → JS"
      badgeColor="primary"
    >
      <Stack spacing={2}>
        <Stack spacing={1}>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="subtitle2">応答までの遅延</Typography>
            <Typography variant="caption" color="text.secondary">
              {delay} ms
            </Typography>
          </Stack>
          <Slider
            value={delay}
            min={0}
            max={5000}
            step={250}
            marks={[
              { value: 0, label: '0s' },
              { value: 2500, label: '2.5s' },
              { value: 5000, label: '5s' },
            ]}
            onChange={(_, value) => setDelay(value as number)}
            aria-label="コールバックの遅延 (ミリ秒)"
            valueLabelDisplay="auto"
            disabled={pendingSince !== null}
          />
        </Stack>

        <Button
          variant="contained"
          onClick={request}
          disabled={!hydrated || pendingSince !== null}
          startIcon={pendingSince !== null ? <CircularProgress size={16} color="inherit" /> : <BoltIcon />}
        >
          {pendingSince !== null ? '応答を待っています…' : 'コールバックを要求'}
        </Button>

        {result && (
          <Alert severity="success" variant="outlined">
            <Box sx={{ fontFamily: monoFontFamily, fontSize: 13, wordBreak: 'break-word' }}>{result}</Box>
          </Alert>
        )}
        {error && (
          <Alert severity="warning" variant="outlined">
            {error}
          </Alert>
        )}
      </Stack>
    </SectionCard>
  );
}
