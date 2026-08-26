FROM ghcr.io/astral-sh/uv:0.11.29 AS uv

FROM python:3.12.3-slim-bookworm AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_LINK_MODE=copy \
    PATH="/app/.venv/bin:${PATH}"

RUN groupadd --system tenda \
    && useradd --system --gid tenda --create-home tenda

WORKDIR /app

COPY --from=uv /uv /uvx /bin/
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY backend/ ./
RUN mkdir -p /app/staticfiles \
    && chown -R tenda:tenda /app

USER tenda

EXPOSE 8000

CMD ["uvicorn", "tenda.asgi:application", "--host", "0.0.0.0", "--port", "8000"]
