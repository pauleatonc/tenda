FROM node:20.19.4-bookworm-slim AS build

ENV PNPM_HOME="/pnpm"
ENV PATH="${PNPM_HOME}:${PATH}"

RUN corepack enable && corepack prepare pnpm@10.34.5 --activate

WORKDIR /repo

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY frontend/web/package.json frontend/web/package.json
COPY frontend/mobile/package.json frontend/mobile/package.json
COPY packages/api-client/package.json packages/api-client/package.json
RUN pnpm install --frozen-lockfile --filter @tenda/web...

COPY frontend/web frontend/web

ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=${VITE_API_URL}

RUN pnpm --filter @tenda/web build

FROM nginx:1.27.5-alpine AS runtime

COPY frontend/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/frontend/web/dist /usr/share/nginx/html

EXPOSE 80
