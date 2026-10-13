#!/usr/bin/env bash
# Idempotent Cloud Agent install: Node dependencies plus the Supabase CLI.
# Native stack binaries are prepared only when this checkout has supabase/config.toml.
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive
export SUPABASE_TELEMETRY_DISABLED=1
export DO_NOT_TRACK=1

SUPABASE_VERSION="2.120.0"

if ! command -v supabase >/dev/null 2>&1 || [[ "$(supabase --version | tr -d '[:space:]')" != "$SUPABASE_VERSION" ]]; then
  tmp="$(mktemp --suffix=.deb)"
  curl -fsSL -o "$tmp" \
    "https://github.com/supabase/cli/releases/download/v${SUPABASE_VERSION}/supabase_${SUPABASE_VERSION}_linux_amd64.deb"
  sudo dpkg -i "$tmp"
  rm -f "$tmp"
fi

npm ci

if [[ -f supabase/config.toml ]]; then
  export SUPABASE_EXPERIMENTAL_STACK=1
  supabase stack prepare --runtime native
fi
