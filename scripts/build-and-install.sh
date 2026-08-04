#!/usr/bin/env bash

set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
readonly PROJECT="$PROJECT_ROOT/Webview Interaction Sample.xcodeproj"
readonly SCHEME="Webview Interaction Sample"
readonly BUNDLE_ID="cn.gekal.ios.WebviewInteractionSample"

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

readonly XCODE_PREFERENCES="$HOME/Library/Preferences/com.apple.dt.Xcode.plist"

# XcodeにサインインしたApple IDが持つTeamを「Team ID<TAB>Team種別」で列挙する
xcode_account_teams() {
  [[ -f "$XCODE_PREFERENCES" ]] || return 0
  plutil -extract IDEProvisioningTeamByIdentifier xml1 -o - "$XCODE_PREFERENCES" 2>/dev/null \
    | awk '
        /<key>teamID<\/key>/ { getline; gsub(/^[^>]*>|<.*$/, ""); id = $0; next }
        /<key>teamType<\/key>/ {
          if (id != "") { getline; gsub(/^[^>]*>|<.*$/, ""); print id "\t" $0; id = "" }
        }
      '
}

readonly account_teams="$(xcode_account_teams)"

# Team IDに対応するTeam種別を返す。サインイン済みのApple IDに無ければ失敗する
team_type_of() {
  local wanted="$1" account_id account_type
  while IFS=$'\t' read -r account_id account_type; do
    [[ -n "$account_id" ]] || continue
    if [[ "$account_id" == "$wanted" ]]; then
      printf '%s' "$account_type"
      return 0
    fi
  done <<<"$account_teams"
  return 1
}

team_note() {
  local team_type
  if ! team_type="$(team_type_of "$1")"; then
    printf 'Xcode未サインイン'
  elif [[ "$team_type" == "Personal Team" ]]; then
    printf '無料のPersonal Team'
  else
    printf '%s' "$team_type"
  fi
}

project_development_team() {
  xcodebuild \
    -project "$PROJECT" \
    -scheme "$SCHEME" \
    -configuration "$configuration" \
    -showBuildSettings 2>/dev/null \
    | awk -F' = ' '/^ +DEVELOPMENT_TEAM = /{ print $2; exit }'
}

if [[ -z "$team" ]]; then
  echo "==> プロジェクト設定のDevelopment Teamを確認します"
  team="$(project_development_team)"
  [[ -n "$team" ]] && echo "==> Development Team $team を使用します（プロジェクト設定）"
fi

if [[ -z "$team" ]]; then
  team_ids=()
  team_labels=()

  while IFS= read -r identity; do
    if [[ "$identity" =~ \"([^\"]+)\"$ ]]; then
      identity_name="${BASH_REMATCH[1]}"
      certificate_subject="$(
        security find-certificate -c "$identity_name" -p 2>/dev/null \
          | openssl x509 -noout -subject -nameopt RFC2253 2>/dev/null \
          || true
      )"
      [[ "$certificate_subject" =~ OU=([^,]+) ]] || continue
      candidate="${BASH_REMATCH[1]}"
      duplicate=false
      if ((${#team_ids[@]} > 0)); then
        for existing in "${team_ids[@]}"; do
          [[ "$existing" == "$candidate" ]] && duplicate=true
        done
      fi
      if [[ "$duplicate" == false ]]; then
        team_ids+=("$candidate")
        team_labels+=("$identity_name")
      fi
    fi
  done < <(security find-identity -v -p codesigning 2>/dev/null)

  case "${#team_ids[@]}" in
    0)
      echo "error: 有効なAppleコード署名証明書が見つかりません" >&2
      echo "XcodeのSettings > AccountsでApple IDと証明書を設定するか、--teamでTeam IDを指定してください。" >&2
      exit 1
      ;;
    1)
      team="${team_ids[0]}"
      echo "==> Development Team $team を使用します（証明書から検出）"
      ;;
    *)
      if [[ ! -t 0 ]]; then
        echo "error: 複数のDevelopment Teamが見つかりました。非対話実行では--teamまたはDEVELOPMENT_TEAMを指定してください。" >&2
        exit 2
      fi

      echo "Development Teamを選択してください:"
      for ((index = 0; index < ${#team_ids[@]}; index += 1)); do
        printf '  %d) %s [%s] (%s)\n' \
          "$((index + 1))" \
          "${team_labels[index]}" \
          "${team_ids[index]}" \
          "$(team_note "${team_ids[index]}")"
      done

      while true; do
        read -r -p "番号を入力してください [1-${#team_ids[@]}]: " selection
        if [[ "$selection" =~ ^[0-9]+$ ]] && ((selection >= 1 && selection <= ${#team_ids[@]})); then
          team="${team_ids[selection - 1]}"
          echo "==> Development Team $team を使用します"
          break
        fi
        echo "error: 1から${#team_ids[@]}までの番号を入力してください" >&2
      done
      ;;
  esac
fi

if ! selected_team_type="$(team_type_of "$team")"; then
  echo "warning: Team $team のApple IDがXcodeにサインインされていません" >&2
  echo "  Xcode > Settings > Accounts でApple IDを追加すると自動署名が利用できます。" >&2
elif [[ "$selected_team_type" == "Personal Team" ]]; then
  echo "note: Team $team は無料のPersonal Teamです"
  echo "  Provisioning Profileの有効期限は7日で、他のTeamが登録済みのBundle IDは使用できません。"
fi

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

build_command+=("DEVELOPMENT_TEAM=$team")

echo "==> ${configuration}版を実機向けにビルドします"
if ! "${build_command[@]}"; then
  echo >&2
  echo "error: 実機向けビルドに失敗しました" >&2
  echo "署名エラーの場合は次を確認してください。" >&2
  echo "  - No Account for Team \"$team\": Xcode > Settings > Accounts で該当Apple IDにサインインする" >&2
  echo "  - Failed Registering Bundle Identifier: $BUNDLE_ID を別のTeamが登録済み。" >&2
  echo "    そのTeamでビルドするか、--teamで登録済みのTeam IDを指定する" >&2
  echo "  - No profiles found: Xcodeで一度プロジェクトを開き、Provisioning Profileを更新する" >&2
  exit 1
fi

if [[ ! -d "$app_path" ]]; then
  echo "error: ビルド成果物が見つかりません: $app_path" >&2
  exit 1
fi

echo "==> $device にインストールします"
xcrun devicectl device install app --device "$device" "$app_path"

if [[ "$launch" == true ]]; then
  echo "==> アプリを起動します"
  if ! xcrun devicectl device process launch \
    --device "$device" \
    --terminate-existing \
    "$BUNDLE_ID"; then
    echo >&2
    echo "error: アプリの起動に失敗しました" >&2
    echo "invalid code signature / profile has not been explicitly trusted の場合は、" >&2
    echo "端末で開発者証明書を信頼してください（インストール自体は完了しています）。" >&2
    echo "  設定 > 一般 > VPNとデバイス管理 > デベロッパApp > 開発元を信頼" >&2
    exit 1
  fi
fi

echo "==> 完了しました"
