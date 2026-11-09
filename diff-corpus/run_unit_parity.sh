#!/usr/bin/env bash
# run_unit_parity.sh — Phase 5 differential test for unit-normalizer.
#
# For each corpus entry:
#   1. ts-export-source.ts   → source.json (raw StyleDefinition)
#   2. ts-parseir.ts          → ts.json (StyleIR after parseIR)
#   3. ts-unit-normalize.ts   → ts-norm.json (after unitNormalizer)
#   4. algol26 normalizer_parity → gol-norm.json
#   5. compare_normalized.py  → structural diff

set -e
CORPUS=(001-card 002-button 003-lenient-passthrough 005-unit-normalizer-stress)
ALGOL26=~/dev/algol26/target/release/algol26
CHAINDIR=~/dev/web/chaincss
ALGOLDIR=~/dev/algol26
OUTDIR=/tmp/chaincss-parity
mkdir -p "$OUTDIR"
PASS=0; FAIL=0

for entry in "${CORPUS[@]}"; do
    echo "=== $entry ==="
    src_dir="$CHAINDIR/diff-corpus/inputs/$entry/src"
    chain_file=$(find "$src_dir" -name '*.chain.ts' -not -name '*.class.ts' | head -1)
    if [ -z "$chain_file" ]; then echo "  SKIP"; continue; fi
    basename=$(basename "$chain_file")
    source_name="src/${basename}"

    echo "  [1/5] ts-export-source..."
    if ! npx -y tsx --tsconfig "$CHAINDIR/tsconfig.json" "$CHAINDIR/diff-corpus/ts-export-source.ts" "$chain_file" > "$OUTDIR/$entry.source.json" 2>"$OUTDIR/$entry.export.err"; then
        echo "  FAIL: ts-export-source"; head -5 "$OUTDIR/$entry.export.err"; FAIL=$((FAIL+1)); continue
    fi

    echo "  [2/5] ts-parseir..."
    if ! npx -y tsx --tsconfig "$CHAINDIR/tsconfig.json" "$CHAINDIR/diff-corpus/ts-parseir.ts" "$chain_file" > "$OUTDIR/$entry.ts.json" 2>"$OUTDIR/$entry.parseir.err"; then
        echo "  FAIL: ts-parseir"; head -5 "$OUTDIR/$entry.parseir.err"; FAIL=$((FAIL+1)); continue
    fi

    echo "  [3/5] ts-unit-normalize..."
    if ! npx -y tsx --tsconfig "$CHAINDIR/tsconfig.json" "$CHAINDIR/diff-corpus/ts-unit-normalize.ts" "$OUTDIR/$entry.ts.json" > "$OUTDIR/$entry.ts-norm.json" 2>"$OUTDIR/$entry.norm.err"; then
        echo "  FAIL: ts-unit-normalize"; head -5 "$OUTDIR/$entry.norm.err"; FAIL=$((FAIL+1)); continue
    fi

    echo "  [4/5] algol26 normalizer_parity..."
    cp "$OUTDIR/$entry.source.json" "$OUTDIR/current_input.json"
    printf '%s' "$source_name" > "$OUTDIR/current_source.txt"
    if ! timeout 30 "$ALGOL26" run "$ALGOLDIR/src/chaincss/normalizer_parity.gol" --interpreter > "$OUTDIR/$entry.gol-norm.json" 2>"$OUTDIR/$entry.gol.err"; then
        echo "  FAIL: algol26 normalizer_parity"; head -10 "$OUTDIR/$entry.gol.err"; FAIL=$((FAIL+1)); continue
    fi

    echo "  [5/5] compare..."
    if python3 "$CHAINDIR/diff-corpus/compare_normalized.py" "$OUTDIR/$entry.ts-norm.json" "$OUTDIR/$entry.gol-norm.json"; then
        echo "  PASS"; PASS=$((PASS+1))
    else
        echo "  FAIL: diff"; FAIL=$((FAIL+1))
    fi
done

echo ""
echo "=== Summary: $PASS pass, $FAIL fail ==="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
