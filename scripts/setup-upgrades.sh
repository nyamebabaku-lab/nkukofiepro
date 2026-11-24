#!/usr/bin/env bash
# Turns on the three upgrades on the live Nkukɔ Fie Pro project:
#   1. Database: payments log, marketplace tables, AI vet usage, disease watch
#      (supabase/migrations/20261124000000_market_payments_vet.sql — only adds; changes no existing data)
#   2. Secrets (typed here, never saved in the project): Paystack secret key and the FREE AI keys
#      (Google AI Studio for Gemini, and Groq) used by the AI vet
#   3. Deploys the Edge Functions "pay" (Paystack) and "ai-vet"
# Usage: bash scripts/setup-upgrades.sh          (run again any time to change a key)
set -euo pipefail
cd "$(dirname "$0")/.."
REF=tzslrrptbmhdlhxbfujq
CLI="npx --yes supabase@2.54.11"

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ] && [ -f "$HOME/.supabase/access-token" ]; then SUPABASE_ACCESS_TOKEN="$(cat "$HOME/.supabase/access-token")"; fi
[ -n "${SUPABASE_ACCESS_TOKEN:-}" ] || { echo "✗ Sign in first with: npx supabase login"; exit 1; }
export SUPABASE_ACCESS_TOKEN

echo "→ 1/3  Updating the database…"
python3 - "$REF" <<'PY'
import json, os, sys, urllib.request
sql = open('supabase/migrations/20261124000000_market_payments_vet.sql').read()
req = urllib.request.Request(f'https://api.supabase.com/v1/projects/{sys.argv[1]}/database/query', data=json.dumps({'query': sql}).encode(),
    headers={'Authorization': 'Bearer ' + os.environ['SUPABASE_ACCESS_TOKEN'], 'Content-Type': 'application/json', 'User-Agent': 'nkukofie-setup'})
urllib.request.urlopen(req, timeout=120).read()
print('   done')
PY

echo "→ 2/3  Keys (press Enter to keep the one already saved)"
TMP="$(mktemp)"; trap 'rm -f "$TMP"' EXIT
read -rsp "   Paystack SECRET key (sk_test_… or sk_live_…): " PSK; echo
read -rsp "   Google AI Studio (Gemini) API key — free at aistudio.google.com/apikey: " GK; echo
read -rsp "   Groq API key — free at console.groq.com/keys: " QK; echo
[ -n "$PSK" ] && echo "PAYSTACK_SECRET_KEY=$PSK" >> "$TMP"
[ -n "$GK" ] && echo "GEMINI_API_KEY=$GK" >> "$TMP"
[ -n "$QK" ] && echo "GROQ_API_KEY=$QK" >> "$TMP"
echo "APP_SITE=https://nyamebabaku-lab.github.io/nkukofiepro/" >> "$TMP"
$CLI secrets set --project-ref "$REF" --env-file "$TMP" >/dev/null && echo "   saved"

echo "→ 3/3  Deploying the payment and AI vet functions…"
$CLI functions deploy pay --project-ref "$REF" --no-verify-jwt --use-api
$CLI functions deploy ai-vet --project-ref "$REF" --use-api

cat <<EOF

✓ Done.
  • Paystack dashboard → Settings → API Keys & Webhooks → Webhook URL:
      https://$REF.supabase.co/functions/v1/pay?hook=1
  • Each farm owner: Farm app → Settings → Payments & marketplace → add the payout MoMo/bank and the farm's region/district.
  • You: Admin app → Platform → Money, AI & buyers → set the platform fee and AI vet quotas.
EOF
