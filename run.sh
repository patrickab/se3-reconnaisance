#!/bin/bash

export PATH="$(pwd)/.venv/bin:$PATH"

# Ports come from the shared config (src/config.json) so front and back agree.
read -r HOST PORT FE_PORT < <(python3 -c "import json;c=json.load(open('src/config.json'));print(c['backend']['host'],c['backend']['port'],c['frontend']['port'])")

echo "Starting backend on http://$HOST:$PORT"
source .venv/bin/activate
uv run uvicorn src.backend.app:app --host "$HOST" --port "$PORT" --reload --reload-dir src &
BACKEND_PID=$!

echo "Starting frontend on http://127.0.0.1:$FE_PORT"
npm --prefix src/frontend run dev &
FRONTEND_PID=$!

cleanup() {
  echo "Shutting down..."
  for PID in $BACKEND_PID $FRONTEND_PID; do
    kill -TERM -- "-$PID" 2>/dev/null || kill -TERM "$PID" 2>/dev/null || true
  done
  wait 2>/dev/null || true
  echo "Done."
}

trap cleanup INT TERM

wait
