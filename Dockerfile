FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN groupadd --system app && useradd --system --gid app app

COPY requirements.txt .
RUN python -m pip install --no-cache-dir --root-user-action=ignore -r requirements.txt

COPY app.py .
COPY services.py .
COPY services_en.py .
COPY templates ./templates
COPY static ./static

USER app

EXPOSE 8000

CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "2", "--access-logfile", "-", "--error-logfile", "-", "app:app"]
