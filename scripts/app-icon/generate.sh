#!/usr/bin/env bash

# icon.svgから AppIcon.appiconset の1024x1024 PNG（通常・ダーク・ティント）を生成する。
# アイコンの意匠を変更したらicon.svgを編集して本スクリプトを再実行する。

set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
readonly SOURCE="$SCRIPT_DIR/icon.svg"
readonly APPICONSET="$PROJECT_ROOT/Webview Interaction Sample/Assets.xcassets/AppIcon.appiconset"
readonly SIZE=1024

# icon.svgの配色。ダーク/ティントはこの2色を置き換えて生成する
readonly LIGHT_BACKGROUND="#00695F"
readonly LIGHT_FOREGROUND="#FFFFFF"

command -v rsvg-convert >/dev/null || {
  echo "error: rsvg-convertが見つかりません" >&2
  echo "  brew install librsvg" >&2
  exit 1
}

[[ -f "$SOURCE" ]] || { echo "error: $SOURCE が見つかりません" >&2; exit 1; }
[[ -d "$APPICONSET" ]] || { echo "error: $APPICONSET が見つかりません" >&2; exit 1; }

# render <出力ファイル名> <背景色> <前景色>
render() {
  local output="$APPICONSET/$1" background="$2" foreground="$3"

  sed -e "s/$LIGHT_BACKGROUND/$background/g" -e "s/$LIGHT_FOREGROUND/$foreground/g" "$SOURCE" \
    | rsvg-convert --width "$SIZE" --height "$SIZE" --output "$output"

  echo "==> $1 ($background / $foreground)"
}

render AppIcon.png "$LIGHT_BACKGROUND" "$LIGHT_FOREGROUND"
# ダークはweb/app/theme.tsのダークテーマprimaryに合わせる
render AppIcon-Dark.png "#00302B" "#5FD4C0"
# ティントはシステムが色を付けるためグレースケールで出力する
render AppIcon-Tinted.png "#000000" "#FFFFFF"

echo "==> 完了しました"
