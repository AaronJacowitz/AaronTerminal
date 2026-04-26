#!/bin/bash
cd "$(dirname "$0")/backend"
if [ -f ".venv/bin/activate" ]; then
  source .venv/bin/activate
elif [ -f "../.venv/bin/activate" ]; then
  source ../.venv/bin/activate
else
  echo "No virtualenv found. Create one with:"
  echo "  python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt"
  exit 1
fi
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
