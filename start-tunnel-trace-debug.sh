target/start \
  -Dconfig.resource=prod-tunnel.conf \
  -Dlogger.application=TRACE \
  -Dhttp.port=9001 \
  -Xdebug -Xrunjdwp:transport=dt_socket,address=9999,server=y,suspend=n

