#!/usr/bin/env bash
#
# scan-secrets.sh — fail if anything that must NOT be published is present.
#
# Checks the "shippable surface" (committed files, or a clean copy) for:
#   - Wi-Fi credentials (SSID/PSK/PMK byte lists)
#   - real Mushiking barcodes / series labels
#   - card images or a real card database (only *.sample.* may ship)
#
# Usage: scripts/scan-secrets.sh [dir]   (default: repo root)
# Exit 0 = clean, 1 = problems found.

set -u
DIR="${1:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$DIR" || exit 2

fail=0
note() { echo "  ✗ $1"; fail=1; }

# --- the set of files that would actually ship -------------------------------
# Prefer git (honours .gitignore); fall back to find with manual excludes.
FILES=()
if git -C "$DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  while IFS= read -r line; do FILES+=("$line"); done < <(git -C "$DIR" ls-files)
else
  while IFS= read -r line; do FILES+=("${line#./}"); done < <(find . -type f \
    -not -path './node_modules/*' -not -path '*/node_modules/*' \
    -not -path './client/dist/*' -not -path './.git/*' \
    -not -name '*.BIN' -not -name '*.bin' -not -name '*.3ds-backup' -not -name '*.bak' \
    -not -name '*.cfg' \
    -not -path './data/images/*' -not -path './data/cards.json' \
    -not -name 'barcode-config.json' -not -name 'summon-cards.json' \
    -not -path '*/package-lock.json')
fi

echo "Scanning ${#FILES[@]} shippable files in $DIR"

# --- forbidden FILES ---------------------------------------------------------
for f in "${FILES[@]}"; do
  case "$f" in
    *.png|*.jpg|*.jpeg|*.gif|*.webp) note "card image must not ship: $f" ;;
    data/cards.json)                 note "real card DB must not ship: $f (only cards.sample.json)" ;;
    *.BIN|*.bin|*.3ds-backup|*.bak)  note "device blob/backup must not ship: $f" ;;
    config/barcode-config.json|config/summon-cards.json) note "real config must not ship: $f (only *.sample.json)" ;;
    *.cfg)                           note "creds config must not ship: $f" ;;
  esac
done

# --- forbidden CONTENT (text files only) -------------------------------------
# Real barcode prefixes/labels, SSID/PSK, and 8+ contiguous hex byte literals
# (a PMK pasted as 0xNN, 0xNN, ...). Sample placeholders (AA1/BB1/SAMPLE/etc.)
# are intentionally not matched.
BARCODES='MDX[A-Z0-9]{6,}|\b(MC1|ME1|MB1|MS1|MW1|V1L|V2Z|VCQ|VRN)[A-Z0-9]{3,}|SC DS 専用'
CREDS='SPWH[_A-Z0-9]|\bPSK\b *[:=]|passphrase *[:=]|MY_PMK_BYTES[[:space:]]+0x'
PMKHEX='0x[0-9a-fA-F]{2}, *0x[0-9a-fA-F]{2}, *0x[0-9a-fA-F]{2}, *0x[0-9a-fA-F]{2}, *0x[0-9a-fA-F]{2}, *0x[0-9a-fA-F]{2}, *0x[0-9a-fA-F]{2}, *0x[0-9a-fA-F]{2}'

for f in "${FILES[@]}"; do
  case "$f" in
    *.png|*.jpg|*.jpeg|*.gif|*.webp|*.BIN|*.bin|*.bak|*.3ds-backup) continue ;;
    scripts/scan-secrets.sh) continue ;;  # this file defines the patterns
  esac
  [ -f "$f" ] || continue
  if grep -nIEq "$BARCODES" "$f"; then note "real barcode pattern in $f"; grep -nIE "$BARCODES" "$f" | head -2 | sed 's/^/      /'; fi
  if grep -nIEq "$CREDS"    "$f"; then note "credential pattern in $f";   grep -nIE "$CREDS"    "$f" | head -2 | sed 's/^/      /'; fi
  if grep -nIEq "$PMKHEX"   "$f"; then note "PMK-like byte list in $f";   fi
done

if [ "$fail" -eq 0 ]; then
  echo "✓ clean — nothing secret in the shippable surface"
else
  echo "✗ FOUND issues above — do not publish until resolved"
fi
exit "$fail"
