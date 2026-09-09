/**
 * WebView に表示する Web ページの E2E テスト。
 *
 * 配信中のページをブラウザで開き、ネイティブが注入する `window.AndroidInterface` を
 * モックして、画面の表示とネイティブに渡す引数までを検証する。
 * 受け取ったあとのネイティブの挙動（トーストの表示、SFSafariViewController の起動など）は
 * ブラウザでは再現できないため対象外。
 *
 * 実行例:
 *
 * ```shell
 * ./scripts/test.sh                                            # 5 つのブラウザすべてで実行
 * ./scripts/test.sh e2e --project chromium                     # 1 つのブラウザだけで実行
 * ./scripts/test.sh e2e -- -g "外部リンク"                       # テスト名で絞り込む
 * ./scripts/test.sh e2e --url http://localhost:3000/index.html # ローカルの web/ を対象にする
 * ./scripts/test.sh e2e --ui                                   # UI モードで 1 件ずつ追う
 * ```
 *
 * 対象の URL は `e2e/.env` の `WEBVIEW_URL`（`--url` で上書きできる）。
 * モックしているブリッジの実物は `Webview Interaction Sample/WebViewController.swift` の
 * `bridgeScript()` にあり、型定義は `web/types/android.d.ts`。
 */
import { test, expect, type Page } from '@playwright/test';

const WEBVIEW_URL = process.env.WEBVIEW_URL ?? 'http://localhost:3000/index.html';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    // ネイティブ側が注入するブリッジをモックする。
    // iOS も Web ページに合わせて window.AndroidInterface の名前で公開している
    // （WebViewController.swift の bridgeScript()）。

    // getBatteryStatus() は同期的に値を返す必要があるため、iOS は変化のたびに
    // __updateBatteryStatus() で JS 側の値を差し替える。その形をそのまま真似る。
    let batteryStatus = JSON.stringify({ level: 55, charging: false });
    (window as any).__updateBatteryStatus = (json: string) => {
      batteryStatus = json;
    };

    (window as any).AndroidInterface = {
      showToast: (message: string, longDuration?: boolean) => {
        console.log(`Mocked AndroidInterface.showToast called with: ${message} (long=${longDuration ?? false})`);
        // Webviewのスクリプトを評価する
        (window as any).handleReturnValue('Hello from Mocked!');
      },
      // Android の Build に対応する値を iOS の名前で返す
      getDeviceInfo: () =>
        JSON.stringify({
          manufacturer: 'Apple',
          model: 'iPhone17,1',
          systemName: 'iOS',
          systemVersion: '26.0',
          appVersion: '1.0 (1)',
          bundleIdentifier: 'cn.gekal.ios.WebviewInteractionSample',
          locale: 'ja_JP',
          timeZone: 'Asia/Tokyo',
        }),
      getBatteryStatus: () => batteryStatus,
      vibrate: () => {},
      copyToClipboard: () => {},
      shareText: () => {},
      requestNativeCallback: (requestId: string, delayMillis: number) => {
        setTimeout(() => {
          (window as any).onNativeEvent(JSON.stringify({ type: 'callback', requestId, message: 'Mocked callback' }));
        }, delayMillis);
      },
      // ネイティブに通知された配色を検証できるよう記録しておく
      setAppTheme: (theme: string) => {
        (window as any).__appThemeCalls = [...((window as any).__appThemeCalls ?? []), theme];
      },
      // 実際にページを再読み込みするとモックが消えるため、呼び出しの記録だけを行う
      reloadPage: () => {
        (window as any).__pageCalls = [...((window as any).__pageCalls ?? []), 'reloadPage'];
      },
      simulateLoadError: () => {
        (window as any).__pageCalls = [...((window as any).__pageCalls ?? []), 'simulateLoadError'];
      },
      // 外部サイトの開き方は複数あり、どれが指定されたかを記録する
      openExternalLink: (url: string, mode: string) => {
        (window as any).__externalCalls = [...((window as any).__externalCalls ?? []), [mode, url]];
      },
    };
  });
});

const appThemeCalls = (page: Page) => page.evaluate(() => (window as any).__appThemeCalls ?? []);
const pageCalls = (page: Page) => page.evaluate(() => (window as any).__pageCalls ?? []);
const externalCalls = (page: Page) => page.evaluate(() => (window as any).__externalCalls ?? []);

const openDemo = async (page: Page) => {
  await page.goto(WEBVIEW_URL);
  // ハイドレーションが完了するとボタンが有効になる
  await expect(page.getByRole('button', { name: 'Show Toast' })).toBeEnabled();
};

test('should be able to run tests', async ({ page }, testInfo) => {
  await openDemo(page);
  await page.screenshot({
    path: `test-results/screenshots/${testInfo.title}/${testInfo.project.name}/after-loading.png`,
  });

  await page.getByRole('button', { name: 'Show Toast' }).click();
  await page.screenshot({
    path: `test-results/screenshots/${testInfo.title}/${testInfo.project.name}/after-click.png`,
  });

  await expect(page.locator('#message')).toHaveText('Received: Hello from Mocked!');
});

test('should render the device info returned by the native bridge', async ({ page }) => {
  await openDemo(page);

  // getDeviceInfo() / getBatteryStatus() は戻り値のある同期呼び出し。
  // iOS は androidVersion / sdkInt の代わりに systemName / systemVersion を返す
  await expect(page.getByRole('cell', { name: 'iPhone17,1' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'OS バージョン' })).toBeVisible();
  await expect(page.getByText('バッテリー 55%')).toBeVisible();
});

test('should show the battery status pushed from the native side', async ({ page }) => {
  await openDemo(page);
  await expect(page.getByText('バッテリー 55%')).toBeVisible();

  // iOS の getBatteryStatus() は問い合わせを受けてからネイティブに聞けないため、
  // ネイティブが変化のたびに __updateBatteryStatus() で先に値を渡している
  await page.evaluate(() => (window as any).__updateBatteryStatus(JSON.stringify({ level: 12, charging: true })));
  await page.getByRole('button', { name: '更新' }).click();

  await expect(page.getByText('バッテリー 12%')).toBeVisible();
  await expect(page.getByText('充電中', { exact: true })).toBeVisible();
});

test('should resolve the asynchronous native callback', async ({ page }) => {
  await openDemo(page);

  await page.getByRole('button', { name: 'コールバックを要求' }).click();

  // ネイティブが onNativeEvent() で呼び返すまで待つ
  await expect(page.getByRole('alert').filter({ hasText: 'Mocked callback' })).toBeVisible({
    timeout: 15000,
  });
});

test('should log every interaction between JS and native', async ({ page }) => {
  await openDemo(page);

  await page.getByRole('button', { name: 'Show Toast' }).click();

  const log = page.getByRole('list', { name: 'イベントログ' });
  await expect(log.getByText("showToast('Hello from WebView!')")).toBeVisible();
  await expect(log.getByText("handleReturnValue('Hello from Mocked!')")).toBeVisible();
});

test('should mirror the bridge input and output to the WebView console', async ({ page }) => {
  // vConsole が拾えるよう、ブリッジの往復を console にも出す
  const messages: string[] = [];
  page.on('console', (msg) => messages.push(msg.text()));

  await openDemo(page);
  await page.getByRole('button', { name: 'Show Toast' }).click();

  // JS → Native（出力）と Native → JS（入力）の両方が出る
  await expect
    .poll(() => messages.filter((m) => m.includes('[Bridge]')))
    .toEqual(
      expect.arrayContaining([
        expect.stringContaining("[Bridge] JS → Native: showToast('Hello from WebView!')"),
        expect.stringContaining("[Bridge] Native → JS: handleReturnValue('Hello from Mocked!')"),
      ]),
    );
});

test('should expose the phone number as a tel: link', async ({ page }) => {
  await openDemo(page);

  // ネイティブは decidePolicyFor でこの href を受け取り、電話アプリに渡す
  const phone = page.getByRole('link', { name: '03-1234-5678' });
  await expect(phone).toHaveAttribute('href', 'tel:+81312345678');

  // ブラウザでは tel: に遷移しないよう、クリックはせず記録だけ確認する
  await phone.evaluate((el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await expect(page.getByRole('list', { name: 'イベントログ' }).getByText('tel:+81312345678')).toBeVisible();
});

test.describe('リンクの種類', () => {
  // ネイティブは decidePolicyFor でこれらを受け取り、対応するアプリに渡す。
  // geo: は iOS に対応アプリが無いため、ネイティブ側で Apple マップの URL に変換する
  const CASES: Array<[string, string]> = [
    ['メールを作成', 'mailto:support@example.com?subject=WebView%20Interaction%20Sample'],
    ['SMS を作成', 'sms:+81312345678?body=WebView%20Interaction%20Sample'],
    ['地図で開く', 'geo:35.681236,139.767125?q=東京駅'],
  ];

  for (const [label, href] of CASES) {
    test(`should expose "${label}" as a link`, async ({ page }) => {
      await openDemo(page);
      await expect(page.getByRole('link', { name: new RegExp(label) })).toHaveAttribute('href', href);
    });
  }
});

test.describe('外部リンクの開き方', () => {
  const EXTERNAL_URL = 'https://developer.android.com/develop/ui/views/layout/webapps/webview';
  const APP_LINK_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
  // Android 版の TWA に相当するモード。iOS では自サイトの判定ページを Safari で開く
  const OWN_SITE_URL = 'https://webview-interaction-sample.ios.demo.gekal.cn/twa.html';

  // ボタンのラベル -> ネイティブに渡す ExternalOpenMode と URL。
  // モード名は Android 版と共通で、iOS 側が SFSafariViewController などに読み替える
  const MODES: Array<[string, string, string]> = [
    ['アプリ内オーバーレイ', 'IN_APP_OVERLAY', EXTERNAL_URL],
    ['Custom Tabs（全画面）', 'CUSTOM_TAB', EXTERNAL_URL],
    ['Custom Tabs（部分表示）', 'PARTIAL_CUSTOM_TAB', EXTERNAL_URL],
    ['Custom Tabs（事前ウォームアップ）', 'WARMED_CUSTOM_TAB', EXTERNAL_URL],
    ['対応アプリで開く（App Links）', 'APP_LINK', APP_LINK_URL],
    ['アプリを選ばせる', 'BROWSER_CHOOSER', EXTERNAL_URL],
    ['別タスクとして開く', 'NEW_DOCUMENT', EXTERNAL_URL],
    ['intent:// で開く', 'INTENT_URI', ''],
    ['Trusted Web Activity', 'TRUSTED_WEB_ACTIVITY', OWN_SITE_URL],
  ];

  for (const [label, mode, url] of MODES) {
    test(`should pass ${mode} to the native side`, async ({ page }) => {
      await openDemo(page);

      await page.getByRole('button', { name: label, exact: true }).click();

      await expect.poll(() => externalCalls(page)).toHaveLength(1);
      const calls = await externalCalls(page);

      expect(calls[0][0]).toBe(mode);
      if (url) {
        expect(calls[0][1]).toBe(url);
      } else {
        // intent:// はフォールバック URL を含む（iOS は fallback だけを開く）
        expect(calls[0][1]).toContain('intent://');
      }
    });
  }

  // window.open の戻り値は WKWebView とブラウザで挙動が違う（実機は null になりうる）。
  // 挙動に依存せずロジックを検証するため、window.open をスタブして戻り値を固定する。
  test('should not warn when the bridge is present even if window.open returns null', async ({ page }) => {
    // ブリッジあり（＝WebView 相当）。ネイティブが createWebViewWith で処理し、戻り値は null になりうる
    await page.addInitScript(() => {
      window.open = () => null;
    });
    await openDemo(page);

    await page.getByRole('button', { name: 'window.open() で開く' }).click();

    // 呼び出しはログに残るが、戻り値が null でも誤ってブロック警告を出さない。
    // log() と notify() は同じハンドラ内で呼ばれ同時に描画されるため、ログが出た時点で
    // 警告があるかを一発（リトライなし）で判定する。自動で消える前に確実に捕まえる。
    await expect(page.getByRole('list', { name: 'イベントログ' }).getByText('window.open(')).toBeVisible();
    expect(await page.getByText('ブロックされました').count()).toBe(0);
  });

  test('should warn about a real popup block only in a plain browser', async ({ page }) => {
    // ブリッジなし（素のブラウザ）で、window.open がブロックされて null を返す状況
    await page.addInitScript(() => {
      delete (window as any).AndroidInterface;
      window.open = () => null;
    });
    await page.goto(WEBVIEW_URL);

    await page.getByRole('button', { name: 'window.open() で開く' }).click();

    await expect(page.getByText('ブラウザにポップアップをブロックされました')).toBeVisible();
  });

  test('should not warn in a plain browser when the popup opens', async ({ page }) => {
    // ブリッジなしでも、window.open が成功（非 null）ならブロック警告は出さない
    await page.addInitScript(() => {
      delete (window as any).AndroidInterface;
      window.open = () => ({ closed: false }) as unknown as Window;
    });
    await page.goto(WEBVIEW_URL);

    await page.getByRole('button', { name: 'window.open() で開く' }).click();

    await expect(page.getByRole('list', { name: 'イベントログ' }).getByText('window.open(')).toBeVisible();
    expect(await page.getByText('ブロックされました').count()).toBe(0);
  });
});

test.describe('vConsole', () => {
  const withQuery = (q: string) => WEBVIEW_URL + (WEBVIEW_URL.includes('?') ? '&' : '?') + q;

  const openAndSettle = async (page: Page, url: string) => {
    await page.goto(url);
    await expect(page.getByRole('button', { name: 'Show Toast' })).toBeEnabled();
    // vConsole は動的 import で遅れて現れる。ハイドレーション直後に数えると、
    // キャッシュの有無で結果が変わってしまうため、読み込みが落ち着くまで待つ。
    await page.waitForLoadState('networkidle');
  };

  /** 実行環境カードが示している vConsole の状態（ビルド時フラグとクエリの合成結果）。 */
  const shownAsEnabled = async (page: Page) => {
    // フローティングボタン自体にも "vConsole" の文字があるため、カード内に絞って読む
    const card = page.locator('.MuiPaper-root').filter({ hasText: '実行環境' }).first();
    const row = card.getByText('vConsole', { exact: true }).locator('xpath=..');
    return (await row.innerText()).includes('有効');
  };

  test('should show vConsole when explicitly enabled', async ({ page }) => {
    await openAndSettle(page, withQuery('vconsole=1'));

    // vConsole のフローティングボタンが出る
    await expect(page.locator('.vc-switch')).toBeVisible();
    expect(await shownAsEnabled(page)).toBe(true);
  });

  test('should hide vConsole when explicitly disabled', async ({ page }) => {
    await openAndSettle(page, withQuery('vconsole=0'));

    await expect(page.locator('.vc-switch')).toHaveCount(0);
    expect(await shownAsEnabled(page)).toBe(false);
  });

  test('should follow the build flag when no query is given', async ({ page }) => {
    // 既定の有効・無効はビルド時フラグ NEXT_PUBLIC_VCONSOLE で決まり、配信ごとに変わる。
    // どちらであっても、実行環境カードの表示と実際の読み込みが食い違わないことを見る。
    await openAndSettle(page, WEBVIEW_URL);

    const enabled = await shownAsEnabled(page);
    await expect(page.locator('.vc-switch')).toHaveCount(enabled ? 1 : 0);
  });

  test('should not be changed by the env query', async ({ page }) => {
    // env=debug は表示上の環境名でしかなく、vConsole の有無には影響しない
    await openAndSettle(page, WEBVIEW_URL);
    const byDefault = await shownAsEnabled(page);

    await openAndSettle(page, withQuery('env=debug'));
    expect(await shownAsEnabled(page)).toBe(byDefault);
    await expect(page.locator('.vc-switch')).toHaveCount(byDefault ? 1 : 0);
  });
});

test.describe('アプリ内表示の判定ページ', () => {
  const statusUrl = () => WEBVIEW_URL.replace(/index\.html.*$/, 'twa.html');

  // Safari と SFSafariViewController の UA には Version/x.y … Safari/604.1 が付く。
  // WKWebView の UA は Mobile/15E148 で終わり Safari/ を含まない。
  // 判定はこの違いだけを見ているため、実行するブラウザの UA に依存しないよう固定する。
  const SAFARI_UA =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 ' +
    '(KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
  const WKWEBVIEW_UA =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';

  test('should report the main WebView when the bridge is injected', async ({ page }) => {
    // ブリッジを注入するのはアプリのメイン WebView だけ
    await page.goto(statusUrl());

    // 見出しと判定チップの両方に同じ文言が出るため、見出しは完全一致で絞る
    await expect(page.getByText('アプリのメイン WebView で表示中', { exact: true })).toBeVisible();
    await expect(page.getByText('判定: アプリのメイン WebView で表示中')).toBeVisible();
    await expect(page.getByText('そのままデモ画面へ移動します', { exact: false })).toBeVisible();
  });

  test.describe('ブリッジが無い場合', () => {
    // アプリ内オーバーレイと SFSafariViewController にはブリッジを注入しない
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(() => {
        delete (window as any).AndroidInterface;
      });
    });

    test.describe('WKWebView の UA', () => {
      test.use({ userAgent: WKWEBVIEW_UA });

      test('should report the in-app overlay', async ({ page }) => {
        await page.goto(statusUrl());

        await expect(page.getByText('アプリ内オーバーレイで表示中', { exact: true })).toBeVisible();
        await expect(page.getByText('UA に Safari/ を含まない')).toBeVisible();
      });
    });

    test.describe('Safari の UA', () => {
      test.use({ userAgent: SAFARI_UA });

      test('should report Safari / SFSafariViewController', async ({ page }) => {
        await page.goto(statusUrl());

        await expect(page.getByText('Safari / SFSafariViewController での表示', { exact: true })).toBeVisible();
        await expect(page.getByText('display-mode: standalone')).toBeVisible();
        // iOS でサイトとアプリを結び付けるのは Universal Links（Android の assetlinks.json に相当）
        await expect(page.getByRole('link', { name: '/.well-known/apple-app-site-association' })).toBeVisible();
      });
    });

    test('should navigate back to the demo page', async ({ page }) => {
      await page.goto(statusUrl());

      // iOS ではページ側から閉じられないため、戻るボタンは遷移だけを行う
      const back = page.getByRole('button', { name: 'デモ画面に戻る' });
      await expect(back).toBeEnabled();
      await expect(page.getByText('ページ側からこの画面を閉じられません', { exact: false })).toBeVisible();

      await back.click();

      await expect(page.getByRole('button', { name: 'Show Toast' })).toBeVisible();
    });
  });
});

test.describe('ページの読み込み', () => {
  test('should ask the native side to reload the page', async ({ page }) => {
    await openDemo(page);

    await page.getByRole('button', { name: '再読み込み' }).click();

    await expect.poll(() => pageCalls(page)).toEqual(['reloadPage']);
    await expect(page.getByRole('list', { name: 'イベントログ' }).getByText('reloadPage()')).toBeVisible();
  });

  test('should ask the native side to show the error screen', async ({ page }) => {
    await openDemo(page);

    await page.getByRole('button', { name: '読み込みエラーを再現' }).click();

    await expect.poll(() => pageCalls(page)).toEqual(['simulateLoadError']);
  });
});

test.describe('カラーテーマ', () => {
  const toggle = (page: Page) => page.getByRole('button', { name: 'カラーテーマを切り替える' });

  test('should notify the native side of the initial color scheme', async ({ page }) => {
    await openDemo(page);

    // 初回マウント時点でネイティブに反映されていないと、ステータスバー周辺の色が食い違う
    await expect.poll(() => appThemeCalls(page)).toEqual(['light']);
  });

  test.describe('システムがダークの場合', () => {
    test.use({ colorScheme: 'dark' });

    test('should switch on the first tap even when mode is still "system"', async ({ page }) => {
      await openDemo(page);

      // mode は 'system' のままだが、適用されている配色はダーク
      await expect.poll(() => appThemeCalls(page)).toEqual(['dark']);
      await expect(page.locator('html')).toHaveClass(/dark/);

      // 初回タップでライトへ切り替わること（mode === 'dark' 判定だとここが反応しなかった）
      await toggle(page).click();
      await expect(page.locator('html')).toHaveClass(/light/);
      await expect.poll(() => appThemeCalls(page)).toEqual(['dark', 'light']);

      await toggle(page).click();
      await expect(page.locator('html')).toHaveClass(/dark/);
      await expect.poll(() => appThemeCalls(page)).toEqual(['dark', 'light', 'dark']);
    });
  });
});
