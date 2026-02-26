#!/usr/bin/env sh
set -euo pipefail

# Deploy to Vercel using the fibi-demo project and assign the fibi-demo alias.
VERCEL_TOKEN="${VERCEL_TOKEN:?VERCEL_TOKEN env var is required}"
PROJECT_NAME="${PROJECT_NAME:-car-insurance-claim}"
ALIAS_DOMAIN="${ALIAS_DOMAIN:-car-insurance-claim.vercel.app}"

vercel project add "$PROJECT_NAME" --token "$VERCEL_TOKEN" --yes >/dev/null 2>&1 || true
vercel link --project "$PROJECT_NAME" --token "$VERCEL_TOKEN" --yes >/dev/null 2>&1

DEPLOY_OUTPUT="$(vercel --prod --token "$VERCEL_TOKEN" --yes 2>&1 | tr -d '\r')"
DEPLOY_URL_RAW="$(printf '%s\n' "$DEPLOY_OUTPUT" | rg -o 'Production: https://[^ ]+' || true)"
DEPLOY_URL="$(printf '%s\n' "$DEPLOY_URL_RAW" | head -n 1 | sed 's/Production: //')"

if [ -z "$DEPLOY_URL" ]; then
  DEPLOY_URL_RAW="$(printf '%s\n' "$DEPLOY_OUTPUT" | rg -o 'https://[^ ]+\\.vercel\\.app' || true)"
  DEPLOY_URL="$(printf '%s\n' "$DEPLOY_URL_RAW" | head -n 1)"
fi

if [ -z "$DEPLOY_URL" ]; then
  echo "Failed to extract deployment URL from output." >&2
  exit 1
fi

vercel alias set "$DEPLOY_URL" "$ALIAS_DOMAIN" --token "$VERCEL_TOKEN"
printf 'Production URL: %s\nAlias: https://%s\n' "$DEPLOY_URL" "$ALIAS_DOMAIN"
