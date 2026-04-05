#!/usr/bin/env bash
# Push Motiv env vars from a local file into Vercel (production, preview, development).
# Prereq: `vercel link` from repo root (already done if .vercel/project.json exists).
#
# Usage:
#   ./scripts/sync-env-to-vercel.sh              # uses .env.local
#   ./scripts/sync-env-to-vercel.sh ./.env.prod  # custom file
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${1:-$ROOT/.env.local}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE"
  echo "Create it with keys from Supabase + Vercel AI Gateway (see README)."
  exit 1
fi

cd "$ROOT"

# Load KEY=VALUE lines (skip comments / blank lines). Values may be quoted.
while IFS= read -r line || [[ -n "$line" ]]; do
  [[ "$line" =~ ^[[:space:]]*# ]] && continue
  [[ -z "${line// }" ]] && continue
  export "$line"
done < "$ENV_FILE"

required=(
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
  AI_GATEWAY_API_KEY
)

for key in "${required[@]}"; do
  if [[ -z "${!key:-}" ]]; then
    echo "Missing required variable in $ENV_FILE: $key"
    exit 1
  fi
done

sensitive_keys=(
  SUPABASE_SERVICE_ROLE_KEY
  AI_GATEWAY_API_KEY
  NEWS_API_KEY
  GOOGLE_GENERATIVE_AI_API_KEY
)

is_sensitive() {
  local k="$1"
  local s
  for s in "${sensitive_keys[@]}"; do
    [[ "$k" == "$s" ]] && return 0
  done
  return 1
}

vercel_targets=(production preview development)

upsert_var() {
  local name="$1"
  local value="$2"
  local target="$3"
  local args=(env add "$name" "$target" --value "$value" --yes --force)
  if is_sensitive "$name"; then
    args+=(--sensitive)
  fi
  vercel "${args[@]}"
}

# Only sync keys we care about (avoid leaking unrelated vars from .env.local)
keys_to_sync=(
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
  AI_GATEWAY_API_KEY
  NEWS_API_KEY
  GOOGLE_GENERATIVE_AI_API_KEY
)

for key in "${keys_to_sync[@]}"; do
  val="${!key:-}"
  [[ -z "$val" ]] && continue
  for target in "${vercel_targets[@]}"; do
    echo "Setting $key ($target)…"
    upsert_var "$key" "$val" "$target"
  done
done

echo "Done. Redeploy on Vercel if the project was already built without these variables."
