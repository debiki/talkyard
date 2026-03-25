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
FROM docker.elastic.co/elasticsearch/elasticsearch:9.3.1-amd64

LABEL org.opencontainers.image.title="Talkyard Search" \
      io.talkyard.edition="se" \
      io.talkyard.epoch="1"

# Install analyzers for more languages.
#
# These are safe to use — they're ElasticSearch's official plugins, gets downloaded
# from Elastic's servers.
#
# (There's also 'ik_max_words' and 'stconvert' for Chinese [zh_universal], but
# they're not official ElasticSearch plugins so let's wait, and be happy with
# 'smartcn' for now.)
# (Now Feb 2026 there's a Hebrew analyzer too:  [es_hebrew]
# https://github.com/liladler/elasticsearch-analysis-hebrew-plugin, MIT.
# It's a 3rd party plugin — needs code review & its own build steps.
# Let's wait until Elastic has made it one of their official plugins.
# An old & abandoned: https://github.com/synhershko/elasticsearch-analysis-hebrew, AGPLv3.)
#
RUN bin/elasticsearch-plugin install --batch \
    # Various languages.
    # Extended Unicode support using the ICU libraries, including better analysis of
    # Asian languages, Unicode normalization, Unicode-aware case folding,
    # collation support, and transliteration.
    # Note: "ICU library receives updates such as adding new characters and emojis,
    # and improving collation (sort) orders. These changes may or may not affect
    # search and sort orders"
    # https://www.elastic.co/docs/reference/elasticsearch/plugins/analysis-icu
    analysis-icu \
    # Japanese.
    # Integrates the Lucene kuromoji analysis module.
    # https://www.elastic.co/docs/reference/elasticsearch/plugins/analysis-kuromoji
    analysis-kuromoji \
    # Korean.
    # Integrates Lucene nori analysis module.
    # https://www.elastic.co/docs/reference/elasticsearch/plugins/analysis-nori
    analysis-nori \
    # Chinese (Simplified) and mixed Chinese-English text.
    # Provides the smartcn analyzer, smartcn_tokenizer tokenizer, and smartcn_stop
    # token filter, which are not configurable.
    # https://www.elastic.co/docs/reference/elasticsearch/plugins/analysis-smartcn
    analysis-smartcn \
    # Polish.
    # High quality stemming for Polish.
    # Provides the polish analyzer and the polish_stem and polish_stop token filters,
    # which are not configurable.
    # https://www.elastic.co/docs/reference/elasticsearch/plugins/analysis-stempel
    analysis-stempel \
    # Ukrainian.
    # Provides the ukrainian analyzer.
    # https://www.elastic.co/docs/reference/elasticsearch/plugins/analysis-ukrainian
    analysis-ukrainian


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

