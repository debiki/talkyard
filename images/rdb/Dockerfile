FROM postgres:10.23-alpine

RUN apk add --no-cache bash tree less vim curl net-tools

COPY ./docker-entrypoint-initdb.d/ /docker-entrypoint-initdb.d/
COPY ./chown-logs-then-exec-entrypoint.sh /

ENTRYPOINT ["/chown-logs-then-exec-entrypoint.sh"]
CMD ["postgres"]

