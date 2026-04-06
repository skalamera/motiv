#!/usr/bin/env bash
# Confirm Google Cloud settings for Maps (run after: gcloud auth login)
#
# Motiv GCP (this app’s Google Cloud project ID is motiv-492421):
#   gcloud config set account skalamera@gmail.com
#   gcloud config set project motiv-492421
#
# Usage: ./scripts/verify-gcp-maps-settings.sh [PROJECT_ID]
#   Example: ./scripts/verify-gcp-maps-settings.sh motiv-492421
set -euo pipefail

PROJECT="${1:-$(gcloud config get-value project 2>/dev/null)}"
if [[ -z "${PROJECT}" || "${PROJECT}" == "(unset)" ]]; then
  echo "No project set. Run: gcloud config set project YOUR_PROJECT_ID"
  exit 1
fi

echo "=========================================="
echo "Project: ${PROJECT}"
echo "Account: $(gcloud config get-value account 2>/dev/null || echo unknown)"
echo "=========================================="
echo ""

echo "=== Billing (must be linked for Maps Platform) ==="
gcloud billing projects describe "${PROJECT}" \
  --format='table(billingAccountName,billingEnabled)' || true
echo ""

echo "=== Maps-related APIs (enabled) ==="
# Service IDs vary; list anything with maps/geocoding/places/routes in the name.
gcloud services list --enabled --project="${PROJECT}" --format='value(config.name)' \
  | grep -E 'maps|geocoding|places|routes|directions|distance|streetview' \
  || echo "(none matched — enable Maps JavaScript API in APIs & Services → Library)"
echo ""

echo "=== API keys (display name + resource name; key string is NOT shown) ==="
gcloud services api-keys list --project="${PROJECT}" \
  --format='table(name,displayName,uid)' 2>/dev/null || {
  echo "If this failed, try: gcloud components update && gcloud services api-keys list --project=${PROJECT}"
}
echo ""
echo "Edit restrictions in Cloud Console:"
echo "  APIs & Services → Credentials → select key → Application restrictions / API restrictions"
echo "Maps setup:"
echo "  https://console.cloud.google.com/google/maps-apis/overview?project=${PROJECT}"
