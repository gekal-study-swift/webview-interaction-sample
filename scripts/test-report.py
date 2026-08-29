#!/usr/bin/env python3
#
# テストの結果とキャプチャを1枚のHTMLにまとめる。
#
# Usage:
#   ./scripts/test-report.py [--open]
#
# Examples:
#   ./scripts/test.sh all                # テスト実行後に自動で生成される
#   ./scripts/test-report.py             # 直近の実行結果から作り直す
#   ./scripts/test-report.py --open      # 生成してブラウザで開く
#
# 入力（あるものだけ使う）:
#   .build/reports/unit.xcresult         ロジックのユニットテスト
#   .build/reports/app.xcresult          アプリ込みのテスト（キャプチャが入っている）
#   e2e/test-results/results.json        PlaywrightのJSONレポート
#   e2e/test-results/screenshots/        specが保存したキャプチャ
#
# 出力:
#   .build/reports/index.html
#
# xcresultのキャプチャはxcresulttoolで取り出して.build/reports/attachments/に置く。
# Playwright自身のHTMLレポートは情報量が多いのでそのまま活かし、ここからは参照するだけにする。

import argparse
import html
import json
import shutil
import subprocess
import sys
import webbrowser
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REPORTS = ROOT / ".build" / "reports"
OUTPUT = REPORTS / "index.html"

# スコープ名 -> (xcresultのパス, 表示名)
XCRESULTS = [
    ("unit", REPORTS / "unit.xcresult", "ユニット（ロジック）"),
    ("app", REPORTS / "app.xcresult", "アプリ込み（ブリッジ）"),
]

PLAYWRIGHT_JSON = ROOT / "e2e" / "test-results" / "results.json"
PLAYWRIGHT_SHOTS = ROOT / "e2e" / "test-results" / "screenshots"
PLAYWRIGHT_REPORT = ROOT / "e2e" / "playwright-report" / "index.html"


def run_json(args):
    """xcresulttoolの出力をJSONで受け取る。失敗したらNone。"""
    try:
        completed = subprocess.run(args, capture_output=True, text=True, check=True)
        return json.loads(completed.stdout)
    except (subprocess.CalledProcessError, json.JSONDecodeError):
        return None


def read_xcresult(path):
    """xcresultから結果の要約を読む。"""
    summary = run_json(["xcrun", "xcresulttool", "get", "test-results", "summary", "--path", str(path), "--format", "json"])
    if summary is None:
        return None

    device = ""
    configurations = summary.get("devicesAndConfigurations") or []
    if configurations:
        info = configurations[0].get("device", {})
        device = f"{info.get('deviceName', '')} (iOS {info.get('osVersion', '')})".strip()

    result = summary.get("result", "Unknown")
    failed = summary.get("failedTests", 0)

    return {
        "ok": result == "Passed" and failed == 0,
        "result": result,
        "total": summary.get("totalTestCount", 0),
        "passed": summary.get("passedTests", 0),
        "failed": summary.get("failedTests", 0),
        "skipped": summary.get("skippedTests", 0),
        "duration": summary.get("finishTime", 0) - summary.get("startTime", 0),
        "device": device,
        "failures": [
            {
                "test": failure.get("testName", ""),
                "target": failure.get("targetName", ""),
                "message": failure.get("failureText", ""),
            }
            for failure in summary.get("testFailures") or []
        ],
    }


def export_attachments(scope, path):
    """xcresultのキャプチャを取り出し、テストごとにまとめて返す。"""
    output = REPORTS / "attachments" / scope
    if output.exists():
        shutil.rmtree(output)
    output.mkdir(parents=True, exist_ok=True)

    completed = subprocess.run(
        ["xcrun", "xcresulttool", "export", "attachments", "--path", str(path), "--output-path", str(output)],
        capture_output=True,
        text=True,
    )
    manifest = output / "manifest.json"
    if completed.returncode != 0 or not manifest.exists():
        return []

    groups = []
    for entry in json.loads(manifest.read_text()):
        images = []
        for attachment in entry.get("attachments", []):
            file = output / attachment.get("exportedFileName", "")
            if file.suffix.lower() != ".png" or not file.exists():
                continue
            # 添付名は "名前_0_UUID.png" の形で付くため、頭の名前だけを見出しにする
            label = attachment.get("suggestedHumanReadableName", file.name).split("_")[0]
            images.append({"src": file.relative_to(REPORTS).as_posix(), "label": label})
        if images:
            groups.append({"test": entry.get("testIdentifier", ""), "images": images})
    return groups


def read_playwright():
    """PlaywrightのJSONレポートから件数と失敗を読む。"""
    if not PLAYWRIGHT_JSON.exists():
        return None

    try:
        report = json.loads(PLAYWRIGHT_JSON.read_text())
    except json.JSONDecodeError:
        return None

    counts = {"expected": 0, "unexpected": 0, "skipped": 0, "flaky": 0}
    failures = []

    def walk(suite, titles):
        path = titles + [suite.get("title", "")]
        for spec in suite.get("specs", []):
            for test in spec.get("tests", []):
                status = test.get("status", "")
                counts[status] = counts.get(status, 0) + 1
                if status in ("unexpected", "flaky"):
                    errors = [result.get("error", {}).get("message", "") for result in test.get("results", [])]
                    failures.append(
                        {
                            "test": " › ".join(part for part in path + [spec.get("title", "")] if part),
                            "target": test.get("projectName", ""),
                            "message": next((error for error in errors if error), ""),
                        }
                    )
        for child in suite.get("suites", []):
            walk(child, path)

    for suite in report.get("suites", []):
        walk(suite, [])

    # テストが1件も見つからないなど、実行そのものが失敗した場合はここに入る
    for error in report.get("errors") or []:
        failures.append({"test": "実行エラー", "target": "", "message": error.get("message", "")})

    stats = report.get("stats", {})
    total = sum(counts.values())
    ok = not failures and counts["unexpected"] == 0
    return {
        "ok": ok,
        "result": "Passed" if ok else "Failed",
        "total": total,
        "passed": counts["expected"],
        "failed": counts["unexpected"],
        "skipped": counts["skipped"],
        "duration": stats.get("duration", 0) / 1000,
        "device": "chromium / firefox / webkit / Mobile Chrome / Mobile Safari",
        "failures": failures,
    }


def copy_playwright_screenshots():
    """specが保存したキャプチャをレポートの隣にコピーする。"""
    if not PLAYWRIGHT_SHOTS.exists():
        return []

    output = REPORTS / "attachments" / "e2e"
    if output.exists():
        shutil.rmtree(output)

    groups = {}
    for source in sorted(PLAYWRIGHT_SHOTS.rglob("*.png")):
        # test-results/screenshots/<テスト名>/<ブラウザ>/<名前>.png
        relative = source.relative_to(PLAYWRIGHT_SHOTS)
        destination = output / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)

        test = " / ".join(relative.parts[:-1])
        groups.setdefault(test, []).append(
            {"src": destination.relative_to(REPORTS).as_posix(), "label": source.stem}
        )

    return [{"test": test, "images": images} for test, images in groups.items()]


STYLE = """
:root { color-scheme: light dark; --bg: #f2f6f5; --card: #fff; --line: #dbe4e2; --text: #14201e;
        --muted: #5c6b68; --ok: #00695f; --ng: #b3261e; }
@media (prefers-color-scheme: dark) {
  :root { --bg: #0e1414; --card: #161d1d; --line: #2a3634; --text: #e6ecea; --muted: #9bacaa; --ok: #5fd4c0; }
}
* { box-sizing: border-box; }
body { margin: 0; padding: 24px; background: var(--bg); color: var(--text);
       font: 14px/1.7 -apple-system, BlinkMacSystemFont, "Hiragino Sans", sans-serif; }
main { max-width: 1040px; margin: 0 auto; }
h1 { font-size: 22px; margin: 0 0 4px; }
h2 { font-size: 17px; margin: 32px 0 12px; }
h3 { font-size: 14px; margin: 20px 0 8px; color: var(--muted); font-weight: 600; }
.meta { color: var(--muted); margin: 0 0 24px; }
table { width: 100%; border-collapse: collapse; background: var(--card); border: 1px solid var(--line);
        border-radius: 12px; overflow: hidden; }
th, td { padding: 10px 14px; text-align: left; border-bottom: 1px solid var(--line); }
th { font-weight: 600; color: var(--muted); font-size: 12px; }
tr:last-child td { border-bottom: 0; }
.pass { color: var(--ok); font-weight: 600; }
.fail { color: var(--ng); font-weight: 600; }
.shots { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
.shot { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 10px; }
.shot img { width: 100%; border-radius: 6px; border: 1px solid var(--line); display: block; }
.shot figcaption { color: var(--muted); font-size: 12px; margin-top: 8px; word-break: break-all; }
pre { background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 12px;
      overflow-x: auto; font-size: 12px; }
code { font-family: ui-monospace, SFMono-Regular, monospace; }
.empty { color: var(--muted); }
a { color: var(--ok); }
"""


def section_shots(title, groups):
    if not groups:
        return ""
    parts = [f"<h2>{html.escape(title)}</h2>"]
    for group in groups:
        parts.append(f"<h3>{html.escape(group['test'])}</h3><div class='shots'>")
        for image in group["images"]:
            parts.append(
                "<figure class='shot'>"
                f"<a href='{html.escape(image['src'])}'><img src='{html.escape(image['src'])}' alt=''></a>"
                f"<figcaption>{html.escape(image['label'])}</figcaption>"
                "</figure>"
            )
        parts.append("</div>")
    return "".join(parts)


def build_html(scopes, shot_groups):
    rows = []
    for label, summary in scopes:
        state = "pass" if summary["ok"] else "fail"
        rows.append(
            f"<tr><td>{html.escape(label)}</td>"
            f"<td class='{state}'>{html.escape(summary['result'])}</td>"
            f"<td>{summary['passed']} / {summary['total']}</td>"
            f"<td>{summary['failed']}</td>"
            f"<td>{summary['duration']:.1f} 秒</td>"
            f"<td>{html.escape(summary['device'])}</td></tr>"
        )

    failures = []
    for label, summary in scopes:
        for failure in summary["failures"]:
            failures.append(
                f"<h3>{html.escape(label)} · {html.escape(failure['test'])}</h3>"
                f"<pre><code>{html.escape(failure['message'])}</code></pre>"
            )

    failed_scopes = [label for label, summary in scopes if not summary["ok"]]
    if not scopes:
        verdict, verdict_class = "結果なし", "fail"
    elif failed_scopes:
        verdict = "失敗: " + " / ".join(failed_scopes)
        verdict_class = "fail"
    else:
        verdict, verdict_class = "すべて成功", "pass"

    playwright_link = ""
    if PLAYWRIGHT_REPORT.exists():
        href = PLAYWRIGHT_REPORT.relative_to(ROOT)
        playwright_link = (
            "<h2>Playwright のレポート</h2>"
            f"<p>1 件ごとの実行内容・トレースは Playwright 自身のレポートで見られます（<code>{html.escape(str(href))}</code>）。</p>"
            "<pre><code>pnpm --dir e2e exec playwright show-report</code></pre>"
        )

    body = [
        "<main>",
        "<h1>テストレポート</h1>",
        f"<p class='meta'>生成: {datetime.now(timezone.utc).astimezone():%Y-%m-%d %H:%M:%S} · "
        f"<span class='{verdict_class}'>{verdict}</span></p>",
    ]

    if scopes:
        body.append(
            "<table><thead><tr><th>スコープ</th><th>結果</th><th>成功</th><th>失敗</th><th>実行時間</th>"
            "<th>実行環境</th></tr></thead><tbody>" + "".join(rows) + "</tbody></table>"
        )
    else:
        body.append("<p class='empty'>結果が見つかりません。先に <code>./scripts/test.sh all</code> を実行してください。</p>")

    if failures:
        body.append("<h2>失敗の詳細</h2>" + "".join(failures))

    for title, groups in shot_groups:
        body.append(section_shots(title, groups))

    body.append(playwright_link)
    body.append("</main>")

    return (
        "<!doctype html><html lang='ja'><head><meta charset='utf-8'>"
        "<meta name='viewport' content='width=device-width, initial-scale=1'>"
        f"<title>テストレポート</title><style>{STYLE}</style></head><body>"
        + "".join(body)
        + "</body></html>"
    )


def main():
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--open", action="store_true", help="生成後にブラウザで開く")
    parser.add_argument("-h", "--help", action="help", help="このヘルプを表示")
    args = parser.parse_args()

    REPORTS.mkdir(parents=True, exist_ok=True)

    scopes = []
    shot_groups = []
    for scope, path, label in XCRESULTS:
        if not path.exists():
            continue
        summary = read_xcresult(path)
        if summary is None:
            print(f"warning: {path} を読めませんでした", file=sys.stderr)
            continue
        scopes.append((label, summary))
        groups = export_attachments(scope, path)
        if groups:
            shot_groups.append((f"{label} のキャプチャ", groups))

    playwright = read_playwright()
    if playwright:
        scopes.append(("E2E（Playwright）", playwright))
    e2e_shots = copy_playwright_screenshots()
    if e2e_shots:
        shot_groups.append(("E2E のキャプチャ", e2e_shots))

    OUTPUT.write_text(build_html(scopes, shot_groups))
    print(f"==> レポート: {OUTPUT.relative_to(ROOT)}")

    if args.open:
        webbrowser.open(OUTPUT.as_uri())

    return 0


if __name__ == "__main__":
    sys.exit(main())
