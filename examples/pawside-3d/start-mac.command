#!/bin/bash
set -eu
cd "$(dirname "$0")"
if ! command -v npm >/dev/null; then
  echo "请先安装 Node.js 22.12 或更高版本，再打开本文件。"
  read -r -p "按回车退出。" answer
  exit 1
fi
if [ ! -e node_modules/electron/path.txt ]; then
  npm ci --no-audit --no-fund
  node node_modules/electron/install.js
fi
exec npm start
