#!/usr/bin/env bash
# One-time setup: creates the node_modules/chaincss symlink so the
# corpus config files can resolve `import { defineConfig } from 'chaincss'`.
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$REPO/diff-corpus/node_modules"
ln -sfn "$REPO" "$REPO/diff-corpus/node_modules/chaincss"
echo "linked $REPO/diff-corpus/node_modules/chaincss -> $REPO"
