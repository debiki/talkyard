# FROM node:7.4.0
#  — no, that won't work, because node:7.4.0 adds a 'node' user with id 1000, in this commit:
# https://github.com/nodejs/docker-node/commit/4a722c29c0e52624af8b72b4711ebeba8ea39463
# However, most people on Linux have id 1000 already, so 'node' = 1000 results in an error
# in the entrypoint when it creates and su:s to a user with the same id as the host user [5RZ4HA9].
# As a workaround, I've copied node:7.4.0 to here, and commented out the creation of user 1000:
#-----------------------------------------------------------------------------
# This, between ----, is a copy of https://github.com/nodejs/docker-node/blob/master/7.4/Dockerfile
# with user 1000 commented out, and:
# Copyright (c) 2015 Joyent, Inc.
# Copyright (c) 2015 Node.js contributors
# The MIT License (MIT)
# (see https://github.com/nodejs/docker-node/blob/master/LICENSE )

FROM buildpack-deps:jessie

# Here user 1000 is created, commented out:
#RUN groupadd --gid 1000 node \
#  && useradd --uid 1000 --gid node --shell /bin/bash --create-home node

# gpg keys listed at https://github.com/nodejs/node
RUN set -ex \
  && for key in \
    9554F04D7259F04124DE6B476D5A82AC7E37093B \
    94AE36675C464D64BAFA68DD7434390BDBE9B9C5 \
    0034A06D9D9B0064CE8ADF6BF1747F4AD2306D93 \
    FD3A5288F042B6850C66B31F09FE44734EB7990E \
    71DCFD284A79C3B38668286BC97EC7A07EDE3FC1 \
    DD8F2338BAE7501E3DD5AC78C273792F7D83545D \
    B9AE9905FFD7803F25714661B63B535A4C206CA9 \
    C4F0DFFF4E8C1A8236409D08E73BC641CC11F4C8 \
  ; do \
    gpg --keyserver ha.pool.sks-keyservers.net --recv-keys "$key"; \
  done

ENV NPM_CONFIG_LOGLEVEL info
ENV NODE_VERSION 7.4.0

RUN curl -SLO "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-x64.tar.xz" \
  && curl -SLO "https://nodejs.org/dist/v$NODE_VERSION/SHASUMS256.txt.asc" \
  && gpg --batch --decrypt --output SHASUMS256.txt SHASUMS256.txt.asc \
  && grep " node-v$NODE_VERSION-linux-x64.tar.xz\$" SHASUMS256.txt | sha256sum -c - \
  && tar -xJf "node-v$NODE_VERSION-linux-x64.tar.xz" -C /usr/local --strip-components=1 \
  && rm "node-v$NODE_VERSION-linux-x64.tar.xz" SHASUMS256.txt.asc SHASUMS256.txt \
  && ln -s /usr/local/bin/node /usr/local/bin/nodejs

CMD [ "node" ]
#-----------------------------------------------------------------------------


# If using node:7.4.0-alpine, then this error:
# panic: standard_init_linux.go:178: exec user process caused "no such file or directory" [recovered]
#    panic: standard_init_linux.go:178: exec user process caused "no such file or directory"


# for now. COULD use node:7.4-alpine instead, and:  apk add --no-cache, at the top of this file
RUN apt-get update
RUN apt-get install net-tools tree

RUN npm install -g yarn gulp

COPY entrypoint.sh /opt/docker-entrypoint.sh
RUN  chmod ugo+x   /opt/docker-entrypoint.sh
ENTRYPOINT ["/opt/docker-entrypoint.sh"]

# For debugging test code, via `node --debug-brk --inspect=9229`. [8EA02R4]
EXPOSE 9229

WORKDIR /opt/debiki/server/

CMD ["yarn install && gulp watch"]

