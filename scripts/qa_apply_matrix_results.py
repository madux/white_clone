#!/usr/bin/env python3
"""Apply JSONL QA results to DMS_COMPREHENSIVE_QA_TEST_MATRIX.md Status column."""
from __future__ import annotations

import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
MATRIX = REPO / "cleon_document_management/docs/DMS_COMPREHENSIVE_QA_TEST_MATRIX.md"


def load_results(path: Path) -> dict[str, tuple[str, str]]:
    out: dict[str, tuple[str, str]] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        import json

        row = json.loads(line)
        tid = row["id"]
        status = row["status"]
        note = (row.get("note") or "").strip()
        out[tid] = (status, note)
    return out


def format_status(status: str, note: str) -> str:
    if not note or status in ("Pass", "N/A"):
        return status
    short = note.replace("|", "/")[:80]
    return f"{status} ({short})"


def apply(results: dict[str, tuple[str, str]]) -> None:
    text = MATRIX.read_text(encoding="utf-8")
    lines = text.splitlines()
    new_lines = []
    for line in lines:
        if line.startswith("| SMK-") and line.count("|") >= 3:
            parts = [p.strip() for p in line.split("|")]
            if len(parts) >= 4 and parts[1] in results:
                st, note = results[parts[1]]
                parts[-1] = format_status(st, note)
                line = "| " + " | ".join(parts[1:-1] + [parts[-1]]) + " |"
        elif line.startswith("|") and "| — |" in line or line.rstrip().endswith("| — |"):
            parts = [p.strip() for p in line.split("|")]
            if len(parts) >= 3:
                tid = parts[1]
                if tid in results and parts[-1] in ("—", ""):
                    st, note = results[tid]
                    parts[-1] = format_status(st, note)
                    line = "| " + " | ".join(parts[1:]) + " |"
                elif tid in results and "Status" not in line:
                    # table row with Status as last col
                    if parts[-1] == "—" or parts[-1].startswith("Pass") or parts[-1].startswith("Partial"):
                        st, note = results.get(tid, (parts[-1], ""))
                        if tid in results:
                            parts[-1] = format_status(st, note)
                            line = "| " + " | ".join(parts[1:]) + " |"
        new_lines.append(line)

    # SMK table has no Status column — add results as third column note in execution log only
    # Second pass: replace trailing | — | when ID is in first column
    out_text = "\n".join(new_lines) + "\n"
    for tid, (st, note) in results.items():
        esc = format_status(st, note)
        pattern = rf"(\| {re.escape(tid)} \|[^|]+\|[^|]+\|) — \|"
        if re.search(pattern, out_text):
            out_text = re.sub(pattern, rf"\1 {esc} |", out_text, count=1)
            continue
        pattern2 = rf"(\| {re.escape(tid)} \|(?:[^|]+\|){{5}}) — \|"
        if re.search(pattern2, out_text):
            out_text = re.sub(pattern2, rf"\1 {esc} |", out_text, count=1)
            continue
        pattern3 = rf"(\| {re.escape(tid)} \|(?:[^|]+\|)+) — \|"
        out_text = re.sub(pattern3, rf"\1 {esc} |", out_text, count=1)

    MATRIX.write_text(out_text, encoding="utf-8")


def main():
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("/tmp/dms_qa_results.jsonl")
    if not path.exists():
        print(f"No results at {path}", file=sys.stderr)
        sys.exit(1)
    apply(load_results(path))
    print(f"Updated {MATRIX}")


if __name__ == "__main__":
    main()
