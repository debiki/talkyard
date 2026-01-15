# Stage 1: Build Smokescreen binary
# ------------------------------------------------------------

FROM golang:1.25.6-trixie AS smokescreen_builder

# Weird, Smokescreen has no up-to-date Git tags. But commit eae8104, Jan 9 2026, is:
# "Prevent smokescreen upstream connections to its local IPs", which seems important!
RUN go install github.com/stripe/smokescreen@eae81044dc8309bd7de5782be587cccffc1c4084


# Stage 2: Build an egress proxy, using the Smokescreen binary
# ------------------------------------------------------------

FROM debian:13.2-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    # `nc`, healthcheck
    netcat-openbsd \
    # Nice to have
    curl vim tree less net-tools bash procps \
    && rm -rf /var/lib/apt/lists/*

# Smokescreen user.  -M = no home dir. -r = system account (but id >= 1000).
RUN groupadd --gid 1000 smokescreen  && \
    useradd --uid 1000 -M -s /usr/sbin/nologin -r -g smokescreen smokescreen

COPY --from=smokescreen_builder /go/bin/smokescreen /ty/smokescreen

# Copy access control list and other config.
COPY smokescreen.yml /ty/

# Same as in smokescreen.yml.
EXPOSE 4750

USER smokescreen

WORKDIR /ty/

HEALTHCHECK \
    --start-period=60s \
    --start-interval=5s \
    --interval=30s \
    --timeout=5s \
    --retries=5 \
    # Can't easily use curl — Smokescreen doesn't reply to normal HTTP
    # requests, it wants proxy CONNECT requests. So, no:
    # CMD curl --fail --silent --show-error http://127.0.0.1:4750/ || exit 1
    CMD nc -z 127.0.0.1 4750 || exit 1

CMD ["/ty/smokescreen", "--config-file", "/ty/smokescreen.yml"]

