#!/usr/bin/env bash
# ── Sestavení instalátoru Facet pro macOS (spouštět NA Macu) ────────────
# Výsledkem je .app bundle a .dmg v src-tauri/target/release/bundle/
#
# Prerekvizity: Xcode Command Line Tools, Rust (rustup), Node.js 20+
# Pozn.: nepodepsaná aplikace vyvolá při prvním spuštění varování
# Gatekeeperu — otevři přes pravý klik → Otevřít, nebo nastav podepisování
# (Apple Developer ID) v tauri.conf.json.

set -euo pipefail
cd "$(dirname "$0")"

echo "[1/2] Instalace závislostí…"
npm install

echo "[2/2] Sestavení aplikace a instalátoru (release)…"
npm run tauri build

echo
echo "========================================================"
echo " Hotovo! Výstupy:"
echo "   src-tauri/target/release/bundle/macos/  (.app)"
echo "   src-tauri/target/release/bundle/dmg/    (.dmg)"
echo "========================================================"
