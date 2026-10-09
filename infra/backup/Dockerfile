# Build a Trivy-clean rclone: release tag (so module version is >= 1.75.1)
# plus current Go toolchain and patched transitive deps.
FROM public.ecr.aws/docker/library/golang:1.27.2-bookworm AS rclone
WORKDIR /src
RUN git clone --depth 1 --branch v1.75.1 https://github.com/rclone/rclone.git . \
    && go get golang.org/x/net@v0.60.0 \
    && go get google.golang.org/grpc@v1.85.0-dev.0.20260825072537-93e31b48545e \
    && go mod tidy \
    && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /rclone .

FROM public.ecr.aws/docker/library/postgres:17.11-bookworm

RUN apt-get update \
    && apt-get upgrade --yes \
    && apt-get install --yes --no-install-recommends age ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && rm -f /usr/local/bin/gosu

COPY --from=rclone /rclone /usr/local/bin/rclone
COPY infra/scripts/backup-postgres.sh /usr/local/bin/backup-postgres
COPY infra/scripts/restore-postgres.sh /usr/local/bin/restore-postgres

RUN chmod 0555 /usr/local/bin/backup-postgres /usr/local/bin/restore-postgres \
    && mkdir -p /work \
    && chown postgres:postgres /work

USER postgres
WORKDIR /work

ENTRYPOINT ["backup-postgres"]
