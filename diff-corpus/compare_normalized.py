#!/usr/bin/env python3
"""Structural comparison for normalizer parity.

Compares two JSON files that each contain { "ir": StyleIR, "corrections": [...] }.
Normalizes non-deterministic fields (timestamp, IDs) before comparison.
Reports field-level diffs on failure.
"""

import json
import sys
from pathlib import Path

# Fields to ignore during comparison — either non-deterministic,
# or known divergences documented in LANGUAGE_GAPS.md.
IGNORED_PATHS = {
    # G28: timestamps are 0 in ALGOL26, real time in TS.
    "ir.meta.createdAt",
    "ir.meta.compiledAt",
}

# Fields ignored by *key name* at any depth (see G2 update).
# `meta.parsed` requires the CSSValueNode parser (G2's scope),
# deferred to Phase 5b. The unit-normalizer's own contribution
# to it — adding "px" to parsed dimensions — is exercised once
# Phase 5b lands. For now, compare the string `value` field only.
IGNORED_KEYS_ANYWHERE = {"parsed"}


def normalize(obj, path=""):
    if isinstance(obj, dict):
        out = {}
        for k, v in obj.items():
            new_path = f"{path}.{k}" if path else k
            # Skip ignored exact paths.
            if new_path in IGNORED_PATHS:
                continue
            # Skip timestamps at any depth.
            if k in ("timestamp",):
                continue
            # Skip parsed (G2 deferral — see IGNORED_KEYS_ANYWHERE).
            if k in IGNORED_KEYS_ANYWHERE:
                continue
            # Skip nodeId / id — they contain timestamps in TS.
            if k in ("id", "nodeId"):
                continue
            out[k] = normalize(v, new_path)
        return out
    elif isinstance(obj, list):
        return [normalize(item, f"{path}[{i}]") for i, item in enumerate(obj)]
    return obj


def _sort_declarations(ir):
    """G43 workaround: sort declarations by property name before
    comparison. ALGOL26's Map loses insertion order; TS preserves
    source order. Once G43 (ordered-map support) lands, remove this
    and rely on direct comparison.
    """
    if isinstance(ir, dict):
        out = {}
        for k, v in ir.items():
            if k == "declarations" and isinstance(v, list):
                # Sort by property name; use id as tiebreaker for
                # declarations that share a property (multiple
                # values in source order — rare but possible).
                out[k] = sorted(v, key=lambda d: (d.get("property", ""), d.get("id", "")))
            elif k == "corrections" and isinstance(v, list):
                # G43 workaround applies to corrections too — same
                # reason: ALGOL26's Map loses insertion order, TS
                # preserves source order. Sort by property+original
                # for stable comparison.
                out[k] = sorted(
                    v,
                    key=lambda c: (
                        c.get("property", ""),
                        str(c.get("original", "")),
                    ),
                )
            else:
                out[k] = _sort_declarations(v)
        return out
    if isinstance(ir, list):
        return [_sort_declarations(x) for x in ir]
    return ir


def compare(a, b, path=""):
    diffs = []
    if type(a) != type(b):
        diffs.append((path, a, b))
        return diffs
    if isinstance(a, dict):
        keys = set(a.keys()) | set(b.keys())
        for k in keys:
            if k not in a:
                diffs.append((f"{path}.{k}", "<missing>", b[k]))
            elif k not in b:
                diffs.append((f"{path}.{k}", a[k], "<missing>"))
            else:
                diffs.extend(compare(a[k], b[k], f"{path}.{k}"))
    elif isinstance(a, list):
        if len(a) != len(b):
            diffs.append((path, f"len={len(a)}", f"len={len(b)}"))
        for i in range(min(len(a), len(b))):
            diffs.extend(compare(a[i], b[i], f"{path}[{i}]"))
    else:
        if a != b:
            diffs.append((path, a, b))
    return diffs


def main():
    if len(sys.argv) != 3:
        print("usage: compare_normalized.py <ts.json> <gol.json>", file=sys.stderr)
        return 2

    ts = json.loads(Path(sys.argv[1]).read_text())
    gol = json.loads(Path(sys.argv[2]).read_text())

    ts_n = _sort_declarations(normalize(ts))
    gol_n = _sort_declarations(normalize(gol))

    diffs = compare(ts_n, gol_n)
    if not diffs:
        print("  structural match")
        return 0

    print(f"  {len(diffs)} diff(s):", file=sys.stderr)
    for path, a, b in diffs[:20]:
        print(f"    {path}:\n      TS:  {json.dumps(a)[:100]}\n      GOL: {json.dumps(b)[:100]}", file=sys.stderr)
    if len(diffs) > 20:
        print(f"    ... and {len(diffs) - 20} more", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
