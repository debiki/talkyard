FROM ubuntu:14.04


# Install Java
#====================

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


# Install PostgreSQL
#====================

# Add the PostgreSQL PGP key to verify their Debian packages.
# It should be the same key as https://www.postgresql.org/media/keys/ACCC4CF8.asc
RUN apt-key adv --keyserver keyserver.ubuntu.com --recv-keys B97B0AFCAA1A47F044F244A07FCC7D46ACCC4CF8

# Add PostgreSQL's repository. It contains the most recent stable release
#     of PostgreSQL, ``9.3``.
RUN echo "deb http://apt.postgresql.org/pub/repos/apt/ precise-pgdg main" > /etc/apt/sources.list.d/pgdg.list

# Install ``python-software-properties``, ``software-properties-common`` and PostgreSQL 9.3
#  There are some warnings (in red) that show up during the build. You can hide
#  them by prefixing each apt-get statement with DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y python-software-properties software-properties-common postgresql-9.3 postgresql-client-9.3 postgresql-contrib-9.3

# Allow anyone to connect to PostgreSQL. The root user can `su - postgres`
# anyway, and already has access to the data container with the actual
# PostgreSQL data files. And we won't expose port 5432.
RUN mv /etc/postgresql/9.3/main/pg_hba.conf /etc/postgresql/9.3/main/pg_hba.conf.orig
RUN echo "local all all trust" >> /etc/postgresql/9.3/main/pg_hba.conf
RUN echo "host all all 0.0.0.0/0 trust" >> /etc/postgresql/9.3/main/pg_hba.conf
RUN echo "logging_collector = on" >> /etc/postgresql/9.3/main/postgresql.conf

# Listen on all interfaces and expose the PostgreSQL port.
RUN echo "listen_addresses='*'" >> /etc/postgresql/9.3/main/postgresql.conf

# Create statistics temp dir, very much needed.
USER postgres
RUN mkdir /var/run/postgresql/9.3-main.pg_stat_tmp
USER root

# TODO ?
# RUN dpkg-reconfigure locales && \
#     locale-gen C.UTF-8 && \
#     /usr/sbin/update-locale LANG=C.UTF-8
# 
# ENV LC_ALL C.UTF-8


# Install Supervisor and SSH
#====================
# See https://docs.docker.com/articles/using_supervisord/.

RUN apt-get update && apt-get install -y openssh-server supervisor
RUN mkdir -p /var/run/sshd /var/log/supervisor
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf


# Install Debiki
#====================

RUN mkdir -p /opt/debiki/database/scripts
COPY debiki-server /opt/debiki/server
COPY scripts /opt/debiki/scripts


# Open ports
#====================

# Expose HTTP and HTTPS and SSH. (Via an SSH tunnel it's possible to connect to JMX
# and Java debugger ports.)
EXPOSE 80 443 22

# Need not expose PostgreSQL port 5432.


# Start
#====================

CMD ["/usr/bin/supervisord"]


# http://stackoverflow.com/questions/7902731/supervisord-does-not-start-killed-processes?rq=1
# autorestart=true

# !! http://stackoverflow.com/questions/26423515/how-to-automatically-update-your-docker-containers-if-base-images-are-updated

# http://container42.com/2014/11/18/data-only-container-madness/

# Tips:
# http://crosbymichael.com/dockerfile-best-practices-take-2.html

