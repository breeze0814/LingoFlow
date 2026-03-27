#!/usr/bin/env bash
set -euo pipefail

CMD=(cargo test --manifest-path src-tauri/Cargo.toml)

if command -v gtimeout >/dev/null 2>&1; then
  exec gtimeout 60s "${CMD[@]}"
fi

if command -v timeout >/dev/null 2>&1; then
  exec timeout 60s "${CMD[@]}"
fi

exec perl -e 'alarm shift; exec @ARGV' 60 "${CMD[@]}"

