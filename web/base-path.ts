/**
 * 配信元のパス。
 *
 * カスタムドメイン (webview-interaction-sample.demo.gekal.cn) でルート配信しているため既定は空。
 * `<user>.github.io/<repo>/` 形式のプロジェクトサイトに戻す場合は
 * `BASE_PATH=/webview-interaction-sample` を指定する。
 *
 * `next.config.ts` と、アイコンなど自前で URL を組み立てるメタデータの両方から参照する。
 */
export const basePath = process.env.BASE_PATH ?? '';
