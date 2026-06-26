#!/bin/sh
# Serve the viewer + API at http://localhost:8011
# Packs the cloud on startup; tune with SE3_VOXEL / SE3_MAX_POINTS.
# Extra args pass through to uvicorn, e.g. ./run.sh --reload
set -e
cd "$(dirname "$0")"
echo "viewer -> http://localhost:8011  (Ctrl-C to stop)"
exec uv run uvicorn src.backend.app:app --host 0.0.0.0 --port 8011 "$@"
