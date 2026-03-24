#!/bin/bash
# upload-medals.sh — Upload medal photos to community database
#
# HOW TO USE:
#   1. Paste your Supabase service_role key below (Settings → API → service_role)
#   2. Drop medal photos into the medals-to-upload/ folder
#      (see medals-to-upload/HOW_TO_NAME_FILES.txt for naming rules)
#   3. Run: bash upload-medals.sh

SUPABASE_SERVICE_KEY="PASTE_YOUR_SERVICE_ROLE_KEY_HERE"

# ─── Don't edit below this line ──────────────────────────────────────────────

SUPABASE_URL="https://yqzycwuyhvzkbofwkazr.supabase.co"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ "$SUPABASE_SERVICE_KEY" = "PASTE_YOUR_SERVICE_ROLE_KEY_HERE" ]; then
  echo "❌  Please paste your Supabase service_role key into upload-medals.sh first."
  echo "    Find it at: Supabase Dashboard → Settings → API → service_role"
  exit 1
fi

if [ ! -d "$SCRIPT_DIR/medals-to-upload" ]; then
  echo "❌  medals-to-upload/ folder not found."
  exit 1
fi

IMAGE_COUNT=$(find "$SCRIPT_DIR/medals-to-upload" -maxdepth 1 \( -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" -o -name "*.webp" \) | wc -l | tr -d ' ')

if [ "$IMAGE_COUNT" -eq 0 ]; then
  echo "📭  No images found in medals-to-upload/"
  echo "    Add medal photos and see HOW_TO_NAME_FILES.txt for naming rules."
  exit 0
fi

echo "📸  Found $IMAGE_COUNT image(s). Starting upload..."
echo ""

SUPABASE_URL="$SUPABASE_URL" \
SUPABASE_SERVICE_KEY="$SUPABASE_SERVICE_KEY" \
node "$SCRIPT_DIR/scripts/seed-medals.js" "$SCRIPT_DIR/medals-to-upload"
