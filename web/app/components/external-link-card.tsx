'use client';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import LaunchIcon from '@mui/icons-material/Launch';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

import { useBridge } from '../bridge-provider';
import { SectionCard } from './section-card';

/** 外部サイトの表示方法を見比べるためのサンプル URL。 */
const EXTERNAL_URL = 'https://developer.android.com/develop/ui/views/layout/webapps/webview';

/** App Links の確認用。対応アプリが入っていればそちらが開く。 */
const APP_LINK_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

/**
 * TWA は「自分のサイトをアプリとして出す」ための仕組みなので、自サイトを開く。
 * オリジン直下の /.well-known/assetlinks.json と manifest の asset_statements が対になって
 * 初めて URL バーが隠れる。
 */
const OWN_SITE_URL = 'https://webview-interaction-sample.demo.gekal.cn/twa.html';

/** `intent://` の例。対応アプリがなければ browser_fallback_url に落ちる。 */
const INTENT_URI =
  'intent://developer.android.com/#Intent;scheme=https;' +
  'S.browser_fallback_url=https%3A%2F%2Fdeveloper.android.com%2F;end';

interface OpenMode {
  /** ネイティブの ExternalOpenMode の名前。 */
  mode: string;
  label: string;
  detail: string;
  url?: string;
  /** 注意が必要な方式。 */
  caution?: string;
}

const MODES: OpenMode[] = [
  {
    mode: 'IN_APP_OVERLAY',
    label: 'アプリ内オーバーレイ',
    detail: '2 つ目の WebView を現在の画面に重ねる。ブラウザに依存せず見た目が一定',
    caution: '実サービスのログインには使えません（Google は WebView でのサインインを拒否）',
  },
  {
    mode: 'CUSTOM_TAB',
    label: 'Custom Tabs（全画面）',
    detail: 'ブラウザアプリが描画し、アプリと同じタスクに開く。OAuth ではこれが推奨',
  },
  {
    mode: 'PARTIAL_CUSTOM_TAB',
    label: 'Custom Tabs（部分表示）',
    detail: 'ボトムシート状に画面の一部だけ占有する。下にアプリが見えたまま重なる',
    caution:
      'CustomTabsSession を渡さないと全画面になります。高さは画面の 50% 以上が必要で、横向き・マルチウィンドウや未対応ブラウザでも全画面に落ちます',
  },
  {
    mode: 'WARMED_CUSTOM_TAB',
    label: 'Custom Tabs（事前ウォームアップ）',
    detail: 'サービスに接続して mayLaunchUrl() で先読みしてから開く。表示が速くなる',
  },
  {
    mode: 'APP_LINK',
    label: '対応アプリで開く（App Links）',
    detail: 'FLAG_ACTIVITY_REQUIRE_NON_BROWSER で、アプリがあればアプリ・無ければ Custom Tabs',
    url: APP_LINK_URL,
  },
  {
    mode: 'BROWSER_CHOOSER',
    label: 'アプリを選ばせる',
    detail: 'Intent.createChooser() で既定ブラウザに直行させない',
  },
  {
    mode: 'NEW_DOCUMENT',
    label: '別タスクとして開く',
    detail: 'FLAG_ACTIVITY_NEW_DOCUMENT で「最近のアプリ」に別項目として並ぶ',
  },
  {
    mode: 'INTENT_URI',
    label: 'intent:// で開く',
    detail: 'Intent.parseUri() でアプリを起動。対応アプリがなければ fallback URL へ',
    url: INTENT_URI,
    caution: 'component と selector を落として CATEGORY_BROWSABLE を強制しないと危険です',
  },
  {
    mode: 'TRUSTED_WEB_ACTIVITY',
    label: 'Trusted Web Activity',
    detail: '専用ページを開き、TWA として表示されているかをページ側が判定して見せる',
    url: OWN_SITE_URL,
    caution: '署名証明書が assetlinks.json の登録と一致しないと、通常の Custom Tabs 表示に落ちます',
  },
];

export function ExternalLinkCard() {
  const { hydrated, connected, callNative, log, notify } = useBridge();

  // window.open() は shouldOverrideUrlLoading を通らず、onCreateWindow で受け取る
  const openPopup = () => {
    log({
      direction: 'js-to-native',
      level: 'info',
      label: `window.open('${EXTERNAL_URL}')`,
      detail: 'ネイティブは WebChromeClient.onCreateWindow で受け取る',
    });

    // 'noopener' を付けると成功しても戻り値が必ず null になり、ブロックと区別できない。
    // ここは固定の信頼済み URL なので付けず、戻り値でブロックを判定できるようにする。
    const popup = window.open(EXTERNAL_URL, '_blank');

    // ブラウザで直接開いた場合のみ、ポップアップブロックを知らせる。
    // WebView ではネイティブが onCreateWindow で処理し、戻り値では成否を判断できないため対象外。
    if (!connected && popup === null) {
      notify('ブラウザにポップアップをブロックされました', 'warning');
    }
  };

  return (
    <SectionCard
      icon={<LaunchIcon />}
      title="外部リンクの開き方"
      subheader="Android が用意している方式を一通り試せます"
      badge="Web → Native"
      badgeColor="secondary"
    >
      <Stack spacing={2}>
        <Chip
          size="small"
          variant="outlined"
          icon={<OpenInNewIcon />}
          label={new URL(EXTERNAL_URL).host}
          sx={{ height: 22, fontSize: 11, alignSelf: 'flex-start' }}
        />

        {MODES.map((item) => (
          <Stack key={item.mode} spacing={0.75}>
            <Button
              variant={item.mode === 'CUSTOM_TAB' ? 'contained' : 'outlined'}
              onClick={() => callNative('openExternalLink', [item.url ?? EXTERNAL_URL, item.mode])}
              disabled={!hydrated}
              fullWidth
            >
              {item.label}
            </Button>
            <Typography variant="caption" color="text.secondary">
              {item.detail}
            </Typography>
            {item.caution && (
              <Typography variant="caption" color="warning.main">
                ⚠ {item.caution}
              </Typography>
            )}
          </Stack>
        ))}

        <Stack spacing={0.75}>
          <Button variant="outlined" onClick={openPopup} disabled={!hydrated} fullWidth>
            window.open() で開く
          </Button>
          <Typography variant="caption" color="text.secondary">
            ポップアップは shouldOverrideUrlLoading を通りません。ネイティブは setSupportMultipleWindows(true) と
            WebChromeClient.onCreateWindow で受け取り、同じ経路に流します。
          </Typography>
        </Stack>

        <Alert severity="info" variant="outlined">
          いずれも外部サイトを WebView 内には表示しません。ブラウザで開いた場合は呼び出しの記録だけを行います。
        </Alert>
      </Stack>
    </SectionCard>
  );
}
