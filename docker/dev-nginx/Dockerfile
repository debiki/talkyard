FROM ubuntu

WORKDIR /tmp

RUN apt-get update

# Install PCRE so rewriting urls work. This apparently installs lots of C++ build stuff too?
# And install OpenSSL and Make. And utilities.
RUN apt-get install -y \
  libpcre3-dev libpcre++-dev \
  libssl-dev  make \
  tree less wget curl net-tools

WORKDIR /tmp/

RUN \
  wget http://nginx.org/download/nginx-1.9.11.tar.gz && \
  tar -xf nginx-1.9.11.tar.gz

COPY modules /tmp/nginx-modules/

WORKDIR /tmp/nginx-1.9.11

RUN  ./configure \
      --with-debug \
      --prefix=/opt/nginx \
      --sbin-path=/usr/sbin/nginx \
      --conf-path=/etc/nginx/nginx.conf \
      --pid-path=/run/nginx.pid \
      --lock-path=/run/lock/subsys/nginx \
      --error-log-path=/var/log/nginx/error.log \
      --http-log-path=/var/log/nginx/access.log \
      --with-http_gzip_static_module \
      --with-http_stub_status_module \
      --with-http_ssl_module \
      --with-http_v2_module \
      --with-pcre \
      --with-ipv6 \
      --with-http_mp4_module \
      --add-module=/tmp/nginx-modules/nchan

RUN \
  make && \
  make install

# --user=nginx \
# --group=nginx \

WORKDIR /etc/nginx/

COPY 502.html   /opt/nginx/html/502.html
COPY nginx.conf /etc/nginx/nginx.conf

