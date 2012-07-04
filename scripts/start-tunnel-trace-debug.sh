if [ $# -ne 1 ]; then
  echo 'Usage: $0 listen-port'
  exit 1
fi

target/start \
  -Dconfig.resource=prod-tunnel.conf \
  -Dlogger.application=TRACE \
  -Dhttp.port=$1 \
  -Xdebug -Xrunjdwp:transport=dt_socket,address=9999,server=y,suspend=n

