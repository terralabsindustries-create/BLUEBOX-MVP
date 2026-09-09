#!/usr/bin/env bash
# macOS launcher for the BlueBox One client bundle.
# The Windows launcher (Start BlueBox.cmd) uses runtime\node.exe and real
# Windows BLE. On macOS we use the system Node and the mock physical twin,
# because the real bridge mode shells out to powershell.exe.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT/app"

export BLUEBOX_BRIDGE_MODE=mock
export MOCK_PHYSICAL_BLUEBOX=true

cleanup() {
  kill "${NEXT_PID:-}" "${BRIDGE_PID:-}" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

node node_modules/next/dist/bin/next start -p 3000 &
NEXT_PID=$!
sleep 3

node node_modules/tsx/dist/cli.mjs bridge/src/index.ts &
BRIDGE_PID=$!
sleep 2

open http://localhost:3000/dashboard

echo "Dashboard: http://localhost:3000/dashboard   Bridge: ws://localhost:8765"
echo "Press Ctrl+C to stop both."
wait
