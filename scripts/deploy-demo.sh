#!/usr/bin/env bash
# Publishes the demo to Cloudflare Pages: https://nkukofie-demo.pages.dev/
# Needs: wrangler login (Cloudflare account) and gh (reads the public Supabase URL/anon key from repo variables).
set -euo pipefail
cd "$(dirname "$0")/.."
export VITE_SUPABASE_URL=$(gh api repos/nyamebabaku-lab/nkukofiepro/actions/variables/SUPABASE_URL --jq .value)
export VITE_SUPABASE_ANON_KEY=$(gh api repos/nyamebabaku-lab/nkukofiepro/actions/variables/SUPABASE_ANON_KEY --jq .value)
VITE_APP=demo OUT_DIR=build/cf-demo npx vite build
rm -rf build/cf-demo/get build/cf-demo/get-farm build/cf-demo/get-admin
npx -y wrangler@3 pages deploy build/cf-demo --project-name nkukofie-demo --branch main --commit-dirty=true
