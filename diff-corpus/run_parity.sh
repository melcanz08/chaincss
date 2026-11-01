#!/usr/bin/env bash
CORPUS=(001-card 002-button 003-lenient-passthrough)
ALGOL26=~/dev/algol26/target/debug/algol26
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

  echo "  [1/4] ts-export-source..."
  if ! npx -y tsx --tsconfig "$CHAINDIR/tsconfig.json" "$CHAINDIR/diff-corpus/ts-export-source.ts" "$chain_file" > "$OUTDIR/$entry.source.json" 2>"$OUTDIR/$entry.export.err"; then
    echo "  FAIL"; head -5 "$OUTDIR/$entry.export.err"; FAIL=$((FAIL+1)); continue
  fi

  echo "  [2/4] ts-parseir..."
  if ! npx -y tsx --tsconfig "$CHAINDIR/tsconfig.json" "$CHAINDIR/diff-corpus/ts-parseir.ts" "$chain_file" > "$OUTDIR/$entry.ts.json" 2>"$OUTDIR/$entry.parseir.err"; then
    echo "  FAIL"; head -5 "$OUTDIR/$entry.parseir.err"; FAIL=$((FAIL+1)); continue
  fi

  # Stage input for ALGOL26 program
  cp "$OUTDIR/$entry.source.json" "$OUTDIR/current_input.json"
  echo "$source_name" > "$OUTDIR/current_source.txt"

  echo "  [3/4] algol26 parse_ir..."
  (cd "$ALGOLDIR/src/chaincss" && "$ALGOL26" --interpreter run "$ALGOLDIR/tests/chaincss/parse_ir_parity.gol" 2>"$OUTDIR/$entry.algol26.err")
  if [ ! -s "$OUTDIR/current_output.json" ]; then
    echo "  FAIL: empty output"; head -10 "$OUTDIR/$entry.algol26.err"; FAIL=$((FAIL+1)); continue
  fi
  mv "$OUTDIR/current_output.json" "$OUTDIR/$entry.algol26.json"

  echo "  [4/4] compare..."
  if python3 "$CHAINDIR/diff-corpus/compare_parseir.py" "$OUTDIR/$entry.ts.json" "$OUTDIR/$entry.algol26.json"; then
    PASS=$((PASS+1))
  else
    FAIL=$((FAIL+1))
  fi
done

echo
echo "=== Summary: $PASS pass, $FAIL fail ==="
exit $FAIL
