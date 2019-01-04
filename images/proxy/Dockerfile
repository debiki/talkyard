# We build our own talkyard-proxy image and push to talkyard-proxy:$VERSION_TAG, so that by
# downloading and using that image, one automatically uses the right version of Traefik.

FROM traefik:v1.7.6-alpine
# Source here: https://github.com/containous/traefik-library-image/tree/master/alpine

RUN mv /entrypoint.sh /entrypoint-original.sh
COPY entrypoint.sh /
COPY traefik.prod.toml /traefik.toml
