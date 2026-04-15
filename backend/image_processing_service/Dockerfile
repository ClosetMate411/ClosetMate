FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    libglib2.0-0 \
    libsm6 \
    libxrender1 \
    libxext6 \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
# When adding a new package, bump the version header below to force
# Docker to invalidate this layer (otherwise requirements.txt hash
# can occasionally collide with a cached layer).
# deps-version: 2
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download birefnet-general-lite model at build time
# Avoids runtime download delays and cold start issues on Railway
RUN python -c "\
from rembg import new_session; \
new_session('birefnet-general-lite'); \
print('birefnet-general-lite cached successfully')"

COPY main.py .

EXPOSE 3002

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3002"]