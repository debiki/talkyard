FROM openjdk:8u92-jre-alpine

# SECURITY SHOULD not be root (in Docker container)
#RUN groupadd -r play && useradd -r -g play play

# Nice to have: (but why telnet not found?)
RUN apk add --no-cache \
  curl tree less wget net-tools bash

# Play's HTTP and HTTPS listen ports, Java debugger port, JMX port 3333.
EXPOSE 9000 9443 9999 3333

RUN mkdir -p /opt/ed/uploads/ && \
    chmod -R ugo+rw /opt/ed/uploads/

# Frequently modified JARs have been moved to app-lib-debiki/ and we here copy them in a
# separate step, so only that step will have to be pushed/pulled to/from Docker Hub.
COPY app             /opt/ed/app
COPY app-lib-debiki  /opt/ed/app/lib/
COPY app-bin         /opt/ed/app/bin/
# Only copy *-prod files. Other stuff might contain private things, e.g. override.conf might
# contain test suite OpenAuth credentials.
COPY app-conf/app-prod.conf  /opt/ed/app/conf/
COPY app-conf/logback.xml    /opt/ed/app/conf/
COPY build-info      /opt/ed/build-info/

ENV PLAY_HEAP_MEMORY_MB 1000

# Play will search for app-prod-override.conf in the same dir. See [4WDKPU2] in ed-prod-one.
ENV CONFIG_FILE /opt/ed/app/conf/app-prod.conf

WORKDIR /opt/ed/app

# this —> "Bad root server path: /opt/ed/app/-jvm-debug 9999", no idea why...
CMD ["/opt/ed/app/bin/ed-server", \
  "-jvm-debug 9999", \
  "-Dcom.sun.management.jmxremote.port=3333", \
  "-Dcom.sun.management.jmxremote.ssl=false", \
  "-Dcom.sun.management.jmxremote.authenticate=false", \
  "-Dhttp.port=9000", \
  "-Dhttps.port=9443", \
  "-Dconfig.file=$CONFIG_FILE"]

# ...but this identical command works fine:
# the PID file might not get deleted if we shutdown during startup, see Globals.scala [65YKFU02]
CMD rm -f /opt/ed/app/RUNNING_PID && exec /opt/ed/app/bin/ed-server \
  -J-Xms${PLAY_HEAP_MEMORY_MB}m \
  -J-Xmx${PLAY_HEAP_MEMORY_MB}m \
  -jvm-debug 9999 \
  -Dcom.sun.management.jmxremote.port=3333 \
  -Dcom.sun.management.jmxremote.ssl=false \
  -Dcom.sun.management.jmxremote.authenticate=false \
  -Dhttp.port=9000 \
  -Dhttps.port=9443 \
  # It's ok to use urandom, see:   [30PUK42]
  # - http://www.2uo.de/myths-about-urandom/
  # - http://sockpuppet.org/blog/2014/02/25/safely-generate-random-numbers/
  # - http://security.stackexchange.com/a/7074/9487
  # - Google Cloud Engine support said "Swich to /dev/urandom if possible" when I asked
  #   about some stuff related to /dev/random being slow.
  # and we need it, because otherwise the server might block up to 30 minutes
  # when running scrypt the first time, waiting for "enough entropy".
  -Djava.security.egd=file:/dev/./urandom \
  -Dconfig.file=${CONFIG_FILE}

# and?
# -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=${DOMAIN_HOME}/logs/mps + PID

