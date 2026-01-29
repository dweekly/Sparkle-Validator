#!/bin/bash
# Test XSD schema against fixtures
# Usage: ./scripts/test-xsd.sh

set -e
cd "$(dirname "$0")/.."

echo "Testing XSD schema against valid fixtures..."
PASS=0
FAIL=0

for f in test/fixtures/valid/*.xml; do
  if xmllint --schema appcast.xsd --noout "$f" 2>/dev/null; then
    echo "  ✓ $(basename "$f")"
    ((PASS++))
  else
    echo "  ✗ $(basename "$f")"
    ((FAIL++))
  fi
done

echo ""
echo "Results: $PASS passed, $FAIL failed"

if [ $FAIL -gt 0 ]; then
  exit 1
fi
