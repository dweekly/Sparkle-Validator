#!/bin/bash
# Fetch URL with local file caching
# Usage: ./fetch-cached.sh <url>

URL="$1"
CACHE_DIR="$(dirname "$0")/cache"

if [ -z "$URL" ]; then
  echo "Usage: $0 <url>" >&2
  exit 1
fi

# Create safe filename from URL
CACHE_FILE="$CACHE_DIR/$(echo "$URL" | sed 's/[^a-zA-Z0-9]/_/g').xml"

# Use cache if fresh (less than 1 hour old)
if [ -f "$CACHE_FILE" ] && [ $(find "$CACHE_FILE" -mmin -60 2>/dev/null | wc -l) -gt 0 ]; then
  cat "$CACHE_FILE"
else
  # Fetch and cache
  curl -sL --max-time 15 "$URL" | tee "$CACHE_FILE"
fi
