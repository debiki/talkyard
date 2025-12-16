# Use the -oss (open-source) configuration — it doesn't include X-Pack,
# and therefore doesn't print any verbose "license expired" warnings
# every minute.
#
# ElasticSearch is licensed under SSPL and the Elastic License (ES was Apache2
# only up to version 7.10) — and the Elastic License is a bit permissive:
# one is allowed to download ES from Elastic's servers (which is what
# happens below), and use all Basic features at no cost, so, no problems
# with using ES, right. Also see decisions.adoc.
#
#FROM docker.elastic.co/elasticsearch/elasticsearch-oss:6.8.23

# Docs: https://www.elastic.co/guide/en/elasticsearch/reference/current/docker.html
#FROM docker.elastic.co/elasticsearch/elasticsearch:8.17.2
# See: https://discuss.elastic.co/t/announcement-elastic-9-0-0-rc1-is-available/376490
# and in the script:
#     case "$1" in  ... -v) ... es_version="$2" ...
#     image: docker.elastic.co/elasticsearch/elasticsearch:${ES_LOCAL_VERSION}
FROM docker.elastic.co/elasticsearch/elasticsearch:9.2.1


LABEL org.opencontainers.image.title="Talkyard Search" \
      io.talkyard.edition="se" \
      io.talkyard.epoch="1"

# Or maybe add configurable files in a conf/search/ directory in the prod repo?
# Then, in dev builds, mount the conf from  modules/ed-prod-one-test/conf/search/.
# Let's wait! No one has ever asked about fine tuning ElasticSearch, and anyway most
# things can be done via env vars in docker-compose.override.yml, add next to ES_JAVA_OPTS.
# In fact, maybe it's better with the default config in the image, so I can change it,
# by updating the image. (Couldn't, however, edit people's conf/search/ dir files.)
COPY --chown=elasticsearch:elasticsearch \
      elasticsearch.yml  \
  /usr/share/elasticsearch/config/


# (curl is incl in the base image.)
HEALTHCHECK \
    --start-period=120s \
    --start-interval=5s \
    --interval=30s \
    --timeout=5s \
    --retries=10 \
    CMD curl --fail --silent http://localhost:9200/_cluster/health?local=true || exit 1

