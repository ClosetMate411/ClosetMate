"""
Shared pytest fixtures + environment setup.

Tests import:
- `gemini_analyzer` from outfit_service/
- `main`             from community_service/

These don't collide (different module names), so we add both directories
to sys.path. community_service comes first so `main` resolves there.

Required env vars are set BEFORE collection so service modules that read
them at import time don't crash.
"""
import os
import sys
from pathlib import Path

# Required env vars consumed at import time by the service modules.
os.environ.setdefault("GEMINI_API_KEY", "test-key-for-pytest")
os.environ.setdefault("JWT_SECRET", "test-secret-for-pytest")
os.environ.setdefault("INTERNAL_API_KEY", "test-internal-key")
# In-memory SQLite — Postgres-only DDL fragments in the migration block
# are wrapped in try/except so they're skipped silently on SQLite.
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

BACKEND_ROOT = Path(__file__).resolve().parent.parent

# Order matters: insert outfit_service first (lower priority), then
# community_service second (higher priority via insert(0,...) twice).
sys.path.insert(0, str(BACKEND_ROOT / "outfit_service"))
sys.path.insert(0, str(BACKEND_ROOT / "community_service"))
