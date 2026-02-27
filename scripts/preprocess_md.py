#!/usr/bin/env python3
"""
preprocess_md.py — Czyści plik Markdown przed konwersją do PDF przez pandoc.

Działanie:
  1. Usuwa linię "# Tytuł dokumentu" (h1) z początku — trafi na stronę tytułową.
  2. Usuwa opis podtytułu (### ...) jeśli zaraz po h1.
  3. Usuwa blok metadanych (wiersze > **...) na początku.
  4. Usuwa sekcję "## Spis treści" — pandoc wygeneruje własną.
  5. Opcjonalnie usuwa nadmiarowe separatory ---

Użycie: python3 preprocess_md.py <plik.md>
"""

import re
import sys

with open(sys.argv[1], encoding="utf-8") as f:
    text = f.read()

lines = text.splitlines(keepends=True)

# ── 1. Usuń blok nagłówkowy z początku pliku ────────────────────────────────
# Zaczyna się od "# " i ciągnie przez opcjonalne ### subtitle, ---,
# bloczki > **..., aż do pierwszej pustej linii po bloku.
i = 0
if lines and lines[0].startswith("# "):
    i = 1  # pomiń h1
    # pomiń ### subtitle jeśli zaraz po h1
    if i < len(lines) and lines[i].startswith("### "):
        i += 1
    # pomiń puste linie i separator ---
    while i < len(lines) and lines[i].strip() in ("", "---"):
        i += 1
    # pomiń blok >  **Wersja** itp.
    while i < len(lines) and (lines[i].startswith(">") or lines[i].strip() == ""):
        i += 1
    # pomiń kolejny separator --- i puste linie po nim
    while i < len(lines) and lines[i].strip() in ("", "---"):
        i += 1

lines = lines[i:]

# ── 2. Usuń sekcję "## Spis treści" ─────────────────────────────────────────
# Znajdź "## Spis treści" i usuń do następnego nagłówka ## lub # lub ---
result = []
in_toc = False
for line in lines:
    if re.match(r'^## Spis tre[sś]ci', line, re.IGNORECASE):
        in_toc = True
        continue
    if in_toc:
        # Koniec sekcji TOC: gdy natrafimy na inny nagłówek lub separator ---
        if re.match(r'^#{1,2} ', line) or line.strip() == "---":
            in_toc = False
            # Ten wiersz zachowujemy (to już nowa sekcja)
            result.append(line)
        # pomiń linie wewnątrz TOC
        continue
    result.append(line)
lines = result

# ── 3. Zredukuj ciągi > 2 pustych linii do max 1 ────────────────────────────
out = []
blank_count = 0
for line in lines:
    if line.strip() == "":
        blank_count += 1
        if blank_count <= 1:
            out.append(line)
    else:
        blank_count = 0
        out.append(line)

sys.stdout.write("".join(out))
