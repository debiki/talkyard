# We build our own talkyard-cache image and push to talkyard-cache:$VERSION_TAG, and by
# downloading and using that image, one automatically upgrades the Redis image,
# whenever needed. (So won't need to configure Redis image version, separately, in Prod.)

FROM redis:8.2.3-bookworm

LABEL org.opencontainers.image.title="Talkyard Cache" \
      io.talkyard.edition="se" \
      io.talkyard.epoch="1"

HEALTHCHECK \
    --start-period=60s \
    --start-interval=1s \
    --interval=20s \
    --timeout=5s \
    --retries=5 \
    CMD redis-cli ping || exit 1

