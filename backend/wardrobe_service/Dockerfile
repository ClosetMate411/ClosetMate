FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy shared module first
COPY shared /app/shared

# Copy wardrobe service requirements and install
COPY wardrobe_service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy wardrobe service code
COPY wardrobe_service/main.py .

# Expose port
EXPOSE 3001

# Run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3001"]
