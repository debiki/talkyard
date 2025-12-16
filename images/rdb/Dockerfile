# See: https://hub.docker.com/_/postgres
FROM postgres:18.1-trixie

LABEL org.opencontainers.image.title="Talkyard Rdb" \
      io.talkyard.edition="se" \
      io.talkyard.epoch="1"
# Better:
# https://github.com/opencontainers/image-spec/blob/main/annotations.md#pre-defined-annotation-keys

RUN \
  apt-get update && \
  apt-get install -y \
  # Nice to have:
  tree less curl wget net-tools bash \
  # For 'ps':
  procps \
  # Telnet, nice for troubleshooting SMTP problems for example.
  telnet \
  # software-properties-common \  ?
  && rm -rf /var/lib/apt/lists/*

COPY ./docker-entrypoint-initdb.d/ /docker-entrypoint-initdb.d/

HEALTHCHECK \
    --start-period=60s \
    --start-interval=1s \
    --interval=20s \
    --timeout=5s \
    --retries=5 \
    CMD pg_isready -U postgres

