# ./run crazy
# ./run debug (the default)
# ./run recreate-database


function build_dev_server_image {
  docker build -t debiki-dev-server:v0 scripts/docker/debiki-dev-server/
}

function run_and_remove_dev_server_container {
  docker run \
    --rm \
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
  echo ',-------------------------------------------------------.'
  echo '| Run:  scripts/activator-crazyFastStartSkipSearch.sh   |'
  echo '| Or simply:  scripts/activator                         |'
  echo '| And then, to start the HTTP server:  run              |'
  echo '| Then visit: http://localhost:9000                     |'
  echo '`-------------------------------------------------------'"'"
}


# Build image if needed.
if [ -z "`docker images | egrep 'debiki-dev-server\s+v0\s+'`" ]; then
  echo 'Building debiki-dev-server image...'
  build_dev_server_image
fi

# Run container.
echo 'Running and removing debiki-dev-server container...'
tips
run_and_remove_dev_server_container


# vim: fdm=marker et ts=2 sw=2 tw=0 list
