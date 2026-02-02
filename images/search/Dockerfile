# The ElasticSearch binary distribution (8.16+, incl 9.x which we use)
# is licensed under the Elastic License 2.0. It's pretty permissive:
# You can download ES from Elastic's servers (which is what happens below),
# and use all basic features at no cost. Also see decisions.adoc.
#
# Source code is triple licensed under AGPLv3-only, the Elastic License 2,
# and the silly Server Side Public License.
# https://github.com/elastic/elasticsearch/blob/main/LICENSE.txt

# Image list: https://www.docker.elastic.co/r/elasticsearch
# Docs: https://www.elastic.co/docs/deploy-manage/deploy/self-managed/install-elasticsearch-with-docker
FROM docker.elastic.co/elasticsearch/elasticsearch:9.3.0-amd64

LABEL org.opencontainers.image.title="Talkyard Search" \
      io.talkyard.edition="se" \
      io.talkyard.epoch="1"

# Copy config.
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
    --retries=5 \
    CMD curl --fail --silent --show-error http://localhost:9200/_cluster/health?local=true || exit 1

