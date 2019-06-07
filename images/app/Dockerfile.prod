FROM openjdk:8u212-alpine3.9

# SECURITY SHOULD not be root (in Docker container)
#RUN groupadd -r play && useradd -r -g play play

# Nice to have:
RUN apk add --no-cache \
  curl tree less wget net-tools bash \
  # Telnet, nice for troubleshooting SMTP problems for example.
  busybox-extras

# Play's HTTP and HTTPS listen ports, Java debugger port, JMX port 3333.
EXPOSE 9000 9443 9999 3333

RUN mkdir -p /opt/talkyard/uploads/ && \
    chmod -R ugo+rw /opt/talkyard/uploads/

# Frequently modified JARs have been moved to app-lib-talkyard/ and we here copy them in a
# separate step, so only that step will have to be pushed/pulled to/from Docker Hub.
COPY app              /opt/talkyard/app
COPY app-lib-talkyard /opt/talkyard/app/lib/
COPY app-bin          /opt/talkyard/app/bin/
# Only copy *-prod files. Other stuff might contain private things, e.g. override.conf might
# contain test suite OpenAuth credentials.
COPY app-conf/app-prod.conf     /opt/talkyard/app/conf/
COPY app-conf/logback-prod.xml  /opt/talkyard/app/conf/
COPY version.txt     /opt/talkyard/app/
COPY build-info      /opt/talkyard/build-info/

# The Scala code loads Javascript for server side rendering, from here. [APPJSPATH]
COPY assets /opt/talkyard/app/assets


ENV PLAY_HEAP_MEMORY_MB 1000

# Play will search for app-prod-override.conf in the same dir. See [4WDKPU2] in talkyard-prod-one.
ENV CONFIG_FILE /opt/talkyard/app/conf/app-prod.conf

WORKDIR /opt/talkyard/app

# # this —> "Bad root server path: /opt/talkyard/app/-jvm-debug 9999", no idea why...
# CMD ["/opt/talkyard/app/bin/talkyard-server", \
#   "-jvm-debug 9999", \
#   "-Dcom.sun.management.jmxremote.port=3333", \
#   "-Dcom.sun.management.jmxremote.ssl=false", \
#   "-Dcom.sun.management.jmxremote.authenticate=false", \
#   "-Dhttp.port=9000", \
#   "-Dhttps.port=9443", \
#   # SSL has security flaws. Use TLS instead. [NOSSL] [PROTOCONF]
#   -Ddeployment.security.SSLv2Hello=false \
#   -Ddeployment.security.SSLv3=false \
#   -Dhttps.protocols=TLSv1.1,TLSv1.2 \
#   -Djdk.tls.client.protocols=TLSv1.1,TLSv1.2 \
#   "-Dconfig.file=$CONFIG_FILE"]

# ...but this identical command works fine:
# the PID file might not get deleted if we shutdown during startup, see Globals.scala [65YKFU02]
CMD rm -f /opt/talkyard/app/RUNNING_PID && exec /opt/talkyard/app/bin/talkyard-server \
  -J-Xms${PLAY_HEAP_MEMORY_MB}m \
  -J-Xmx${PLAY_HEAP_MEMORY_MB}m \
  -jvm-debug 9999 \
  -Dcom.sun.management.jmxremote.port=3333 \
  -Dcom.sun.management.jmxremote.ssl=false \
  -Dcom.sun.management.jmxremote.authenticate=false \
  -Dhttp.port=9000 \
  -Dhttps.port=9443 \
  #
  # SSL has security flaws. Use TLS. [NOSSL] COULD LATER 2020?: TLSv1=false (even later: TLSv1.1=false)
  # About the flags: https://superuser.com/a/770465/95772
  # and: https://blogs.oracle.com/java-platform-group/jdk-8-will-use-tls-12-as-default
  # and: https://stackoverflow.com/questions/32912175/disabling-tls1
  -Ddeployment.security.SSLv2Hello=false \
  -Ddeployment.security.SSLv3=false \
  # From https://superuser.com/a/928498/95772:
  # (Enable TLSv1.3 later, when no longer draft. Email protocol config elsewhere: [PROTOCONF])
  -Dhttps.protocols=TLSv1.1,TLSv1.2 \
  # Not sure what this (below) is.
  # "specific SunJSSE protocols" — https://docs.oracle.com/javase/8/docs/technotes/guides/security/jsse/JSSERefGuide.html#InstallationAndCustomization
  # and "Controls the underlying platform TLS implementation" – https://blogs.oracle.com/java-platform-group/diagnosing-tls,-ssl,-and-https
  # = what ??? TLS isn't a "specific SunJSSE protocol", weird.
  # Anyway, maybe makes *something* use only TLS 1.1 and 1.2 (not SSL), so let's do it:
  -Djdk.tls.client.protocols=TLSv1.1,TLSv1.2 \
  #
  # It's ok to use urandom, see:   [30PUK42]
  # - http://www.2uo.de/myths-about-urandom/
  # - http://sockpuppet.org/blog/2014/02/25/safely-generate-random-numbers/
  # - http://security.stackexchange.com/a/7074/9487
  # - Google Cloud Engine support said "Swich to /dev/urandom if possible" when I asked
  #   about some stuff related to /dev/random being slow.
  # and we need it, because otherwise the server might block up to 30 minutes
  # when running scrypt the first time, waiting for "enough entropy".
  -Djava.security.egd=file:/dev/./urandom \
  #
  -Dlogger.file=/opt/talkyard/app/conf/logback-prod.xml \
  -Dconfig.file=${CONFIG_FILE}

# and?
# -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=${DOMAIN_HOME}/logs/mps + PID

