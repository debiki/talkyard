# See: https://hub.docker.com/_/postgres
FROM postgres:18.1-trixie

LABEL org.opencontainers.image.title="Talkyard Rdb" \
      io.talkyard.edition="se" \
      io.talkyard.epoch="1"

RUN \
  apt-get update && \
  apt-get install -y --no-install-recommends \
      # Nice to have:
      tree less curl wget net-tools bash \
      # For 'ps':
      procps \
  && rm -rf /var/lib/apt/lists/*

COPY ./docker-entrypoint-initdb.d/ /docker-entrypoint-initdb.d/
COPY ./entrypoint.sh ./chown-postgres_password.sh  /ty/

HEALTHCHECK \
    --start-period=60s \
    --start-interval=5s \
    --interval=30s \
    --timeout=5s \
    --retries=5 \
    CMD pg_isready -U postgres

# This makes the secret password file readable by 'postgres', then runs the default
# entrypoint.
ENTRYPOINT ["/ty/entrypoint.sh"]

# Need to redefine, apparently gets unset if specifying an entrypoint (without,
# `docker compose up rdb` just exits w status 0).
CMD ["postgres"]

