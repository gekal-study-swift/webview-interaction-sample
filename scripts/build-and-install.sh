#!/usr/bin/env bash

set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
readonly PROJECT="$PROJECT_ROOT/Webview Interaction Sample.xcodeproj"
readonly SCHEME="Webview Interaction Sample"
readonly BUNDLE_ID="cn.gekal.ios.Webview-Interaction-Sample"

device="${IOS_DEVICE:-}"
configuration="Debug"
team="${DEVELOPMENT_TEAM:-}"
launch=true

usage() {
  cat <<'USAGE'
Usage:
  ./scripts/build-and-install.sh --device <UDID|device-name> [options]

Options:
  -d, --device <value>       インストール先のUDIDまたは端末名（IOS_DEVICEでも指定可）
  -c, --configuration <name> DebugまたはRelease（既定: Debug）
      --team <team-id>       Apple Developer Team ID（DEVELOPMENT_TEAMでも指定可）
      --no-launch            インストール後にアプリを起動しない
  -h, --help                 このヘルプを表示

Examples:
  ./scripts/build-and-install.sh --device 00008110-001234567890001E
  ./scripts/build-and-install.sh --device "Gekal's iPhone" --team ABCDE12345
  IOS_DEVICE=00008110-001234567890001E ./scripts/build-and-install.sh

接続端末は次のコマンドで確認できます:
  xcrun devicectl list devices
USAGE
}

while (($# > 0)); do
  case "$1" in
    -d|--device)
      [[ $# -ge 2 ]] || { echo "error: $1には値が必要です" >&2; exit 2; }
      device="$2"
      shift 2
      ;;
    -c|--configuration)
      [[ $# -ge 2 ]] || { echo "error: $1には値が必要です" >&2; exit 2; }
      configuration="$2"
      shift 2
      ;;
    --team)
      [[ $# -ge 2 ]] || { echo "error: $1には値が必要です" >&2; exit 2; }
      team="$2"
      shift 2
      ;;
    --no-launch)
      launch=false
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "error: 不明なオプション: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ -z "$device" ]]; then
  echo "error: --deviceまたはIOS_DEVICEでインストール先を指定してください" >&2
  echo >&2
  xcrun devicectl list devices 2>/dev/null || true
  exit 2
fi

case "$configuration" in
  Debug|Release) ;;
  *) echo "error: configurationはDebugまたはReleaseを指定してください" >&2; exit 2 ;;
esac

command -v xcodebuild >/dev/null || { echo "error: xcodebuildが見つかりません" >&2; exit 1; }
command -v xcrun >/dev/null || { echo "error: xcrunが見つかりません" >&2; exit 1; }

readonly derived_data="$PROJECT_ROOT/.build/DeviceDerivedData"
readonly app_path="$derived_data/Build/Products/$configuration-iphoneos/$SCHEME.app"

build_command=(
  xcodebuild
  -project "$PROJECT"
  -scheme "$SCHEME"
  -configuration "$configuration"
  -destination "generic/platform=iOS"
  -derivedDataPath "$derived_data"
  -allowProvisioningUpdates
  build
)

if [[ -n "$team" ]]; then
  build_command+=("DEVELOPMENT_TEAM=$team")
fi

echo "==> $configuration版を実機向けにビルドします"
"${build_command[@]}"

if [[ ! -d "$app_path" ]]; then
  echo "error: ビルド成果物が見つかりません: $app_path" >&2
  exit 1
fi

echo "==> $device にインストールします"
xcrun devicectl device install app --device "$device" "$app_path"

if [[ "$launch" == true ]]; then
  echo "==> アプリを起動します"
  xcrun devicectl device process launch \
    --device "$device" \
    --terminate-existing \
    "$BUNDLE_ID"
fi

echo "==> 完了しました"
