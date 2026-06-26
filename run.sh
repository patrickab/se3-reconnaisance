#!/bin/sh
# Dev helper.
#   ./run.sh prep    build viewer assets from data/ -> src/frontend/public/
#   ./run.sh serve   serve the 3D viewer at http://localhost:8011  (default)
set -e
cd "$(dirname "$0")"

case "${1:-serve}" in
  prep)
    shift
    uv run python src/backend/scripts/prepare_web.py "$@"
    ;;
  serve)
    echo "viewer -> http://localhost:8011  (Ctrl-C to stop)"
    cd src/frontend && python3 -m http.server 8011
    ;;
  *)
    echo "usage: ./run.sh [prep|serve]" >&2
    exit 1
    ;;
esac
