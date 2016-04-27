FROM java:openjdk-8u77-jre-alpine

# Nice to have: (but why telnet not found?)
RUN apk add --no-cache \
  curl tree less wget net-tools bash

# Play's HTTP and HTTPS listen ports, Java debugger port, JMX port 3333.
EXPOSE 9000 9443 9999 3333

RUN mkdir -p /opt/ed/uploads/ && \
    chmod -R ugo+rw /opt/ed/uploads/

# Frequently modified JARs have been moved to play-lib-debiki/ and we here copy them in a
# separate step, so only that step will have to be pushed/pulled to/from Docker Hub.
COPY play            /opt/ed/play
COPY play-lib-debiki /opt/ed/play/lib/
COPY localhost.conf  /opt/ed/play-conf/localhost.conf

VOLUME ["/opt/ed/play-conf", "/opt/ed/uploads"]

# overriden in docker-compose.yml
ENV PLAY_MEM_MB 2048
ENV CONFIG_FILE /opt/ed/play-conf/localhost.conf

#WORKDIR /opt/ed/play
WORKDIR /

# this —> "Bad root server path: /opt/ed/play/-jvm-debug 9999", no idea why...
CMD ["/opt/ed/play/bin/debiki-server", \
  "-jvm-debug 9999", \
  "-Dcom.sun.management.jmxremote.port=3333", \
  "-Dcom.sun.management.jmxremote.ssl=false", \
  "-Dcom.sun.management.jmxremote.authenticate=false", \
  "-Dhttp.port=9000", \
  "-Dhttps.port=9443", \
  "-Dconfig.file=$CONFIG_FILE"]

# ...but this identical command works fine:
# the PID file might not get deleted if we shutdown during startup, see Globals.scala [65YKFU02]
CMD rm -f /opt/ed/play/RUNNING_PID && exec /opt/ed/play/bin/debiki-server \
  -jvm-debug 9999 \
  -Dcom.sun.management.jmxremote.port=3333 \
  -Dcom.sun.management.jmxremote.ssl=false \
  -Dcom.sun.management.jmxremote.authenticate=false \
  -Dhttp.port=9000 \
  -Dhttps.port=9443 \
  -Dconfig.file=$CONFIG_FILE

  # -Dconfig.file=$CONFIG_FILE/opt/ed/play-conf/prod.conf

