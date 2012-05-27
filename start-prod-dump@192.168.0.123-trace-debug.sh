target/start \
  -Dlogger.application=TRACE \
  -Dhttp.port=9003 \
  -Dconfig.resource=prod-dump@192.168.0.123.conf \
  -Xdebug -Xrunjdwp:transport=dt_socket,address=9999,server=y,suspend=n

