FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for rembg and image processing
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download rembg model (u2net)
RUN python -c "from rembg import remove; from PIL import Image; import io; remove(Image.new('RGB', (10, 10)))" || true

# Create storage directories
RUN mkdir -p /app/storage/original /app/storage/processed

# Copy application code
COPY main.py .

# Expose port
EXPOSE 3002

# Run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3002"]
