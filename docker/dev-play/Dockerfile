FROM java:openjdk-8u77-jdk-alpine

RUN apk add --no-cache \
  # Required:
  curl unzip \
  # Nice to have: (why telnet not found?)
  tree less wget net-tools bash

ENV ACVERSION 1.3.7
ENV ACTIVATOR activator-$ACVERSION

RUN \
  curl https://downloads.typesafe.com/typesafe-activator/$ACVERSION/typesafe-$ACTIVATOR-minimal.zip \
    > /tmp/$ACTIVATOR.zip

# Concerning +rw for /opt/typesafe-activator/: Play writes some files to directories
# within the archive. Otherwise:
#   Error during sbt execution: java.io.IOException: No such file or directory
#   see: http://stackoverflow.com/questions/10559313/play-framework-installation
RUN unzip /tmp/$ACTIVATOR.zip -d /tmp/ && \
    rm -f /tmp/$ACTIVATOR.zip && \
    mkdir /opt/ && \
    mv /tmp/activator-$ACVERSION-minimal /opt/typesafe-activator && \
    chmod -R ugo+rw /opt/typesafe-activator/ && \
    chmod -R ugo+x /opt/typesafe-activator/activator

# We'll map ~/.ivy2 and ~/.m2 to here, so the JAR cache won't vanish on container restart.
VOLUME ["/home/owner/.ivy2", "/home/owner/.sbt", "/opt/debiki"]

# Play's HTTP and HTTPS listen ports, Java debugger port, JMX port 3333.
EXPOSE 9000 9443 9999 3333

# Ooops this should be a volume? Or it'll all be lost. SHOULD fix.
RUN mkdir -p /opt/debiki/uploads/ && \
    chmod -R ugo+rw /opt/debiki/uploads/

WORKDIR /opt/debiki/server/

COPY entrypoint.sh /docker-entrypoint.sh
RUN  chmod ugo+x   /docker-entrypoint.sh
ENTRYPOINT ["/docker-entrypoint.sh"]

# overriden in docker-compose.yml
ENV PLAY_MEM_MB 2048

CMD ["/opt/typesafe-activator/activator", \
  "-mem $PLAY_MEM_MB", \
  "-jvm-debug 9999", \
  "-Dcom.sun.management.jmxremote.port=3333", \
  "-Dcom.sun.management.jmxremote.ssl=false", \
  "-Dcom.sun.management.jmxremote.authenticate=false", \
  "-Dhttp.port=9000", \
  "-Dhttps.port=9443", \
  "-Dconfig.file=../conf/dev-test-localhost.conf", \
  "-DcrazyFastStartSkipSearch=true", \
  "run"]

