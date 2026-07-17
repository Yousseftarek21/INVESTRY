#!/bin/sh
# Push an OTA update to the production channel.
# We export the bundle ourselves first (avoids EAS's export runner hitting
# memory limits), then pass the pre-built dist to EAS via --input-dir.
# Usage: sh artifacts/mobile/ota.sh ["optional message"]
cd "$(dirname "$0")"

MSG="${1:-$(git log -1 --pretty=%s 2>/dev/null || echo 'INVESTRY update')}"

echo "→ Pushing OTA: $MSG"
echo ""

echo "[ 1/3 ] Exporting iOS bundle..."
pnpm expo export --output-dir dist --dump-sourcemap --dump-assetmap --platform ios || exit 1

echo ""
echo "[ 2/3 ] Uploading iOS update to EAS..."
pnpm exec eas update --channel production --platform ios --input-dir dist --message "$MSG" || exit 1

echo ""
echo "[ 3/3 ] Cleaning up..."
rm -rf dist

echo ""
echo "✓ iOS OTA pushed successfully."
