'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import NorthEastIcon from '@mui/icons-material/NorthEast';
import SouthWestIcon from '@mui/icons-material/SouthWest';
import TerminalIcon from '@mui/icons-material/Terminal';

import { useBridge, type LogEntry } from '../bridge-provider';
import { monoFontFamily } from '../theme';
import { SectionCard } from './section-card';

const LEVEL_COLOR: Record<LogEntry['level'], string> = {
  info: 'text.secondary',
  success: 'success.main',
  warning: 'warning.main',
  error: 'error.main',
};

function DirectionIcon({ direction }: { direction: LogEntry['direction'] }) {
  if (direction === 'js-to-native') {
    return <NorthEastIcon sx={{ fontSize: 16, color: 'secondary.main' }} />;
  }
  if (direction === 'native-to-js') {
    return <SouthWestIcon sx={{ fontSize: 16, color: 'primary.main' }} />;
  }
  return <TerminalIcon sx={{ fontSize: 16, color: 'text.disabled' }} />;
}

export function EventLogCard() {
  const { logs, clearLogs } = useBridge();

  return (
    <SectionCard
      icon={<TerminalIcon />}
      title="イベントログ"
      subheader="JS ⇄ Native のやり取りを時系列で記録"
      action={
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Chip size="small" label={logs.length} />
          <Button
            size="small"
            color="inherit"
            startIcon={<DeleteSweepIcon />}
            onClick={clearLogs}
            disabled={!logs.length}
          >
            消去
          </Button>
        </Stack>
      }
    >
      {logs.length === 0 ? (
        <Typography variant="body2" color="text.disabled">
          まだ記録がありません。
        </Typography>
      ) : (
        <Stack
          component="ul"
          spacing={1}
          sx={{ listStyle: 'none', m: 0, p: 0, maxHeight: 320, overflowY: 'auto' }}
          aria-label="イベントログ"
        >
          {logs.map((entry) => (
            <Stack key={entry.id} component="li" direction="row" spacing={1.25} sx={{ alignItems: 'flex-start' }}>
              <Box sx={{ pt: 0.25 }}>
                <DirectionIcon direction={entry.direction} />
              </Box>
              <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                <Typography
                  variant="body2"
                  sx={{ fontFamily: monoFontFamily, color: LEVEL_COLOR[entry.level], wordBreak: 'break-word' }}
                >
                  {entry.label}
                </Typography>
                {entry.detail && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      display: '-webkit-box',
                      WebkitBoxOrient: 'vertical',
                      WebkitLineClamp: 3,
                      overflow: 'hidden',
                      wordBreak: 'break-all',
                    }}
                  >
                    {entry.detail}
                  </Typography>
                )}
              </Box>
              <Typography variant="caption" color="text.disabled" sx={{ fontFamily: monoFontFamily, flexShrink: 0 }}>
                {entry.at}
              </Typography>
            </Stack>
          ))}
        </Stack>
      )}
    </SectionCard>
  );
}
