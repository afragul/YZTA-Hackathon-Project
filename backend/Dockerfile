FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY . .

# Defensive: strip any CRLF that might slip in from a Windows checkout
# without .gitattributes (belt-and-suspenders alongside the repo's
# .gitattributes which already normalizes shell scripts to LF).
RUN sed -i 's/\r$//' scripts/entrypoint.sh && chmod +x scripts/entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["./scripts/entrypoint.sh"]
CMD ["--reload"]
