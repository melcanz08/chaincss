#!/usr/bin/env python3
"""compare_diagnostics.py — structural diff for diagnostics parity.

Reads two JSON files (TS oracle output, ALGOL26 output). Each is
{"report": {...}, "rendered": "..."}. Normalizes non-deterministic
fields (id, timestamp, generatedAt) and compares:
  - report.diagnostics[*] structurally (all fields except id/timestamp)
  - report.summary
  - report.version
  - rendered string byte-for-byte

Exit 0 on match, 1 on mismatch with a diff printed to stderr.
"""
import json
import sys


def normalize_report(report: dict) -> dict:
    """Strip non-deterministic fields and return the comparable shape."""
    out = {
        "diagnostics": [],
        "summary": report.get("summary", {}),
        "version": report.get("version", ""),
    }
    for d in report.get("diagnostics", []):
        out["diagnostics"].append({
            "severity": d.get("severity"),
            "message": d.get("message"),
            "file": d.get("file"),
            "line": d.get("line"),
            "column": d.get("column"),
            "code": d.get("code"),
            "suggestion": d.get("suggestion"),
            "metadata": d.get("metadata"),
        })
    return out


def main():
    if len(sys.argv) != 3:
        print("usage: compare_diagnostics.py <ts.json> <algol26.json>", file=sys.stderr)
        sys.exit(2)

    with open(sys.argv[1]) as f:
        ts = json.load(f)
    with open(sys.argv[2]) as f:
        a26 = json.load(f)

    ts_rep = normalize_report(ts["report"])
    a26_rep = normalize_report(a26["report"])

    mismatches = []
    if ts_rep != a26_rep:
        mismatches.append("report structure differs")
        # Detailed per-field diff
        ts_d = ts_rep["diagnostics"]
        a26_d = a26_rep["diagnostics"]
        if len(ts_d) != len(a26_d):
            mismatches.append(f"  diagnostics count: ts={len(ts_d)}, a26={len(a26_d)}")
        for i in range(min(len(ts_d), len(a26_d))):
            for key in ts_d[i]:
                if ts_d[i][key] != a26_d[i][key]:
                    mismatches.append(
                        f"  diag[{i}].{key}: ts={ts_d[i][key]!r}, a26={a26_d[i][key]!r}"
                    )
        for key in ts_rep["summary"]:
            if ts_rep["summary"][key] != a26_rep["summary"].get(key):
                mismatches.append(
                    f"  summary.{key}: ts={ts_rep['summary'][key]}, "
                    f"a26={a26_rep['summary'].get(key)}"
                )

    # Rendered string — the file's actual output. Timestamp is
    # normalized to epoch zero in both sides, so no string substitution
    # needed. Compare raw bytes.
    ts_r = ts.get("rendered", "")
    a26_r = a26.get("rendered", "")
    if ts_r != a26_r:
        mismatches.append("rendered string differs")
        # Print a short line-level diff
        ts_lines = ts_r.split("\n")
        a26_lines = a26_r.split("\n")
        if len(ts_lines) != len(a26_lines):
            mismatches.append(f"  line count: ts={len(ts_lines)}, a26={len(a26_lines)}")
        for i in range(min(len(ts_lines), len(a26_lines))):
            if ts_lines[i] != a26_lines[i]:
                mismatches.append(f"  line {i}: ts={ts_lines[i]!r}")
                mismatches.append(f"           a26={a26_lines[i]!r}")

    if mismatches:
        print("MISMATCH:", file=sys.stderr)
        for m in mismatches:
            print(m, file=sys.stderr)
        sys.exit(1)

    print("OK")


if __name__ == "__main__":
    main()
