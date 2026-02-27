#!/usr/bin/env bash
# build-pdfs.sh — Generuje PDFy dokumentacji Kenaz przez pandoc + xelatex
# Użycie: ./scripts/build-pdfs.sh
# Wymagania: pandoc >= 3, xelatex (MacTeX / TeX Live)

set -euo pipefail

DOCS="$(cd "$(dirname "$0")/../docs" && pwd)"
ASSETS="$DOCS/pdf-assets"
OUT="$DOCS/pdf"
HEADER="$ASSETS/kenaz.tex"

mkdir -p "$OUT"

# ── Wspólne opcje pandoc ────────────────────────────────────────────────────
BASE_OPTS=(
  --pdf-engine=xelatex
  --include-in-header="$HEADER"
  --toc
  --toc-depth=3
  --highlight-style=tango
  --number-sections
  -V mainfont="Palatino"
  -V sansfont="Helvetica Neue"
  -V monofont="Courier New"
  -V monofontoptions="Scale=0.88"
  -V fontsize=11pt
  -V geometry="a4paper, top=3cm, bottom=3cm, left=2.8cm, right=2.8cm, headheight=15pt"
  -V linestretch=1.4
  -V lang=pl-PL
  -V colorlinks=true
  -V linkcolor=kenaznavy
  -V urlcolor=kenazred
  -V toccolor=kenaznavy
)

# ── Funkcja pomocnicza ──────────────────────────────────────────────────────
build_pdf() {
  local input="$1"
  local output="$2"
  local title="$3"
  local subtitle="$4"
  local date_str="$5"

  echo "  Generuję: $(basename "$output") ..."

  # Wstrzyknij YAML frontmatter na początku pliku (pandoc odczyta tytuł, datę)
  # i przefiltruj ręczny spis treści (zastępujemy go pandocowym --toc)
  {
    printf -- '---\ntitle: "%s"\nsubtitle: "%s"\ndate: "%s"\n---\n\n' \
      "$title" "$subtitle" "$date_str"
    # Pomiń sekcję "Spis treści" z markdown (będzie zastąpiona przez --toc)
    python3 - "$input" <<'PYEOF'
import sys, re

with open(sys.argv[1], encoding="utf-8") as f:
    content = f.read()

# Usuń nagłówek h1 + h3 subtitle z początku pliku (będą na stronie tytułowej)
content = re.sub(
    r'^# .+\n(#{1,3} .+\n)?(>.*\n)*(\*\*.*\n)*(---\n\n?)?',
    '',
    content,
    count=1,
    flags=re.MULTILINE
)

# Usuń blok "## Spis treści" wraz z zawartością do następnego --- lub # nagłówka
content = re.sub(
    r'## Spis treści\n(.+\n)*?(?=\n---|\n#)',
    '',
    content,
    flags=re.MULTILINE
)

print(content)
PYEOF
  } | pandoc \
    "${BASE_OPTS[@]}" \
    --metadata title="$title" \
    --metadata subtitle="$subtitle" \
    --metadata date="$date_str" \
    -f markdown+smart \
    -o "$output"

  echo "  ✓ $(basename "$output")"
}

DATE="luty 2026"

echo ""
echo "━━━ Kenaz PDF Builder ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. Kompletna instrukcja obsługi
build_pdf \
  "$DOCS/INSTRUKCJA_OBSLUGI.md" \
  "$OUT/INSTRUKCJA_OBSLUGI.pdf" \
  "Instrukcja Obsługi Kenaz" \
  "Kompletny przewodnik użytkownika i administratora" \
  "$DATE"

# 2. Instrukcja użytkownika
build_pdf \
  "$DOCS/INSTRUKCJA_UZYTKOWNIKA.md" \
  "$OUT/INSTRUKCJA_UZYTKOWNIKA.pdf" \
  "Instrukcja Obsługi – Przewodnik Użytkownika" \
  "Kenaz Centrum" \
  "$DATE"

# 3. Instrukcja administratora
build_pdf \
  "$DOCS/INSTRUKCJA_ADMINISTRATORA.md" \
  "$OUT/INSTRUKCJA_ADMINISTRATORA.pdf" \
  "Instrukcja Administratora" \
  "Kenaz Centrum – Panel zarządzania" \
  "$DATE"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Gotowe! PDFy zapisane w: $OUT/"
ls -lh "$OUT/"*.pdf
echo ""
