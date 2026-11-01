#!/usr/bin/env python3
"""compare_parseir.py — differential comparator for Phase 2D parity."""
import json
import sys

IGNORED_KEYS = {"createdAt", "compiledAt", "timestamp", "parsed"}


def normalize(obj):
    if isinstance(obj, dict):
        result = {k: normalize(v) for k, v in obj.items() if k not in IGNORED_KEYS}
        # G20: sort declaration arrays by `property`. ALGOL26 Map.keys()
        # sorts lexicographically; TS Object.entries is insertion order.
        # Semantically equivalent (CSS declaration order is not significant),
        # but array order differs. Sorting canonicalizes both sides.
        if "declarations" in result and isinstance(result["declarations"], list):
            result["declarations"] = sorted(
                result["declarations"],
                key=lambda d: d.get("property", "") if isinstance(d, dict) else ""
            )
        # G21: pseudoClasses/atRules entries' `id` values differ because
        # TS uses nextId("hover") → "hover-N" (counter-based) while ALGOL26
        # uses a descriptive string. Ignore id in these sub-entries —
        # semantic content is preserved via name/parentId/declarations/history.
        for key in ("pseudoClasses", "atRules"):
            if key in result and isinstance(result[key], list):
                for entry in result[key]:
                    if isinstance(entry, dict) and "id" in entry:
                        del entry["id"]
        return result
    if isinstance(obj, list):
        return [normalize(x) for x in obj]
    if isinstance(obj, (int, float)) and not isinstance(obj, bool):
        return float(obj)
    return obj


def canonicalize(obj):
    if isinstance(obj, dict):
        return {k: canonicalize(obj[k]) for k in sorted(obj.keys())}
    if isinstance(obj, list):
        return [canonicalize(x) for x in obj]
    return obj


def first_divergence(a, b, path=""):
    if type(a) != type(b):
        return (path or "$", a, b)
    if isinstance(a, dict):
        ka, kb = set(a.keys()), set(b.keys())
        if ka != kb:
            return (path or "$", f"missing: {sorted(ka-kb)}", f"extra: {sorted(kb-ka)}")
        for k in sorted(ka):
            d = first_divergence(a[k], b[k], f"{path}.{k}")
            if d:
                return d
        return None
    if isinstance(a, list):
        if len(a) != len(b):
            return (path or "$", f"length {len(a)}", f"length {len(b)}")
        for i, (x, y) in enumerate(zip(a, b)):
            d = first_divergence(x, y, f"{path}[{i}]")
            if d:
                return d
        return None
    if a != b:
        return (path or "$", a, b)
    return None


def main():
    if len(sys.argv) != 3:
        print("Usage: compare_parseir.py <ts.json> <algol26.json>", file=sys.stderr)
        return 2
    with open(sys.argv[1]) as f:
        ts = canonicalize(normalize(json.load(f)))
    with open(sys.argv[2]) as f:
        alg = canonicalize(normalize(json.load(f)))

    if ts == alg:
        print(f"PASS: {sys.argv[1]} == {sys.argv[2]}")
        return 0

    d = first_divergence(ts, alg)
    print(f"FAIL: {sys.argv[1]} != {sys.argv[2]}")
    if d:
        path, tv, av = d
        print(f"  First divergence at: {path}")
        print(f"  TS:      {tv!r}")
        print(f"  ALGOL26: {av!r}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
