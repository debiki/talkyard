FROM postgres:9.5.2

RUN apt-get update && \
  apt-get install -y tree less vim curl net-tools telnet && \
  rm -rf /var/lib/apt/lists/*

COPY ./docker-entrypoint-initdb.d/ /docker-entrypoint-initdb.d/

