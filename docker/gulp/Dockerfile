# Node.js 8.x Linux Dockerfile, for running Gulp & Tape, for EffectiveDiscussions.
#
# Unfortunately, the default Node.js Dockerfile creates a user 'node' with id 1000.
# However, most people on Linux have id 1000 already, so 'node' = 1000 results in an error
# in the entrypoint when it creates and su:s to a user with the same id as the host user [5RZ4HA9].
# As a workaround, I've copied node:8.1.0 to here, and commented out the creation of user 1000:
# (search for "1000" to find where)
#-----------------------------------------------------------------------------
# This, between ----, is a copy of:
#   https://github.com/nodejs/docker-node/blob/master/8.1/Dockerfile
#
# Copyright (c) 2015 Joyent, Inc.
# Copyright (c) 2015 Node.js contributors
# The MIT License (MIT)
# (see https://github.com/nodejs/docker-node/blob/master/LICENSE )

FROM buildpack-deps:wheezy

# Don't:
# RUN groupadd --gid 1000 node \
#   && useradd --uid 1000 --gid node --shell /bin/bash --create-home node

# gpg keys listed at https://github.com/nodejs/node#release-team
RUN set -ex \
  && for key in \
    94AE36675C464D64BAFA68DD7434390BDBE9B9C5 \
    FD3A5288F042B6850C66B31F09FE44734EB7990E \
    71DCFD284A79C3B38668286BC97EC7A07EDE3FC1 \
    DD8F2338BAE7501E3DD5AC78C273792F7D83545D \
    C4F0DFFF4E8C1A8236409D08E73BC641CC11F4C8 \
    B9AE9905FFD7803F25714661B63B535A4C206CA9 \
    56730D5401028683275BD23C23EFEFE93C4CFFFE \
  ; do \
    gpg --keyserver pgp.mit.edu --recv-keys "$key" || \
    gpg --keyserver keyserver.pgp.com --recv-keys "$key" || \
    gpg --keyserver ha.pool.sks-keyservers.net --recv-keys "$key" ; \
  done

ENV NODE_VERSION 8.8.0

RUN ARCH= && dpkgArch="$(dpkg --print-architecture)" \
  && case "${dpkgArch##*-}" in \
    amd64) ARCH='x64';; \
    ppc64el) ARCH='ppc64le';; \
    *) echo "unsupported architecture"; exit 1 ;; \
  esac \
  && curl -SLO "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-$ARCH.tar.xz" \
  && curl -SLO --compressed "https://nodejs.org/dist/v$NODE_VERSION/SHASUMS256.txt.asc" \
  && gpg --batch --decrypt --output SHASUMS256.txt SHASUMS256.txt.asc \
  && grep " node-v$NODE_VERSION-linux-$ARCH.tar.xz\$" SHASUMS256.txt | sha256sum -c - \
  && tar -xJf "node-v$NODE_VERSION-linux-$ARCH.tar.xz" -C /usr/local --strip-components=1 \
  && rm "node-v$NODE_VERSION-linux-$ARCH.tar.xz" SHASUMS256.txt.asc SHASUMS256.txt \
  && ln -s /usr/local/bin/node /usr/local/bin/nodejs

ENV YARN_VERSION 1.2.1

RUN set -ex \
  && for key in \
    6A010C5166006599AA17F08146C2130DFD2497F5 \
  ; do \
    gpg --keyserver pgp.mit.edu --recv-keys "$key" || \
    gpg --keyserver keyserver.pgp.com --recv-keys "$key" || \
    gpg --keyserver ha.pool.sks-keyservers.net --recv-keys "$key" ; \
  done \
  && curl -fSLO --compressed "https://yarnpkg.com/downloads/$YARN_VERSION/yarn-v$YARN_VERSION.tar.gz" \
  && curl -fSLO --compressed "https://yarnpkg.com/downloads/$YARN_VERSION/yarn-v$YARN_VERSION.tar.gz.asc" \
  && gpg --batch --verify yarn-v$YARN_VERSION.tar.gz.asc yarn-v$YARN_VERSION.tar.gz \
  && mkdir -p /opt/yarn \
  && tar -xzf yarn-v$YARN_VERSION.tar.gz -C /opt/yarn --strip-components=1 \
  && ln -s /opt/yarn/bin/yarn /usr/local/bin/yarn \
  && ln -s /opt/yarn/bin/yarn /usr/local/bin/yarnpkg \
  && rm yarn-v$YARN_VERSION.tar.gz.asc yarn-v$YARN_VERSION.tar.gz

CMD [ "node" ]
#-----------------------------------------------------------------------------


# If using node:7.4.0-alpine, then this error:
# panic: standard_init_linux.go:178: exec user process caused "no such file or directory" [recovered]
#    panic: standard_init_linux.go:178: exec user process caused "no such file or directory"


# for now. COULD use node:7.4-alpine instead, and:  apk add --no-cache, at the top of this file
RUN apt-get update
RUN apt-get install -y net-tools tree

RUN yarn global add gulp

COPY entrypoint.sh /opt/docker-entrypoint.sh
RUN  chmod ugo+x   /opt/docker-entrypoint.sh
ENTRYPOINT ["/opt/docker-entrypoint.sh"]

# For debugging test code, via `node --debug-brk --inspect=9229`. [8EA02R4]
EXPOSE 9229

WORKDIR /opt/debiki/server/

CMD ["echo 'Specify a command in docker-compose.yml or on the command line instead' && exit 0"]

