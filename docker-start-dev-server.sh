# ./run crazy
# ./run debug (the default)
# ./run recreate-database

function build_dev_server_image {
  docker build -t debiki-dev-server:v0 scripts/docker/debiki-dev-server/
}

function create_new_dev_server_container {
  docker run \
    -it \
    --name debiki-dev-server \
    -p 3333:3333 \
    -p 5005:5005 \
    -p 9000:9000 \
    -p 9999:9999 \
    --link debiki-dev-database:database \
    -v ~/.ivy2/:/root/.ivy2/ \
    -v ~/.sbt/:/root/.sbt/ \
    -v="`pwd`/../:/opt/debiki/" \
    debiki-dev-server:v0 \
    /bin/bash
}

function tips {
  echo ',-------------------------------------------------.'
  echo '| Run:  s/activator-crazyFastStartSkipSearch.sh   |'
  echo '| Or simply:  s/activator                         |'
  echo '| And then, to start the HTTP server:  run        |'
  echo '| Then visit: http://localhost:9000               |'
  echo '`-------------------------------------------------'"'"
}

# Attach if container already running.
if [ -n "`docker ps | grep debiki-dev-server:v0`" ]; then
  echo 'Attaching to debiki-dev-server container...'
  tips
  docker attach debiki-dev-server
  exit
fi

# If container exists, start and attach.
if [ -n "`docker ps -a | grep debiki-dev-server:v0`" ]; then
  echo 'Restarting and attaching to debiki-dev-server container...'
  docker start debiki-dev-server
  tips
  docker attach debiki-dev-server
  exit
fi

# Build image if needed.
if [ -z "`docker images | egrep 'debiki-dev-server\s+v0\s+'`" ]; then
  echo 'Building debiki-dev-server image...'
  build_dev_server_image
fi

# Create container.
echo 'Creating debiki-dev-server container...'
tips
create_new_dev_server_container


# vim: fdm=marker et ts=2 sw=2 tw=0 list
