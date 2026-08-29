#!/usr/bin/env bash
#
# テストを実行する。
#
# Usage:
#   ./scripts/test.sh [unit|app|e2e|all] [options] [-- <playwrightの引数>]
#
# Scopes:
#   e2e   Playwrightでの E2E（既定）。配信中のページをブラウザで開き、ブリッジをモックする
#   unit  UIKitに依存しないロジックのユニットテスト（Swift Testing、シミュレータ）
#   app   アプリ込みのブリッジのテスト。アプリを起動し、本物のブリッジ越しに往復させる
#   all   unit + app + e2e
#
# Options:
#   -p, --project <name>       Playwrightのプロジェクト名（繰り返し指定可、既定は全て）
#   -u, --url <url>            テスト対象のURL（e2e/.envのWEBVIEW_URLを上書き）
#       --ui                   PlaywrightのUIモードで開く
#   -s, --simulator <name>     unit / app に使うシミュレータ名（IOS_SIMULATORでも指定可）
#   -h, --help                 このヘルプを表示
#
# Examples:
#   ./scripts/test.sh                                            # E2Eを5つのブラウザすべてで
#   ./scripts/test.sh e2e --project chromium                     # 1つのブラウザだけで
#   ./scripts/test.sh e2e --project webkit                       # 実機に一番近いWebKitで
#   ./scripts/test.sh e2e -- -g "外部リンク"                       # テスト名で絞り込む
#   ./scripts/test.sh e2e --url http://localhost:3000/index.html # ローカルのweb/を対象にする
#   ./scripts/test.sh e2e --ui                                   # UIモードで1件ずつ追う
#   ./scripts/test.sh unit                                       # ロジックのユニットテストのみ
#   ./scripts/test.sh unit --simulator "iPhone 16"               # シミュレータを指定する
#   ./scripts/test.sh app                                        # アプリ込みのブリッジのテスト
#   ./scripts/test.sh all                                        # unit + app + e2e
#
# e2eとappはどちらも配信中のページを読み込むため、ネットワーク接続が必要です。
# ローカルのweb/を対象にする場合は、別のシェルで `cd web && pnpm dev` を動かして--urlを渡してください。
#
# Playwrightのプロジェクト名: chromium / firefox / webkit / "Mobile Chrome" / "Mobile Safari"
#
set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SELF="$SCRIPT_DIR/$(basename "${BASH_SOURCE[0]}")"
readonly PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
readonly PROJECT="$PROJECT_ROOT/Webview Interaction Sample.xcodeproj"
readonly SCHEME="Webview Interaction Sample"
readonly TEST_TARGET="Webview Interaction SampleTests"
# アプリを起動して配信中のページを読むテスト。unitではこれらを除いて速さと安定を保つ
readonly APP_TEST_SUITES=("WebViewBridgeTests")
readonly E2E_DIR="$PROJECT_ROOT/e2e"
# シミュレータの既定機種。無ければ利用可能なiPhoneから選び直す
readonly DEFAULT_SIMULATOR="iPhone 16 Pro"

scope="e2e"
simulator="${IOS_SIMULATOR:-}"
url="${WEBVIEW_URL:-}"
ui_mode=false
playwright_projects=()
playwright_args=()

# 先頭の説明コメントをそのまま表示する。書く場所を1か所にして食い違いを防ぐ
usage() {
  awk 'NR == 1 { next } /^#/ { sub(/^# ?/, ""); print; next } { exit }' "$SELF"
}

while (($# > 0)); do
  case "$1" in
    unit|app|e2e|all)
      scope="$1"
      shift
      ;;
    -p|--project)
      [[ $# -ge 2 ]] || { echo "error: $1には値が必要です" >&2; exit 2; }
      playwright_projects+=("$2")
      shift 2
      ;;
    -u|--url)
      [[ $# -ge 2 ]] || { echo "error: $1には値が必要です" >&2; exit 2; }
      url="$2"
      shift 2
      ;;
    -s|--simulator)
      [[ $# -ge 2 ]] || { echo "error: $1には値が必要です" >&2; exit 2; }
      simulator="$2"
      shift 2
      ;;
    --ui)
      ui_mode=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --)
      shift
      playwright_args=("$@")
      break
      ;;
    *)
      echo "error: 不明なオプション: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

# ── ユニットテスト ──────────────────────────────────────────────────────────

# 同名のシミュレータが複数のランタイムに存在するため、名前ではなくUDIDに解決してから渡す。
# 同名が複数あれば最後（＝新しいランタイム側）を採る。
simulator_udid_of() {
  local want="$1"
  xcrun simctl list devices available \
    | awk -v want="$want" '
        match($0, /\([0-9A-Fa-f-]{36}\)/) {
          udid = substr($0, RSTART + 1, RLENGTH - 2)
          name = substr($0, 1, RSTART - 1)
          gsub(/^[ \t]+|[ \t]+$/, "", name)
          if (name == want) { found = udid }
        }
        END { if (found != "") print found }
      '
}

# 起動中のシミュレータがあればそれを使う。ユーザーが見ている画面でそのまま動く
booted_simulator() {
  xcrun simctl list devices booted \
    | awk 'match($0, /\([0-9A-Fa-f-]{36}\)/) { print substr($0, RSTART + 1, RLENGTH - 2); exit }'
}

# 既定機種が無い環境向けの代替。利用可能なiPhoneのうち最後のもの
fallback_simulator() {
  xcrun simctl list devices available \
    | awk '
        match($0, /\([0-9A-Fa-f-]{36}\)/) {
          name = substr($0, 1, RSTART - 1)
          gsub(/^[ \t]+|[ \t]+$/, "", name)
          if (name ~ /^iPhone/) { found = substr($0, RSTART + 1, RLENGTH - 2); label = name }
        }
        END { if (found != "") print found "\t" label }
      '
}

# $1: unit（アプリ込みのテストを除く） / app（アプリ込みのテストだけ）
run_xcode_tests() {
  local target_scope="$1"
  command -v xcodebuild >/dev/null || { echo "error: xcodebuildが見つかりません" >&2; exit 1; }

  local udid=""
  if [[ -n "$simulator" ]]; then
    udid="$(simulator_udid_of "$simulator")"
    if [[ -z "$udid" ]]; then
      echo "error: シミュレータが見つかりません: $simulator" >&2
      echo "利用可能な機種は次のコマンドで確認できます: xcrun simctl list devices available" >&2
      exit 1
    fi
    echo "==> シミュレータ $simulator [$udid] を使用します"
  else
    udid="$(booted_simulator)"
    if [[ -n "$udid" ]]; then
      echo "==> 起動中のシミュレータ [$udid] を使用します"
    else
      udid="$(simulator_udid_of "$DEFAULT_SIMULATOR")"
      if [[ -n "$udid" ]]; then
        echo "==> シミュレータ $DEFAULT_SIMULATOR [$udid] を使用します"
      else
        local fallback
        fallback="$(fallback_simulator)"
        if [[ -z "$fallback" ]]; then
          echo "error: 利用可能なiPhoneシミュレータがありません" >&2
          echo "Xcode > Settings > Components からシミュレータのランタイムを追加してください。" >&2
          exit 1
        fi
        udid="${fallback%%$'\t'*}"
        echo "==> シミュレータ ${fallback#*$'\t'} [$udid] を使用します（$DEFAULT_SIMULATOR が無いため）"
      fi
    fi
  fi

  # アプリ込みのテストは実際にページを読み込むので、unitでは外して速さと安定を保つ
  local selection=() suite
  if [[ "$target_scope" == "app" ]]; then
    for suite in "${APP_TEST_SUITES[@]}"; do
      selection+=(-only-testing:"$TEST_TARGET/$suite")
    done
  else
    selection+=(-only-testing:"$TEST_TARGET")
    for suite in "${APP_TEST_SUITES[@]}"; do
      selection+=(-skip-testing:"$TEST_TARGET/$suite")
    done
  fi

  if [[ "$target_scope" == "app" ]]; then
    echo "==> アプリ込みのテストを実行します"
  else
    echo "==> ユニットテストを実行します"
  fi

  if ! xcodebuild test \
    -project "$PROJECT" \
    -scheme "$SCHEME" \
    -destination "platform=iOS Simulator,id=$udid" \
    -derivedDataPath "$PROJECT_ROOT/.build/TestDerivedData" \
    "${selection[@]}"; then
    echo >&2
    echo "error: テストに失敗しました（$target_scope）" >&2
    echo "シミュレータの起動に失敗している場合は、一度Simulator.appを開いてから再実行してください。" >&2
    if [[ "$target_scope" == "app" ]]; then
      echo "アプリ込みのテストは配信中のページを読み込みます。ネットワーク接続も確認してください。" >&2
    fi
    exit 1
  fi
}

# ── E2E ────────────────────────────────────────────────────────────────────

run_e2e_tests() {
  if [[ ! -d "$E2E_DIR" ]]; then
    echo "error: e2eディレクトリが見つかりません: $E2E_DIR" >&2
    exit 1
  fi

  if ! command -v pnpm >/dev/null; then
    echo "error: pnpmが見つかりません" >&2
    echo "次のいずれかで導入してください。" >&2
    echo "  npm install -g pnpm@11.16.0" >&2
    echo "  brew install pnpm" >&2
    exit 1
  fi

  cd "$E2E_DIR"

  echo "==> 依存関係を確認します"
  pnpm install

  # 未取得のブラウザだけダウンロードする（取得済みなら何もしない）
  echo "==> Playwrightのブラウザを確認します"
  pnpm exec playwright install

  local command=(pnpm exec playwright)
  if [[ "$ui_mode" == true ]]; then
    command+=(test --ui)
  else
    command+=(test)
  fi

  local project
  for project in ${playwright_projects[@]+"${playwright_projects[@]}"}; do
    command+=(--project "$project")
  done
  command+=(${playwright_args[@]+"${playwright_args[@]}"})

  if [[ -n "$url" ]]; then
    # playwright.config.tsはdotenvで.envを読むが、既存の環境変数は上書きしない
    export WEBVIEW_URL="$url"
    echo "==> 対象URL: $url"
  fi

  echo "==> E2Eテストを実行します"
  # 失敗してもレポートの場所を案内したいので、ここでは終了させない
  set +e
  "${command[@]}"
  local status=$?
  set -e

  if ((status != 0)); then
    echo >&2
    echo "error: E2Eテストに失敗しました" >&2
    echo "詳細は次で確認できます: (cd e2e && pnpm exec playwright show-report)" >&2
    echo "画面キャプチャ: e2e/test-results/" >&2
    exit "$status"
  fi
}

case "$scope" in
  unit)
    run_xcode_tests unit
    ;;
  app)
    run_xcode_tests app
    ;;
  e2e)
    run_e2e_tests
    ;;
  all)
    run_xcode_tests unit
    run_xcode_tests app
    run_e2e_tests
    ;;
esac

echo "==> 完了しました"
