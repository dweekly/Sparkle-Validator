#!/bin/bash
# Test all appcast URLs in parallel

URLS_FILE="test/fixtures/remote/appcast-urls.txt"
OUTPUT_DIR="test/fixtures/remote/results"
PARALLELISM=${1:-20}

mkdir -p "$OUTPUT_DIR"

# Extract URLs from the file (skip comments and empty lines)
grep -E '^https?://' "$URLS_FILE" | awk '{print $1}' > /tmp/urls_to_test.txt

TOTAL=$(wc -l < /tmp/urls_to_test.txt | tr -d ' ')
echo "Testing $TOTAL URLs with parallelism of $PARALLELISM..."
echo ""

# Test a single URL and output result
test_url() {
    local url="$1"
    local output
    local count

    output=$(NO_COLOR=1 timeout 20s node dist/cli/index.js "$url" 2>&1)
    exit_code=$?

    if [ $exit_code -eq 124 ]; then
        echo "TIMEOUT $url"
        return
    fi

    # Check for VALID/INVALID using grep (handles leading newlines)
    if echo "$output" | grep -q '^VALID'; then
        count=$(echo "$output" | grep -oE '[0-9]+ warning' | head -1 | awk '{print $1}')
        echo "VALID(${count:-0}w) $url"
    elif echo "$output" | grep -q '^INVALID'; then
        count=$(echo "$output" | grep -oE '[0-9]+ error' | head -1 | awk '{print $1}')
        echo "INVALID(${count:-?}e) $url"
    elif echo "$output" | grep -qi "404\|not found"; then
        echo "404 $url"
    elif echo "$output" | grep -qi "ENOTFOUND\|getaddrinfo"; then
        echo "DNS_FAIL $url"
    elif echo "$output" | grep -qi "ECONNREFUSED\|connection refused"; then
        echo "REFUSED $url"
    elif echo "$output" | grep -qi "certificate\|SSL\|CERT\|TLS"; then
        echo "TLS_ERR $url"
    elif echo "$output" | grep -qi "fetch failed\|Error:"; then
        echo "FETCH_ERR $url"
    else
        echo "UNKNOWN $url"
    fi
}

export -f test_url

# Run in parallel
cat /tmp/urls_to_test.txt | xargs -P $PARALLELISM -I {} bash -c 'test_url "$@"' _ {} 2>&1 | tee "$OUTPUT_DIR/all-results.txt"

echo ""
echo "=== SUMMARY ==="
sort "$OUTPUT_DIR/all-results.txt" | cut -d'(' -f1 | cut -d' ' -f1 | uniq -c | sort -rn
echo ""
echo "Results saved to: $OUTPUT_DIR/all-results.txt"
