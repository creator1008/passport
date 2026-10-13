#!/usr/bin/env bash
# Boot-time services. Safe to rerun. Holds the Next.js dev server in the foreground.
set -euo pipefail

export SUPABASE_TELEMETRY_DISABLED=1
export DO_NOT_TRACK=1

if [[ -f supabase/config.toml ]] && command -v supabase >/dev/null 2>&1; then
  export SUPABASE_EXPERIMENTAL_STACK=1

  # Connection refused means the API gateway is down. Any HTTP response means it is up.
  if ! curl -s -o /dev/null --connect-timeout 2 http://127.0.0.1:54321/rest/v1/; then
    supabase start --runtime native --eager --exclude mail,studio,analytics,realtime,functions,pooler
  fi

  # Local demo credentials only. Never overwrite a developer-provided env file.
  if [[ ! -f .env.local ]]; then
    supabase status --env --output-format text \
      --override-name API_URL=NEXT_PUBLIC_SUPABASE_URL \
      --override-name ANON_KEY=NEXT_PUBLIC_SUPABASE_ANON_KEY \
      --override-name SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY \
      > .env.local
  fi
fi

exec npm run dev -- --hostname 0.0.0.0 --port 3000
