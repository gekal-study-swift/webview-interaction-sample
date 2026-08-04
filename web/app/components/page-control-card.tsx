'use client';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import RefreshIcon from '@mui/icons-material/Refresh';
import RestartAltIcon from '@mui/icons-material/RestartAlt';

import { useBridge } from '../bridge-provider';
import { SectionCard } from './section-card';

export function PageControlCard() {
  const { hydrated, connected, callNative } = useBridge();

  // ネイティブが無い環境では location.reload() で代替する
  const reload = () => {
    if (connected) {
      callNative('reloadPage');
    } else {
      window.location.reload();
    }
  };

  return (
    <SectionCard
      icon={<RestartAltIcon />}
      title="ページの読み込み"
      subheader="再読み込みと、エラー画面の確認"
      badge="JS → Native"
      badgeColor="secondary"
    >
      <Stack spacing={2}>
        <Stack spacing={1}>
          <Button variant="contained" startIcon={<RefreshIcon />} onClick={reload} disabled={!hydrated} fullWidth>
            再読み込み
          </Button>
          <Typography variant="caption" color="text.secondary">
            ネイティブ上では <code>reloadPage()</code>、ブラウザでは <code>location.reload()</code> を実行します。
          </Typography>
        </Stack>

        <Stack spacing={1}>
          <Button
            variant="outlined"
            color="warning"
            startIcon={<CloudOffIcon />}
            onClick={() => callNative('simulateLoadError')}
            disabled={!hydrated}
            fullWidth
          >
            読み込みエラーを再現
          </Button>
          <Typography variant="caption" color="text.secondary">
            到達できない URL を読み込み、ネイティブのエラー画面を表示します。「再試行」で元のページに戻れます。
          </Typography>
        </Stack>

        {hydrated && !connected && (
          <Alert severity="info" variant="outlined">
            エラー画面はネイティブアプリ側の表示です。ブラウザでは再現できません。
          </Alert>
        )}
      </Stack>
    </SectionCard>
  );
}
