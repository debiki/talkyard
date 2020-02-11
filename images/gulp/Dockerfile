# Node.js Linux Dockerfile, for running Gulp and Webdriverio, for Talkyard.

# Let's use Debian, not Alpine, so various e2e test Bash scripts
# will work as "expected" and not run into any Alpine oddities.
#
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


# The Node.js Dockerfile creates a user 'node' with id 1000.
# However, most people on Linux have id 1000 already, so 'node' = 1000
# results in an error in the entrypoint when it creates and su:s to
# a user with the same id as the host user [5RZ4HA9].
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
      git \
      # Oddly enough, 'ps' not installed:
      procps \
      # For building node-gyp:
      python \
      g++ \
      build-essential


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

