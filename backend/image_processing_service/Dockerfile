FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    libglib2.0-0 \
    libsm6 \
    libxrender1 \
    libxext6 \
    gosu \
    && rm -rf /var/lib/apt/lists/*

# Create unprivileged user BEFORE model download so the cached files
# land under its HOME and are readable at runtime.
RUN groupadd --system --gid 1001 appgroup && \
    useradd --system --uid 1001 --gid appgroup --home /home/appuser --create-home appuser

# Install Python dependencies
# When adding a new package, bump the version header below to force
# Docker to invalidate this layer (otherwise requirements.txt hash
# can occasionally collide with a cached layer).
# deps-version: 2
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Prepare storage directory writable by the unprivileged user
RUN mkdir -p /app/storage && chown -R appuser:appgroup /app/storage

# Pre-download birefnet-general-lite model at build time
# Avoids runtime download delays and cold start issues on Railway.
# Run as appuser so model cache ends up owned by the runtime user.
USER appuser
RUN python -c "\
from rembg import new_session; \
new_session('birefnet-general-lite'); \
print('birefnet-general-lite cached successfully')"

USER root
COPY --chown=appuser:appgroup main.py .
COPY --chown=root:root entrypoint.sh .
RUN chmod +x entrypoint.sh

EXPOSE 3002

# Entrypoint starts as root to fix volume ownership, then drops to appuser.
ENTRYPOINT ["./entrypoint.sh"]
