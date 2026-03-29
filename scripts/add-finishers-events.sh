#!/bin/zsh
set -euo pipefail

BASE_PATH="${1:-/en/events}"
START_PAGE="${2:-1}"
END_PAGE="${3:-5}"
OUTPUT_JSON="${4:-scripts/generated-finishers-events.json}"
SEEN_AT="${SEEN_AT:-$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")}"

tmpdir="$(mktemp -d /tmp/finishers-pilot.XXXXXX)"
cleanup() {
  rm -rf "$tmpdir"
}
trap cleanup EXIT

for page in $(seq "$START_PAGE" "$END_PAGE"); do
  curl -L --max-time 20 -A 'Mozilla/5.0' -s "https://www.finishers.com${BASE_PATH}?page=${page}" -o "$tmpdir/page-${page}.html"
done

node scripts/add-finishers-events.js --html-dir "$tmpdir" --output-json "$OUTPUT_JSON" --seen-at "$SEEN_AT"
