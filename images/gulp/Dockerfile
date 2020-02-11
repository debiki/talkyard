# Node.js Linux Dockerfile, for running Gulp and Webdriverio, for Talkyard.
#
# Unfortunately, the default Node.js Dockerfile creates a user 'node' with id 1000.
# However, most people on Linux have id 1000 already, so 'node' = 1000 results in an error
# in the entrypoint when it creates and su:s to a user with the same id as the host user [5RZ4HA9].
# As a workaround, I've copied node:8.1.0 to here, and commented out the creation of user 1000:
# (search for "1000" to find where)
#-----------------------------------------------------------------------------
# This, between ----, is a copy of:
#   https://raw.githubusercontent.com/nodejs/docker-node/
#       46f5203674c748b0701135c8eeea4b250b3ecb6d/13/buster-slim/Dockerfile
#
# Copyright (c) 2015 Joyent, Inc.
# Copyright (c) 2015 Node.js contributors
# The MIT License (MIT)
# (see https://github.com/nodejs/docker-node/blob/master/LICENSE )


# Nodejs Fibers 3.x, used by wdio-sync, won't build with Node 13 yet,
# wait until the new wdio-sync version that uses Fibers 4.x has been released:
# https://github.com/webdriverio-boneyard/wdio-sync/commit/dce97e0482a712660d269beb9b575bd731f26977
# (unreleased).
# ???
#FROM node:13.8.0-buster-slim
# Dockerfiles:
#   https://hub.docker.com/_/node/
#   https://github.com/nodejs/docker-node/blob/master/10/buster-slim/
FROM node:10.19.0-buster-slim

#-----------------------------------------------------------------------------


RUN userdel node
# && groupdel node  —>  groupdel: group 'node' does not exist


# Let's reinstall Python etc — needed later below, for node-gyp (KEEPDEPS)
# which is needed by the fibers module, which will get built later
# when Yarn installs node_modules/ things.
# Git is needed by gulpfile.js. The others are nice for troubleshooting, e.g. Tape security tests
# that send http requests — then curl is nice to have, so can replay the requests manually in Bash.
RUN \
  apt-get update && \
  apt-get install -y \
      # Nice to have:
      tree \
      curl \
      net-tools \
      git

# For building node-gyp:

RUN \
  apt-get install -y \
      python

RUN \
  apt-get install -y \
      g++ \
      build-essential

# Oddly enough, 'ps' not installed:
RUN \
  apt-get install -y \
      procps

      #gcc \
      #make \
      #libgcc \
      #linux-headers \
      #binutils-gold \
      #gnupg \

# If this error happens:
# gulp[33]: ../src/node_contextify.cc:629:static void node::contextify::ContextifyScript::New(const v8::FunctionCallbackInfo<v8::Value>&): Assertion `args[1]->IsString()' failed.
# Then upgrade Gulp to a more recent version: yarn upgarde gulp
# Maybe delete node_modules, and docker/gulp-home
# More here: https://github.com/gulpjs/gulp/issues/2162  (happened for me with Ubuntu Linux)

RUN cd /usr/local/bin/ && \
    ln -s /opt/talkyard/server/node_modules/.bin/gulp ./

WORKDIR /opt/talkyard/server/

COPY entrypoint.sh /docker-entrypoint.sh
RUN  chmod ugo+x   /docker-entrypoint.sh
ENTRYPOINT ["/docker-entrypoint.sh"]

# For debugging test code, via `node --debug-brk --inspect=9229`. [8EA02R4]
EXPOSE 9229


CMD ["echo 'Specify a command in docker-compose.yml or on the command line instead. Bye.' && exit 0"]

