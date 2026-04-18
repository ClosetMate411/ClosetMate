FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid 1001 appgroup && \
    useradd --system --uid 1001 --gid appgroup --no-create-home appuser

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY --chown=appuser:appgroup gemini_analyzer.py .
COPY --chown=appuser:appgroup main.py .

USER appuser

EXPOSE 3003

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3003"]
