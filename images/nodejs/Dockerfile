# Node.js Linux Dockerfile, for running Gulp and transpiling & minifying Javascript & CSS.
#
# Previously, this image was used for running Webdriverio tests but now we run
# those directly on the host, and install the appropriate version of Nodejs
# using Nix, see: ../../flake.nix and, for old Webdriverio 6 tests
# we use: ../../tests/e2e/flake.nix.

# Images list: https://hub.docker.com/_/node/
FROM node:24.14.0-trixie-slim

LABEL org.opencontainers.image.title="Talkyard Nodejs" \
      io.talkyard.edition="se" \
      io.talkyard.version="1"


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
      # For building node-gyp: — not using any more? No, using ../../tests/e2e/flake.nix
      # instead for old Webdriverio 6 tests.
      #python \
      # For the C preprocessor:
      gcc \
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

