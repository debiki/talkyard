# Now (June 2016) Alpine 3.4 is out, supports Postgres 9.5. Try to switch to Alpine later
# when someone has made such a Dockerfile.

FROM postgres:9.6.0

RUN apt-get update && \
  apt-get install -y tree less vim curl net-tools telnet && \
  rm -rf /var/lib/apt/lists/*

COPY ./docker-entrypoint-initdb.d/ /docker-entrypoint-initdb.d/

