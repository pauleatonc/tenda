# Pin past v1.75.1: official release still ships google.golang.org/grpc
# v1.84.0-dev…b6eac429d7b6 (CVE-2026-84445). This commit has the fixed grpc.
FROM rclone/rclone:sha-91ab88a AS rclone

FROM postgres:17.11-bookworm

RUN apt-get update \
    && apt-get upgrade --yes \
    && apt-get install --yes --no-install-recommends age ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && rm -f /usr/local/bin/gosu

COPY --from=rclone /usr/local/bin/rclone /usr/local/bin/rclone
COPY infra/scripts/backup-postgres.sh /usr/local/bin/backup-postgres
COPY infra/scripts/restore-postgres.sh /usr/local/bin/restore-postgres

RUN chmod 0555 /usr/local/bin/backup-postgres /usr/local/bin/restore-postgres \
    && mkdir -p /work \
    && chown postgres:postgres /work

USER postgres
WORKDIR /work

ENTRYPOINT ["backup-postgres"]
