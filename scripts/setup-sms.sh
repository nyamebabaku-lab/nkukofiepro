#!/usr/bin/env bash
# Sets up real SMS (mNotify) on the Nkukɔ Fie Pro Supabase project:
#   1. creates the sms_log table            (supabase/migrations/20261105020000_sms.sql)
#   2. stores the mNotify key as a secret    (from supabase/functions/.env — never published)
#   3. deploys the send-sms Edge Function
# Usage: npm run sms:setup
set -euo pipefail
cd "$(dirname "$0")/.."
REF=tzslrrptbmhdlhxbfujq

set -a; [ -f .env.local ] && source .env.local; source supabase/functions/.env; set +a
# No token in .env.local? Use the sign-in from "npx supabase login" on this computer.
if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ] && [ -f "$HOME/.supabase/access-token" ]; then SUPABASE_ACCESS_TOKEN="$(cat "$HOME/.supabase/access-token")"; fi
[ -n "${SUPABASE_ACCESS_TOKEN:-}" ] || { echo "✗ Sign in first with: npx supabase login   (or put a token in .env.local)"; exit 1; }
[ -n "${MNOTIFY_API_KEY:-}" ] || { echo "✗ Put your mNotify API key in supabase/functions/.env"; exit 1; }
[ -n "${MNOTIFY_SENDER_ID:-}" ] || { echo "✗ Put your mNotify sender ID in supabase/functions/.env"; exit 1; }
export SUPABASE_ACCESS_TOKEN

echo "→ Creating the SMS log table…"
python3 - "$REF" <<'PY'
import json, os, sys, urllib.request
sql = open('supabase/migrations/20261105020000_sms.sql').read()
req = urllib.request.Request(f'https://api.supabase.com/v1/projects/{sys.argv[1]}/database/query', data=json.dumps({'query': sql}).encode(),
    headers={'Authorization': 'Bearer ' + os.environ['SUPABASE_ACCESS_TOKEN'], 'Content-Type': 'application/json', 'User-Agent': 'nkukofie-setup'})
urllib.request.urlopen(req, timeout=60).read()
print('  done')
PY

echo "→ Saving the mNotify key as a Supabase secret…"
npx --yes supabase@2.54.11 secrets set --project-ref "$REF" --env-file supabase/functions/.env

echo "→ Deploying the send-sms function…"
npx --yes supabase@2.54.11 functions deploy send-sms --project-ref "$REF" --use-api

echo "✓ SMS is ready. Send a test from Nkukɔ Fie Pro Admin → Platform → Data → SMS."
