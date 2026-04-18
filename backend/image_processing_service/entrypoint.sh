#!/bin/sh
# Fix ownership of the Railway-mounted volume (mounted as root).
# Then drop to appuser for the actual server process.
chown -R appuser:appgroup /app/storage 2>/dev/null || true
exec su-exec appuser python -m uvicorn main:app --host 0.0.0.0 --port 3002
