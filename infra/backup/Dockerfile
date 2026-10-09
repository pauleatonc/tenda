# Build rclone with a current Go toolchain so Trivy does not fail on stdlib /
# x/net CVEs already fixed upstream of the last rclone release image.
FROM golang:1.27.2-bookworm AS rclone
ARG RCLONE_REF=4f19e9cd6f442282d7fa8d5fdbd28ebb68be1131
RUN CGO_ENABLED=0 go install -trimpath -ldflags="-s -w" \
    "github.com/rclone/rclone@${RCLONE_REF}"

FROM postgres:17.11-bookworm

RUN apt-get update \
    && apt-get upgrade --yes \
    && apt-get install --yes --no-install-recommends age ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && rm -f /usr/local/bin/gosu

COPY --from=rclone /go/bin/rclone /usr/local/bin/rclone
COPY infra/scripts/backup-postgres.sh /usr/local/bin/backup-postgres
COPY infra/scripts/restore-postgres.sh /usr/local/bin/restore-postgres

RUN chmod 0555 /usr/local/bin/backup-postgres /usr/local/bin/restore-postgres \
    && mkdir -p /work \
    && chown postgres:postgres /work

USER postgres
WORKDIR /work

ENTRYPOINT ["backup-postgres"]
