#!/usr/bin/env python3
"""Merge JSONL QA results and update DMS_COMPREHENSIVE_QA_TEST_MATRIX.md."""
from __future__ import annotations

import json
import re
import sys
from datetime import date
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
MATRIX = REPO / "cleon_document_management/docs/DMS_COMPREHENSIVE_QA_TEST_MATRIX.md"
RUN_LOG = REPO / "cleon_document_management/docs/DMS_QA_RUN_RESULTS.md"


def load_jsonl(paths: list[Path]) -> dict[str, tuple[str, str]]:
    merged: dict[str, tuple[str, str]] = {}
    priority = {"Pass": 4, "Fail": 3, "Partial": 2, "N/A": 1, "Deferred": 0}

    def merge(tid: str, status: str, note: str) -> None:
        prev = merged.get(tid)
        if not prev or priority.get(status, 0) >= priority.get(prev[0], 0):
            merged[tid] = (status, note)

    for path in paths:
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            row = json.loads(line)
            merge(row["id"], row["status"], (row.get("note") or "").strip())
    return merged


def fmt(status: str, note: str) -> str:
    if not note or status in ("Pass", "N/A"):
        return status
    short = note.replace("|", "/").replace("\n", " ")[:100]
    return f"{status} ({short})"


def apply_matrix(results: dict[str, tuple[str, str]]) -> None:
    text = MATRIX.read_text(encoding="utf-8")

    # Ensure SMK table has Status column header
    text = text.replace(
        "| ID | Step | Expected |\n|----|------|----------|",
        "| ID | Step | Expected | Status |\n|----|------|----------|--------|",
    )

    for tid, (status, note) in sorted(results.items()):
        cell = fmt(status, note)
        patterns = [
            # Unrun placeholder
            rf"^(\| {re.escape(tid)} \|(?:[^|\n]+\|)+) — \|$",
            # 7-column regression tables (ID … Expected | Status |)
            rf"^(\| {re.escape(tid)} \|[^|]+\|[^|]+\|[^|]+\|[^|]+\|[^|]+\|) [^|]* \|$",
            # Phase 0 smoke (ID | Step | Expected | Status |)
            rf"^(\| {re.escape(tid)} \|[^|]+\|[^|]+\|) [^|]* \|$",
            # ORG-OOS two-column
            rf"^(\| {re.escape(tid)} \|[^|]+\|) [^|]* \|$",
        ]
        replaced = False
        for pattern in patterns:
            text, n = re.subn(pattern, rf"\1 {cell} |", text, count=1, flags=re.MULTILINE)
            if n:
                replaced = True
                break
        if not replaced and tid.startswith("SMK-"):
            pattern2 = rf"^(\| {re.escape(tid)} \|[^|]+\|[^|]+\|) [^|]* \|$"
            text, _ = re.subn(pattern2, rf"\1 {cell} |", text, count=1, flags=re.MULTILINE)

    # Execution log block
    run_id = date.today().isoformat()
    counts = {}
    for st, _ in results.values():
        counts[st] = counts.get(st, 0) + 1
    summary = (
        f"\n\n### Automated run {run_id}\n\n"
        f"- Cases recorded: **{len(results)}**\n"
        f"- Pass: {counts.get('Pass', 0)}, Partial: {counts.get('Partial', 0)}, "
        f"Fail: {counts.get('Fail', 0)}, N/A: {counts.get('N/A', 0)}\n"
        f"- Artifacts: backend `run_dms_comprehensive_qa.py`, HTTP `qa_http_checks.py`, "
        f"personas `qa_persona_api_checks.py`, UI `qa_ui_comprehensive.py`, "
        f"fixtures `run_dms_qa_fixtures.py`\n"
    )
    if "### Automated run" not in text:
        text = text.replace("## 13. Execution log template", summary + "\n## 13. Execution log template")
    else:
        text = re.sub(r"\n### Automated run[\s\S]*?(?=\n## 13\.)", summary + "\n", text, count=1)

    MATRIX.write_text(text, encoding="utf-8")

    lines = [
        f"# DMS QA run results — {run_id}",
        "",
        "| ID | Status | Note |",
        "|----|--------|------|",
    ]
    for tid in sorted(results):
        st, note = results[tid]
        lines.append(f"| {tid} | {st} | {note.replace('|', '/')} |")
    RUN_LOG.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Updated {MATRIX}")
    print(f"Wrote {RUN_LOG}")


def main() -> None:
    paths = [Path(p) for p in sys.argv[1:]] or [
        Path("/tmp/dms_qa_backend.jsonl"),
        Path("/tmp/dms_qa_http.jsonl"),
    ]
    apply_matrix(load_jsonl(paths))


if __name__ == "__main__":
    main()
