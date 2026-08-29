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
# 1件ごとの結果まで並べ、キャプチャはそのテストの行の下に出す。
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
ATTACHMENTS = REPORTS / "attachments"

# スコープ名 -> (xcresultのパス, 表示名)
XCRESULTS = [
    ("unit", REPORTS / "unit.xcresult", "ユニット（ロジック）"),
    ("app", REPORTS / "app.xcresult", "アプリ込み（ブリッジ）"),
]

E2E_DIR = ROOT / "e2e"
PLAYWRIGHT_JSON = E2E_DIR / "test-results" / "results.json"
PLAYWRIGHT_SHOTS = E2E_DIR / "test-results" / "screenshots"
PLAYWRIGHT_REPORT = E2E_DIR / "playwright-report" / "index.html"


def run_json(args):
    """xcresulttoolの出力をJSONで受け取る。失敗したらNone。"""
    try:
        completed = subprocess.run(args, capture_output=True, text=True, check=True)
        return json.loads(completed.stdout)
    except (subprocess.CalledProcessError, json.JSONDecodeError):
        return None


# ── xcodebuild（unit / app） ────────────────────────────────────────────────


def read_xcresult(path):
    """xcresultから結果の要約を読む。"""
    summary = run_json(
        ["xcrun", "xcresulttool", "get", "test-results", "summary", "--path", str(path), "--format", "json"]
    )
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
        "failed": failed,
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


def read_xcresult_cases(path):
    """xcresultから1件ごとの結果を読む。

    テスト計画 > バンドル > スイート > ケース の木で返るため、
    スイート名とケース名に畳んで一覧にする。
    """
    tests = run_json(
        ["xcrun", "xcresulttool", "get", "test-results", "tests", "--path", str(path), "--format", "json"]
    )
    if tests is None:
        return []

    cases = []

    def walk(node, suite):
        node_type = node.get("nodeType")
        name = node.get("name", "")

        if node_type == "Test Case":
            # 失敗したときは子に失敗内容がぶら下がる
            details = [
                child.get("name", "")
                for child in node.get("children") or []
                if child.get("nodeType") in ("Failure Message", "Expectation Failed")
            ]
            cases.append(
                {
                    "group": suite,
                    "name": name,
                    # 識別子はキャプチャの紐づけに使う（manifest.jsonのtestIdentifierと同じ形）
                    "id": f"{suite}/{name}" if suite else name,
                    "result": node.get("result", ""),
                    "duration": node.get("duration", ""),
                    "detail": "\n".join(details),
                }
            )
            return

        # スイート名だけを見出しにする（テスト計画とバンドルの名前は表に出さない）
        child_suite = name if node_type == "Test Suite" else suite
        for child in node.get("children") or []:
            walk(child, child_suite)

    for node in tests.get("testNodes") or []:
        walk(node, "")
    return cases


def export_attachments(scope, path):
    """xcresultのキャプチャを取り出し、テスト識別子ごとにまとめて返す。"""
    output = ATTACHMENTS / scope
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
        return {}

    captures = {}
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
            captures.setdefault(entry.get("testIdentifier", ""), []).extend(images)
    return captures


# ── Playwright（e2e） ──────────────────────────────────────────────────────


def copy_e2e_image(source, index):
    """Playwrightのキャプチャをレポートの隣にコピーして、参照用のパスを返す。"""
    output = ATTACHMENTS / "e2e"
    output.mkdir(parents=True, exist_ok=True)

    destination = output / f"{index:03d}-{source.name}"
    shutil.copy2(source, destination)
    return destination.relative_to(REPORTS).as_posix()


def read_playwright():
    """PlaywrightのJSONレポートから、要約と1件ごとの結果を読む。"""
    if not PLAYWRIGHT_JSON.exists():
        return None, []

    try:
        report = json.loads(PLAYWRIGHT_JSON.read_text())
    except json.JSONDecodeError:
        return None, []

    if (ATTACHMENTS / "e2e").exists():
        shutil.rmtree(ATTACHMENTS / "e2e")

    counts = {"expected": 0, "unexpected": 0, "skipped": 0, "flaky": 0}
    failures = []
    cases = []
    copied = 0

    # specが自分で保存したキャプチャ（test-results/screenshots/<テスト名>/<ブラウザ>/…）
    saved_shots = {}
    if PLAYWRIGHT_SHOTS.exists():
        for source in sorted(PLAYWRIGHT_SHOTS.rglob("*.png")):
            relative = source.relative_to(PLAYWRIGHT_SHOTS)
            if len(relative.parts) < 3:
                continue
            copied += 1
            saved_shots.setdefault((relative.parts[0], relative.parts[1]), []).append(
                {"src": copy_e2e_image(source, copied), "label": source.stem}
            )

    def walk(suite, titles):
        path = titles + [suite.get("title", "")]
        for spec in suite.get("specs", []):
            title = " › ".join(part for part in path[1:] + [spec.get("title", "")] if part)
            for test in spec.get("tests", []):
                nonlocal copied
                status = test.get("status", "")
                counts[status] = counts.get(status, 0) + 1
                project = test.get("projectName", "")
                results = test.get("results", []) or [{}]

                message = next(
                    (result.get("error", {}).get("message", "") for result in results if result.get("error")), ""
                )
                if status in ("unexpected", "flaky"):
                    failures.append({"test": title, "target": project, "message": message})

                # 失敗時のキャプチャ（screenshot: 'only-on-failure'）と、specが保存したもの
                images = []
                for result in results:
                    for attachment in result.get("attachments", []) or []:
                        if attachment.get("contentType") != "image/png":
                            continue
                        source = Path(attachment.get("path", ""))
                        if not source.is_absolute():
                            source = E2E_DIR / source
                        if not source.exists():
                            continue
                        copied += 1
                        images.append({"src": copy_e2e_image(source, copied), "label": attachment.get("name", "")})
                images.extend(saved_shots.get((spec.get("title", ""), project), []))

                cases.append(
                    {
                        "group": title,
                        "name": project,
                        "id": f"{title}::{project}",
                        "result": {"expected": "Passed", "unexpected": "Failed", "skipped": "Skipped"}.get(
                            status, status
                        ),
                        "duration": f"{results[0].get('duration', 0) / 1000:.2f}s",
                        "detail": message,
                        "images": images,
                    }
                )
        for child in suite.get("suites", []):
            walk(child, path)

    for suite in report.get("suites", []):
        walk(suite, [])

    # 同じテストのブラウザ違いを隣り合わせる。並びは設定ファイルのプロジェクト順に合わせる
    project_order = []
    for case in cases:
        if case["name"] not in project_order:
            project_order.append(case["name"])
    cases.sort(key=lambda case: (case["group"], project_order.index(case["name"])))

    # テストが1件も見つからないなど、実行そのものが失敗した場合はここに入る
    for error in report.get("errors") or []:
        failures.append({"test": "実行エラー", "target": "", "message": error.get("message", "")})

    stats = report.get("stats", {})
    total = sum(counts.values())
    ok = not failures and counts["unexpected"] == 0
    summary = {
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
    return summary, cases


# ── HTML ──────────────────────────────────────────────────────────────────

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
th, td { padding: 9px 14px; text-align: left; border-bottom: 1px solid var(--line); vertical-align: top; }
th { font-weight: 600; color: var(--muted); font-size: 12px; }
tr:last-child td { border-bottom: 0; }
.pass { color: var(--ok); font-weight: 600; }
.fail { color: var(--ng); font-weight: 600; }
.skip { color: var(--muted); font-weight: 600; }
.num { text-align: right; white-space: nowrap; color: var(--muted); font-variant-numeric: tabular-nums; }
.group td { background: color-mix(in srgb, var(--line) 35%, transparent); font-weight: 600; font-size: 13px; }
.case td:first-child { font-family: ui-monospace, SFMono-Regular, monospace; font-size: 13px;
                       word-break: break-all; }
.detail td { color: var(--ng); font-size: 12px; white-space: pre-wrap; }
details { margin-top: 12px; }
summary { cursor: pointer; color: var(--muted); font-size: 13px; margin-bottom: 8px; }
.shots { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; padding: 4px 0; }
.shot { background: var(--bg); border: 1px solid var(--line); border-radius: 10px; padding: 8px; }
.shot img { width: 100%; border-radius: 6px; border: 1px solid var(--line); display: block; }
.shot figcaption { color: var(--muted); font-size: 12px; margin-top: 6px; word-break: break-all; }
pre { background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 12px;
      overflow-x: auto; font-size: 12px; }
code { font-family: ui-monospace, SFMono-Regular, monospace; }
.empty { color: var(--muted); }
a { color: var(--ok); }
"""

RESULT_CLASS = {"Passed": "pass", "Failed": "fail", "Skipped": "skip", "Expected Failure": "skip"}


def shots_html(images):
    figures = "".join(
        "<figure class='shot'>"
        f"<a href='{html.escape(image['src'])}'><img src='{html.escape(image['src'])}' alt='' loading='lazy'></a>"
        f"<figcaption>{html.escape(image['label'])}</figcaption>"
        "</figure>"
        for image in images
    )
    return f"<div class='shots'>{figures}</div>"


def cases_table(cases, captures, name_header):
    """1件ごとの結果の表。キャプチャはそのテストの行の下に出す。"""
    rows = []
    group = None
    for case in cases:
        if case["group"] != group:
            group = case["group"]
            rows.append(f"<tr class='group'><td colspan='3'>{html.escape(group)}</td></tr>")

        state = RESULT_CLASS.get(case["result"], "skip")
        rows.append(
            f"<tr class='case'><td>{html.escape(case['name'])}</td>"
            f"<td class='{state}'>{html.escape(case['result'])}</td>"
            f"<td class='num'>{html.escape(str(case['duration']))}</td></tr>"
        )

        if case.get("detail"):
            rows.append(f"<tr class='detail'><td colspan='3'>{html.escape(case['detail'])}</td></tr>")

        images = case.get("images") or captures.get(case["id"], [])
        if images:
            rows.append(f"<tr><td colspan='3'>{shots_html(images)}</td></tr>")

    return (
        f"<table><thead><tr><th>{html.escape(name_header)}</th><th>結果</th><th>時間</th></tr></thead>"
        f"<tbody>{''.join(rows)}</tbody></table>"
    )


def build_html(scopes):
    rows = []
    for scope in scopes:
        summary = scope["summary"]
        state = "pass" if summary["ok"] else "fail"
        rows.append(
            f"<tr><td>{html.escape(scope['label'])}</td>"
            f"<td class='{state}'>{html.escape(summary['result'])}</td>"
            f"<td>{summary['passed']} / {summary['total']}</td>"
            f"<td>{summary['failed']}</td>"
            f"<td>{summary['duration']:.1f} 秒</td>"
            f"<td>{html.escape(summary['device'])}</td></tr>"
        )

    failures = []
    for scope in scopes:
        for failure in scope["summary"]["failures"]:
            target = f" ({failure['target']})" if failure.get("target") else ""
            failures.append(
                f"<h3>{html.escape(scope['label'])} · {html.escape(failure['test'])}{html.escape(target)}</h3>"
                f"<pre><code>{html.escape(failure['message'])}</code></pre>"
            )

    failed_scopes = [scope["label"] for scope in scopes if not scope["summary"]["ok"]]
    if not scopes:
        verdict, verdict_class = "結果なし", "fail"
    elif failed_scopes:
        verdict, verdict_class = "失敗: " + " / ".join(failed_scopes), "fail"
    else:
        verdict, verdict_class = "すべて成功", "pass"

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
        body.append(
            "<p class='empty'>結果が見つかりません。先に <code>./scripts/test.sh all</code> を実行してください。</p>"
        )

    if failures:
        body.append("<h2>失敗の詳細</h2>" + "".join(failures))

    # スコープごとの1件ごとの結果。件数が多いので、失敗が無ければ畳んでおく
    for scope in scopes:
        if not scope["cases"]:
            continue
        body.append(f"<h2>{html.escape(scope['label'])}</h2>")
        open_attribute = "" if scope["summary"]["ok"] else " open"
        body.append(
            f"<details{open_attribute}><summary>{len(scope['cases'])} 件のテストケース</summary>"
            + cases_table(scope["cases"], scope["captures"], scope["name_header"])
            + "</details>"
        )

    if PLAYWRIGHT_REPORT.exists():
        href = PLAYWRIGHT_REPORT.relative_to(ROOT)
        body.append(
            "<h2>Playwright のレポート</h2>"
            f"<p>1 件ごとの実行手順やトレースは Playwright 自身のレポートが詳しいです（<code>{html.escape(str(href))}</code>）。</p>"
            "<pre><code>pnpm --dir e2e exec playwright show-report</code></pre>"
        )

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
    for scope, path, label in XCRESULTS:
        if not path.exists():
            continue
        summary = read_xcresult(path)
        if summary is None:
            print(f"warning: {path} を読めませんでした", file=sys.stderr)
            continue
        scopes.append(
            {
                "label": label,
                "summary": summary,
                "cases": read_xcresult_cases(path),
                "captures": export_attachments(scope, path),
                "name_header": "テストケース",
            }
        )

    playwright, playwright_cases = read_playwright()
    if playwright:
        scopes.append(
            {
                "label": "E2E（Playwright）",
                "summary": playwright,
                "cases": playwright_cases,
                "captures": {},
                "name_header": "ブラウザ",
            }
        )

    OUTPUT.write_text(build_html(scopes))
    print(f"==> レポート: {OUTPUT.relative_to(ROOT)}")

    if args.open:
        webbrowser.open(OUTPUT.as_uri())

    return 0


if __name__ == "__main__":
    sys.exit(main())
