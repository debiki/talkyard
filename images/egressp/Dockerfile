# Stage 1: Build Smokescreen binary
# ------------------------------------------------------------

# Images list: https://hub.docker.com/_/golang
FROM golang:1.26.1-trixie AS smokescreen_builder

# Weird, Smokescreen has no up-to-date Git tags. But commit eae8104, Jan 9 2026, is:
# "Prevent smokescreen upstream connections to its local IPs", which seems important!
# Commits list: https://github.com/stripe/smokescreen/commits/master/
RUN go install github.com/stripe/smokescreen@464b1115f802cbd91ffee555a41e71546646d396


# Stage 2: Build an egress proxy, using the Smokescreen binary
# ------------------------------------------------------------

# Images list: https://hub.docker.com/_/debian/tags?name=13
FROM debian:13.3-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    # `nc`, healthcheck
    netcat-openbsd \
    # Nice to have
    curl vim tree less net-tools bash procps \
    && rm -rf /var/lib/apt/lists/*

# Smokescreen user.
RUN groupadd --gid 1000 smokegroup  && \
    useradd --uid 1000 --no-create-home --shell /usr/sbin/nologin --system --gid smokegroup \
                                                                                smokescreen

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

