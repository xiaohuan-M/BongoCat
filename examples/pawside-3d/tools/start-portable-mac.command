#!/bin/bash
set -eu
cd "$(dirname "$0")"
if [ "$(uname -m)" != "arm64" ] && [ "$(sysctl -n hw.optional.arm64 2>/dev/null || true)" != "1" ]; then
  echo "此包适用于 Apple 芯片 Mac。Intel Mac 可使用工作室 HTML 或开发包。"
  read -r -p "按回车退出。" answer
  exit 1
fi
if [ ! -x "runtime/Electron.app/Contents/MacOS/Electron" ]; then
  staging="$(mktemp -d "$PWD/runtime/.install.XXXXXX")"
  trap 'rm -rf "$staging"' EXIT
  /usr/bin/ditto -x -k runtime/Electron-arm64.zip "$staging"
  mv "$staging/Electron.app" runtime/Electron.app
  for notice in "$staging"/LICENSE*; do
    if [ -f "$notice" ]; then cp "$notice" runtime/; fi
  done
fi
exec "$PWD/runtime/Electron.app/Contents/MacOS/Electron" "$PWD/PawsideApp"
