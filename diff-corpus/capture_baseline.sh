#!/usr/bin/env bash
# diff-corpus/capture_baseline.sh
#
# Captures the exact stdout/stderr/exit-code + emitted artifacts of every
# corpus entry through the current ChainCSS build pipeline.
#
# Usage:
#   ./diff-corpus/capture_baseline.sh > /tmp/baseline.txt
#   diff diff-corpus/golden_baseline.txt <(./diff-corpus/capture_baseline.sh)

set -uo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
BIN="$REPO/dist/cli/index.js"
CORPUS="$REPO/diff-corpus/inputs"

if [ ! -f "$BIN" ]; then
    echo "error: $BIN not built (run 'npm run build' first)" >&2
    exit 1
fi

{
    echo "# baseline for chaincss v2.15.19 (frozen at phase0-complete)"
    echo "# chaincss $(node "$BIN" --version 2>/dev/null | head -1)"
    echo

    for d in $(find "$CORPUS" -mindepth 1 -maxdepth 1 -type d | sort); do
        name=$(basename "$d")
        echo "======================================================================"
        echo "ENTRY: $name"
        echo "======================================================================"

        rm -rf "$d/dist"
        cd "$d"

        echo "--- build ---"
        node "$BIN" build 2>&1
        echo "build_exit=$?"
        echo

        echo "--- emitted styles.css ---"
        if [ -f dist/styles.css ]; then cat dist/styles.css; else echo "(missing)"; fi
        echo

        echo "--- emitted chaincss-ir.json ---"
        if [ -f dist/chaincss-ir.json ]; then cat dist/chaincss-ir.json; else echo "(missing)"; fi
        echo

        echo "--- check ---"
        node "$BIN" check 2>&1
        echo "check_exit=$?"
        echo

        cd "$REPO"
    done
} | sed \
    -e "s|$REPO|REPO|g" \
    -e 's/in [0-9]\+ms/in XXXms/g' \
    -e 's/"generatedAt": "[^"]*"/"generatedAt": "TIMESTAMP"/g' \
    -e 's/"duration": [0-9.]\+/"duration": 0/g' \
    -e "s/Expected [^,]*, got [^ ]*/Expected <TOKEN>, got <TOKEN>/g"
