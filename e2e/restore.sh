#!/usr/bin/env bash
# =============================================================================
# MARKIPIE · one-shot e2e environment restore
#
# The sandbox wipes node_modules, ~/.cache (Playwright browsers), system apt
# packages and /tmp between sessions. This script restores everything needed
# to build and run the e2e suites, in the fastest safe order. Run it before
# the first build/test of a session:
#
#   bash e2e/restore.sh
#
# Takes roughly 30 to 60 seconds on a fresh sandbox. Steps already satisfied
# are skipped, so it is safe to re-run any time.
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

log() { printf '\033[1;32m[restore]\033[0m %s\n' "$1"; }

# 1. Node dependencies (node_modules is not persisted).
if [ ! -x node_modules/.bin/vite ]; then
  log 'npm install'
  npm install --silent
else
  log 'node_modules present'
fi

# 2. Playwright chromium (browser cache is not persisted).
if ! node -e "require('playwright-core')" 2>/dev/null; then
  log 'playwright-core missing (run npm install first)' >&2
  exit 1
fi
if node -e "
const { chromium } = require('playwright-core');
chromium.launch({ headless: true }).then(b => b.close()).catch(() => process.exit(1));
" 2>/dev/null; then
  log 'chromium already launches'
else
  log 'installing chromium + system libs'
  npx playwright install chromium >/dev/null 2>&1 || true
  sudo apt-get update -q >/dev/null 2>&1 || true
  sudo apt-get install -y -q libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 \
    libatspi2.0-0 libxdamage1 libxkbcommon0 libasound2 >/dev/null
fi

# 3. Fake camera streams for face-scan tests (/tmp is not persisted).
if [ ! -f /tmp/e2e-media/faceA.y4m ]; then
  log 'preparing e2e camera assets'
  ( cd e2e && python3 prepare_assets.py ) >/dev/null
else
  log 'camera assets present'
fi

# 4. Stray chromium processes from an interrupted run eat the 2 GB sandbox.
if pgrep -f headless_shell >/dev/null 2>&1; then
  log 'killing stray chromium processes'
  pkill -9 -f headless_shell || true
  sleep 2
fi

log 'environment ready'
