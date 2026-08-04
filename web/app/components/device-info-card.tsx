'use client';

import { useCallback, useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import BatteryChargingFullIcon from '@mui/icons-material/BatteryChargingFull';
import MemoryIcon from '@mui/icons-material/Memory';
import RefreshIcon from '@mui/icons-material/Refresh';

import { useBridge } from '../bridge-provider';
import { monoFontFamily } from '../theme';
import { SectionCard } from './section-card';

const LABELS: Record<string, string> = {
  manufacturer: 'メーカー',
  model: 'モデル',
  androidVersion: 'Android バージョン',
  sdkInt: 'SDK レベル',
  appVersion: 'アプリバージョン',
  packageName: 'パッケージ名',
  locale: 'ロケール',
  timeZone: 'タイムゾーン',
};

interface BatteryStatus {
  level?: number;
  charging?: boolean;
}

export function DeviceInfoCard() {
  const { hydrated, supports, callNative } = useBridge();
  const [info, setInfo] = useState<Record<string, unknown> | null>(null);
  const [battery, setBattery] = useState<BatteryStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);

    const rawInfo = callNative<string>('getDeviceInfo');
    const rawBattery = callNative<string>('getBatteryStatus');

    try {
      setInfo(rawInfo ? (JSON.parse(rawInfo) as Record<string, unknown>) : null);
      setBattery(rawBattery ? (JSON.parse(rawBattery) as BatteryStatus) : null);
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : String(parseError));
    }
  }, [callNative]);

  // ネイティブ上で開かれている場合のみ自動取得する
  useEffect(() => {
    if (hydrated && supports('getDeviceInfo')) {
      load();
    }
  }, [hydrated, supports, load]);

  const available = hydrated && supports('getDeviceInfo');

  return (
    <SectionCard
      icon={<MemoryIcon />}
      title="端末情報"
      subheader="戻り値のある同期呼び出し（JSON 文字列）"
      badge="JS → Native"
      badgeColor="secondary"
      action={
        <Button size="small" startIcon={<RefreshIcon />} onClick={load} disabled={!hydrated}>
          更新
        </Button>
      }
    >
      <Stack spacing={2}>
        {!available && (
          <Alert severity="info" variant="outlined">
            ネイティブアプリ上で開くと端末情報を取得できます。
          </Alert>
        )}

        {error && (
          <Alert severity="error" variant="outlined">
            JSON の解析に失敗しました: {error}
          </Alert>
        )}

        {battery?.level !== undefined && (
          <Box>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
              <BatteryChargingFullIcon fontSize="small" color={battery.charging ? 'success' : 'action'} />
              <Typography variant="subtitle2">バッテリー {battery.level}%</Typography>
              <Typography variant="caption" color="text.secondary">
                {battery.charging ? '充電中' : '未充電'}
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={Math.min(100, Math.max(0, battery.level))}
              color={battery.charging ? 'success' : 'primary'}
              sx={{ height: 8, borderRadius: 999 }}
            />
          </Box>
        )}

        {info && (
          <Table size="small" sx={{ '& td': { borderBottomColor: 'divider' }, '& tr:last-of-type td': { border: 0 } }}>
            <TableBody>
              {Object.entries(info).map(([key, value]) => (
                <TableRow key={key}>
                  <TableCell sx={{ pl: 0, color: 'text.secondary', width: '45%' }}>{LABELS[key] ?? key}</TableCell>
                  <TableCell sx={{ pr: 0, fontFamily: monoFontFamily, wordBreak: 'break-all' }}>
                    {String(value)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Stack>
    </SectionCard>
  );
}
