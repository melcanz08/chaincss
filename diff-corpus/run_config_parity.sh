#!/usr/bin/env bash
CORPUS=(001-card 002-button 003-lenient-passthrough 004-invalid)
ALGOL26=~/dev/algol26/target/debug/algol26
CHAINDIR=~/dev/web/chaincss
ALGOLDIR=~/dev/algol26
OUTDIR=/tmp/chaincss-parity
mkdir -p "$OUTDIR"
PASS=0; FAIL=0

for entry in "${CORPUS[@]}"; do
  echo "=== $entry ==="
  config_file="$CHAINDIR/diff-corpus/inputs/$entry/chaincss.config.json"
  if [ ! -f "$config_file" ]; then echo "  SKIP: no .json config"; continue; fi

  echo "  [1/3] ts-loadconfig..."
  if ! npx -y tsx --tsconfig "$CHAINDIR/tsconfig.json" \
       "$CHAINDIR/diff-corpus/ts-loadconfig.ts" "$config_file" \
       > "$OUTDIR/$entry.config.ts.json" 2>"$OUTDIR/$entry.config.ts.err"; then
    echo "  FAIL: ts-loadconfig"
    head -3 "$OUTDIR/$entry.config.ts.err"
    FAIL=$((FAIL+1)); continue
  fi

  echo "  [2/3] algol26 load_config..."
  cp "$config_file" "$OUTDIR/current_config.json"
  ( cd "$ALGOLDIR/src/chaincss" && \
    "$ALGOL26" --interpreter run "$ALGOLDIR/tests/chaincss/config_parity.gol" \
      2>"$OUTDIR/$entry.config.alg.err" )
  if [ ! -s "$OUTDIR/current_config_output.json" ]; then
    echo "  FAIL: algol26 empty output"
    head -5 "$OUTDIR/$entry.config.alg.err"
    FAIL=$((FAIL+1)); continue
  fi
  mv "$OUTDIR/current_config_output.json" "$OUTDIR/$entry.config.algol26.json"

  echo "  [3/3] compare..."
  if python3 "$CHAINDIR/diff-corpus/compare_parseir.py" \
       "$OUTDIR/$entry.config.ts.json" "$OUTDIR/$entry.config.algol26.json"; then
    PASS=$((PASS+1))
  else
    FAIL=$((FAIL+1))
  fi
done
echo
echo "=== Summary: $PASS pass, $FAIL fail ==="
exit $FAIL
