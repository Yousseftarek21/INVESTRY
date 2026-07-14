#!/bin/sh
# Push an OTA update to the production channel.
# Runs iOS and Android exports sequentially to stay within memory limits.
# Usage: sh artifacts/mobile/ota.sh ["optional message"]
cd "$(dirname "$0")"

MSG="${1:-$(git log -1 --pretty=%s 2>/dev/null || echo 'INVESTRY update')}"

echo "→ Pushing OTA: $MSG"
echo ""
echo "[ 1/2 ] iOS..."
eas update --channel production --platform ios --message "$MSG" || exit 1
echo ""
echo "[ 2/2 ] Android..."
eas update --channel production --platform android --message "$MSG" || exit 1
echo ""
echo "✓ OTA pushed to both platforms."
