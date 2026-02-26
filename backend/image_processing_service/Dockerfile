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

# Pre-download all 3 models at build time
# Avoids runtime download delays and cold start issues on Railway
RUN python -c "\
from rembg import new_session; \
new_session('u2net'); \
print('u2net cached'); \
new_session('u2net_human_seg'); \
print('u2net_human_seg cached'); \
new_session('u2net_cloth_seg'); \
print('u2net_cloth_seg cached'); \
print('All models cached successfully')"

COPY main.py .

EXPOSE 3002

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3002"]