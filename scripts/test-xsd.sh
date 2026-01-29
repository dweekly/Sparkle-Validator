#!/bin/bash
# Test XSD schema against fixtures and real-world appcasts
# Usage: ./scripts/test-xsd.sh

set -e
cd "$(dirname "$0")/.."

PASS=0
FAIL=0
EXPECTED_FAIL=0

echo "=== Testing XSD schema ==="
echo ""

# Test valid fixtures (should all pass)
echo "Valid fixtures (should pass):"
for f in test/fixtures/valid/*.xml; do
  if xmllint --schema appcast.xsd --noout "$f" 2>/dev/null; then
    echo "  ✓ $(basename "$f")"
    ((PASS++))
  else
    echo "  ✗ $(basename "$f") - UNEXPECTED FAILURE"
    ((FAIL++))
  fi
done

echo ""

# Test structurally invalid fixtures (should fail XSD)
echo "Structural errors (should fail XSD):"
STRUCTURAL_INVALID=(
  "malformed.xml"      # Not well-formed XML
  "not-rss.xml"        # Root is not <rss>
  "no-channel.xml"     # Missing <channel>
  "bad-namespace.xml"  # Wrong namespace
  # Note: no-items.xml moved to semantic - XSD can't enforce "at least one item"
  # while also allowing flexible element ordering
)
for f in "${STRUCTURAL_INVALID[@]}"; do
  path="test/fixtures/invalid/$f"
  if [ -f "$path" ]; then
    if xmllint --schema appcast.xsd --noout "$path" 2>/dev/null; then
      echo "  ✗ $f - UNEXPECTED PASS"
      ((FAIL++))
    else
      echo "  ✓ $f (correctly rejected)"
      ((EXPECTED_FAIL++))
    fi
  fi
done

echo ""

# Test semantic-only invalid fixtures (valid XML structure, caught by our validator)
echo "Semantic errors (valid XSD, caught by validator):"
SEMANTIC_INVALID=(
  "missing-version.xml"
  "empty-version.xml"
  "bad-date.xml"
  "invalid-signature.xml"
  "no-items.xml"  # XSD allows empty channels for flexibility
)
for f in "${SEMANTIC_INVALID[@]}"; do
  path="test/fixtures/invalid/$f"
  if [ -f "$path" ]; then
    if xmllint --schema appcast.xsd --noout "$path" 2>/dev/null; then
      echo "  ✓ $f (XSD passes, validator catches)"
      ((PASS++))
    else
      echo "  ? $f (XSD fails - may need review)"
      ((FAIL++))
    fi
  fi
done

echo ""

# Test real-world appcasts (optional, requires network)
if [ "$1" = "--remote" ]; then
  echo "Real-world appcasts:"
  REMOTE_URLS=(
    "https://iterm2.com/appcasts/final_modern.xml"
    "https://kapeli.com/Dash7.xml"
    "http://skim-app.sourceforge.net/skim.xml"
  )
  for url in "${REMOTE_URLS[@]}"; do
    name=$(basename "$url")
    if curl -sL "$url" | xmllint --schema appcast.xsd --noout - 2>/dev/null; then
      echo "  ✓ $name"
      ((PASS++))
    else
      echo "  ✗ $name"
      ((FAIL++))
    fi
  done
  echo ""
fi

echo "=== Results ==="
echo "Passed: $PASS"
echo "Expected failures: $EXPECTED_FAIL"
echo "Unexpected: $FAIL"
echo ""

if [ $FAIL -gt 0 ]; then
  echo "FAILED - $FAIL unexpected results"
  exit 1
else
  echo "SUCCESS"
  exit 0
fi
