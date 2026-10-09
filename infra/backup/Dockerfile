FROM rclone/rclone:1.75.1 AS rclone

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
