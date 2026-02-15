FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY gemini_analyzer.py .
COPY main.py .

EXPOSE 3003

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3003"]
