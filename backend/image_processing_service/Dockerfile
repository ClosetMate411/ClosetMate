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
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download u2net model at build time so it's baked into the image
# This avoids runtime download failures and cold start delays on Railway
RUN python -c "from rembg import new_session; new_session('u2net'); print('u2net model cached successfully')"

COPY main.py .

EXPOSE 3002

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3002"]