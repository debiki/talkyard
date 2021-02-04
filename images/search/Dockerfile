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
# Can just bump to 6.8, right?
FROM docker.elastic.co/elasticsearch/elasticsearch-oss:6.2.3

# [ty_v1] mount these instead — in a conf.d?
# In dev, mount the conf from  modules/ed-prod-one-test/conf/search/.
COPY elasticsearch.yml /usr/share/elasticsearch/config/elasticsearch.yml
COPY log4j2.properties /usr/share/elasticsearch/config/log4j2.properties

# For troubleshooting. Oops, maybe rpm not apt?
# RUN apt-get install -y net-tools tree

# We chown /usr/share/elasticsearch/data in the entrypoint (for write access),
# so need to be root. We 'su' back to elasticsearch in the entrypoint.
USER root

# COULD optimize?
# http://ozzimpact.github.io/development/elasticsearch-configuration-tuning

COPY entrypoint.sh /docker-entrypoint.sh
ENTRYPOINT ["/docker-entrypoint.sh"]

CMD /usr/share/elasticsearch/bin/elasticsearch