FROM python:3.12-slim

# LibreOffice is only needed to turn reviewed .docx files into PDFs. Set to 0 to skip it (smaller image).
ARG WITH_LIBREOFFICE=1
RUN if [ "$WITH_LIBREOFFICE" = "1" ]; then \
      apt-get update && apt-get install -y --no-install-recommends libreoffice-writer fonts-dejavu-core \
      && rm -rf /var/lib/apt/lists/*; \
    fi

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

RUN useradd --create-home --uid 10001 app && mkdir -p /data && chown app:app /data
COPY --chown=app:app . .
USER app

# Database, uploads and the reference library live here (a Docker volume).
ENV DATA_DIR=/data
EXPOSE 8001
# One worker only: the database is SQLite.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]