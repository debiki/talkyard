FROM java:8-jdk

# COPY debiki-server-1.0-SNAPSHOT /opt/debiki/server

# TODO change from ACTIVATOR to ACTIVATOR_VERSION 1.2.10
# TODO move `unzip` to the top of this file
ENV ACTIVATOR typesafe-activator-1.2.10
RUN curl http://downloads.typesafe.com/typesafe-activator/1.2.10/$ACTIVATOR.zip > /tmp/$ACTIVATOR.zip
RUN apt-get update && apt-get install -y unzip postgresql-client
RUN unzip /tmp/$ACTIVATOR.zip -d /tmp/ && \
    rm -f /tmp/$ACTIVATOR.zip && \
    mv /tmp/activator-1.2.10 /opt/typesafe-activator

VOLUME ["/root/.ivy2", "/root/.sbt"]

# Play's HTTP listen port, Java debugger ports (sometimes I've been using 5005, sometimes 9999), JMX port 3333.
EXPOSE 9000 5005 9999 3333

WORKDIR /opt/debiki/server/
