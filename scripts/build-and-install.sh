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
  ./scripts/build-and-install.sh [options]

Options:
  -d, --device <value>       インストール先のIDまたは端末名（IOS_DEVICEでも指定可）
  -c, --configuration <name> DebugまたはRelease（既定: Debug）
      --team <team-id>       Apple Developer Team ID（DEVELOPMENT_TEAMでも指定可）
      --no-launch            インストール後にアプリを起動しない
  -h, --help                 このヘルプを表示

Examples:
  ./scripts/build-and-install.sh
  ./scripts/build-and-install.sh --device 00008110-001234567890001E
  ./scripts/build-and-install.sh --device "Gekal's iPhone" --team ABCDE12345
  IOS_DEVICE=00008110-001234567890001E ./scripts/build-and-install.sh

--deviceを省略するとiOS端末を検出します。1台なら自動選択し、複数なら一覧から選択します。
接続端末は次のコマンドでも確認できます:
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
  devices_json="$(mktemp "${TMPDIR:-/tmp}/webview-ios-devices.XXXXXX")"
  trap 'rm -f "$devices_json"' EXIT

  echo "==> 接続済みのiOS端末を検出します"
  xcrun devicectl list devices --json-output "$devices_json" --quiet

  device_ids=()
  device_names=()
  device_count="$(plutil -extract result.devices raw "$devices_json")"

  for ((index = 0; index < device_count; index += 1)); do
    platform="$(plutil -extract "result.devices.$index.hardwareProperties.platform" raw "$devices_json" 2>/dev/null || true)"
    [[ "$platform" == "iOS" ]] || continue

    identifier="$(plutil -extract "result.devices.$index.identifier" raw "$devices_json")"
    name="$(plutil -extract "result.devices.$index.deviceProperties.name" raw "$devices_json")"
    os_version="$(plutil -extract "result.devices.$index.deviceProperties.osVersionNumber" raw "$devices_json" 2>/dev/null || true)"
    device_ids+=("$identifier")
    device_names+=("$name${os_version:+ (iOS $os_version)}")
  done

  case "${#device_ids[@]}" in
    0)
      echo "error: 接続済みのiOS端末が見つかりません" >&2
      echo "端末のロック、信頼設定、Developer Mode、USBまたはネットワーク接続を確認してください。" >&2
      exit 1
      ;;
    1)
      device="${device_ids[0]}"
      echo "==> ${device_names[0]} を使用します"
      ;;
    *)
      if [[ ! -t 0 ]]; then
        echo "error: 複数のiOS端末が見つかりました。非対話実行では--deviceまたはIOS_DEVICEを指定してください。" >&2
        exit 2
      fi

      echo "インストール先を選択してください:"
      for ((index = 0; index < ${#device_ids[@]}; index += 1)); do
        printf '  %d) %s [%s]\n' "$((index + 1))" "${device_names[index]}" "${device_ids[index]}"
      done

      while true; do
        read -r -p "番号を入力してください [1-${#device_ids[@]}]: " selection
        if [[ "$selection" =~ ^[0-9]+$ ]] && ((selection >= 1 && selection <= ${#device_ids[@]})); then
          device="${device_ids[selection - 1]}"
          echo "==> ${device_names[selection - 1]} を使用します"
          break
        fi
        echo "error: 1から${#device_ids[@]}までの番号を入力してください" >&2
      done
      ;;
  esac
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
