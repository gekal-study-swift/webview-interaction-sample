import type { NextConfig } from 'next';

import { basePath } from './base-path';

/**
 * GitHub Pages のプロジェクトサイト（https://<user>.github.io/<repo>/）で配信するため、
 * 静的エクスポート + リポジトリ名の basePath を指定する。
 */
const nextConfig: NextConfig = {
  output: 'export',
  basePath,
  assetPrefix: basePath || undefined,
  images: { unoptimized: true },
};

export default nextConfig;
