target/start \
  -Dlogger.application=TRACE \
  -Dhttp.port=9000 \
  -Xdebug -Xrunjdwp:transport=dt_socket,address=9999,server=y,suspend=n

