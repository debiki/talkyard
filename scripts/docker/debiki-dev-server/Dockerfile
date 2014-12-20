FROM ubuntu:14.04

# Install add-apt-repository, and utils: tree and curl
RUN apt-get update && apt-get install -y software-properties-common python-software-properties tree curl

# Add Java 8 repo
RUN add-apt-repository -y ppa:webupd8team/java

# Install Java 8
# First mark Oracle's license as accepted, see: http://askubuntu.com/a/190674/48382
# otherwise the installer pops up a dialog asking you to accept it, which doesn't work
# when running `docker build`.
RUN echo debconf shared/accepted-oracle-license-v1-1 select true | sudo debconf-set-selections
RUN echo debconf shared/accepted-oracle-license-v1-1 seen true | sudo debconf-set-selections
RUN apt-get update && apt-get install -y oracle-java8-installer

# COPY debiki-server-1.0-SNAPSHOT /opt/debiki/server

# TODO rm -fr /var/cache/oracle-jdk8-installer
# TODO && rm -rf /var/lib/apt/lists/*

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
