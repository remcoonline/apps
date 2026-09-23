#!/bin/bash
# SessionStart hook for Claude Code on the web: extracts the AI Studio app
# archive (see CLAUDE.md) and installs its npm dependencies.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

ZIP="copy-of-ai-credit-card-tracker (1).zip"
APP_DIR="ai-credit-card-tracker"

# Extract only if not already present, so existing edits are never overwritten.
if [ ! -f "$APP_DIR/package.json" ]; then
  unzip -q -o "$ZIP" -d "$APP_DIR"
fi

cd "$APP_DIR"
npm install --no-audit --no-fund
