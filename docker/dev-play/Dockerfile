FROM java:8-jdk

RUN apt-get update && apt-get install -y \
  unzip \
  postgresql-client  \
  tree less wget curl net-tools

ENV ACVERSION 1.3.7
ENV ACTIVATOR activator-$ACVERSION
#RUN curl http://downloads.typesafe.com/typesafe-activator/1.2.10/$ACTIVATOR.zip > /tmp/$ACTIVATOR.zip
RUN curl https://downloads.typesafe.com/typesafe-activator/$ACVERSION/typesafe-$ACTIVATOR-minimal.zip > /tmp/$ACTIVATOR.zip

RUN unzip /tmp/$ACTIVATOR.zip -d /tmp/ && \
    rm -f /tmp/$ACTIVATOR.zip && \
    mv /tmp/activator-$ACVERSION-minimal /opt/typesafe-activator

VOLUME ["/root/.ivy2", "/root/.sbt"]

# Play's HTTP and HTTPS listen ports, Java debugger port, JMX port 3333.
EXPOSE 9000 9443 9999 3333

RUN mkdir -p /opt/debiki/uploads/

WORKDIR /opt/debiki/server/

CMD ["/opt/typesafe-activator/activator", \
  "-mem 2048", \
  "-jvm-debug 9999", \
  "-Dcom.sun.management.jmxremote.port=3333", \
  "-Dcom.sun.management.jmxremote.ssl=false", \
  "-Dcom.sun.management.jmxremote.authenticate=false", \
  "-Dhttp.port=9000", \
  "-Dhttps.port=9443", \
  "-Dconfig.file=../conf/dev-test-localhost.conf", \
  "-DcrazyFastStartSkipSearch=true", \
  "run"]

