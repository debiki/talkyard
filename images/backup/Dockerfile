# See: https://hub.docker.com/_/debian/tags?name=13
FROM debian:13.2-slim

LABEL org.opencontainers.image.title="Talkyard Backup" \
      io.talkyard.edition="se" \
      io.talkyard.epoch="1"

RUN apt-get update && \
    apt-get install -y \
      curl ca-certificates  \
      # Nice to have:
      vim tree less wget net-tools bash \
      # For 'ps':
      procps \
      # Telnet, nice for troubleshooting connection problems.
      telnet \
      && \
    rm -rf /var/lib/apt/lists/*

# Install the Pg 18 client, as per https://www.postgresql.org/download/linux/debian/

# We've downloaded the signing key, apt.postgresql.org.asc, already, so we can _double_check.
COPY postgresql-ACCC4CF8.asc  /ty/ACCC4CF8.asc

RUN \
    # Import the repository signing key:
    install -d /usr/share/postgresql-common/pgdg  && \
    curl -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc --fail  \
          https://www.postgresql.org/media/keys/ACCC4CF8.asc  && \
    # _double_check key.
    if ! diff /ty/ACCC4CF8.asc /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc ; then \
      echo "www.postgresql.org signing key differs from key in our repo. Suspicious! Aborting."  ;\
      exit 1  ;\
    fi  && \
    rm /ty/ACCC4CF8.asc  && \
    # Create the repository configuration file:
    . /etc/os-release  && \
    sh -c "echo 'deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $VERSION_CODENAME-pgdg main' > /etc/apt/sources.list.d/pgdg.list"  && \
    # Update package lists, and install.
    apt update  && \
    apt-get install -y postgresql-client-18

WORKDIR /ty/

# Place last, since we edit these files sometimes.
COPY entrypoint.sh   /ty/
COPY backup-test.sh  /ty/backup.sh

ENTRYPOINT ["/ty/entrypoint.sh"]
CMD ["./backup.sh"]

