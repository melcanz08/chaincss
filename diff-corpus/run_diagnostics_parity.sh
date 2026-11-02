#!/usr/bin/env bash
# run_diagnostics_parity.sh — Phase 2D parity driver.
#
# For each scenario in inputs/005-diag-*:
#   1. Run TS oracle → /tmp/chaincss-parity/<scenario>.ts.json
#   2. Stage scenario as current_scenario.json
#   3. Run ALGOL26 harness → /tmp/chaincss-parity/current_diag_output.json
#   4. Move to /tmp/chaincss-parity/<scenario>.algol26.json
#   5. Run comparator → OK or MISMATCH

SCENARIOS=(005-diag-empty 005-diag-errors-only 005-diag-mixed-with-suggestions 005-diag-with-file-location)
ALGOL26=~/dev/algol26/target/release/algol26
CHAINDIR=~/dev/web/chaincss
ALGOLDIR=~/dev/algol26
OUTDIR=/tmp/chaincss-parity
mkdir -p "$OUTDIR"
PASS=0; FAIL=0

for entry in "${SCENARIOS[@]}"; do
  echo "=== $entry ==="
  scenario_file="$CHAINDIR/diff-corpus/inputs/$entry/scenario.json"
  if [ ! -f "$scenario_file" ]; then echo "  SKIP (no scenario.json)"; continue; fi

  echo "  [1/4] ts-format-report..."
  if ! npx -y tsx --tsconfig "$CHAINDIR/tsconfig.json" "$CHAINDIR/diff-corpus/ts-format-report.ts" "$scenario_file" > "$OUTDIR/$entry.ts.json" 2>"$OUTDIR/$entry.ts.err"; then
    echo "  FAIL (ts)"; head -10 "$OUTDIR/$entry.ts.err"; FAIL=$((FAIL+1)); continue
  fi

  echo "  [2/4] stage..."
  cp "$scenario_file" "$OUTDIR/current_scenario.json"
  echo "$entry" > "$OUTDIR/current_scenario_name.txt"

  echo "  [3/4] algol26..."
  rm -f "$OUTDIR/current_diag_output.json"
  (cd "$ALGOLDIR/src/chaincss" && "$ALGOL26" --interpreter run "$ALGOLDIR/tests/chaincss/diagnostics_format_parity.gol" 2>"$OUTDIR/$entry.algol26.err")
  if [ ! -s "$OUTDIR/current_diag_output.json" ]; then
    echo "  FAIL (algol26 empty)"; head -10 "$OUTDIR/$entry.algol26.err"; FAIL=$((FAIL+1)); continue
  fi
  mv "$OUTDIR/current_diag_output.json" "$OUTDIR/$entry.algol26.json"

  echo "  [4/4] compare..."
  if python3 "$CHAINDIR/diff-corpus/compare_diagnostics.py" "$OUTDIR/$entry.ts.json" "$OUTDIR/$entry.algol26.json"; then
    PASS=$((PASS+1))
  else
    FAIL=$((FAIL+1))
  fi
done

echo ""
echo "=== Summary: $PASS pass, $FAIL fail ==="
[ "$FAIL" -eq 0 ]
