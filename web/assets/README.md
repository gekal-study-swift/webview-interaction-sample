# アイコンのソース

| ファイル | 用途 |
| --- | --- |
| `../public/icon.svg` | モダンブラウザ向けの SVG アイコン（`app/layout.tsx` の `metadata.icons` で参照）。48px 以上の `favicon.ico` にも使う |
| `favicon-small.svg` | `favicon.ico` の 16px / 32px 用。`public/icon.svg` のブラウザウィンドウは小サイズだと潰れるため、双方向 (⇄) だけを大きく描いた簡略版 |

Android のランチャーアイコン (`app/src/main/res/drawable/ic_launcher_foreground.xml`) も同じデザインです。

## `public/favicon.ico` の再生成

`rsvg-convert`（librsvg）と Python を使います。

```bash
cd web
for s in 16 32; do rsvg-convert assets/favicon-small.svg -w $s -h $s -o /tmp/ico-$s.png; done
for s in 48 64 128 256; do rsvg-convert public/icon.svg -w $s -h $s -o /tmp/ico-$s.png; done
python3 assets/build-favicon.py
```
