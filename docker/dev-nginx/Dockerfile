# Parts Copyright (c) NGINX Inc.
# License: the same License as NGINX itself, 2-clause BSD
# (See: https://github.com/nginxinc/docker-nginx/issues/80)
#
# Parts Copyright (c) 2016 Kaj Magnus Lindberg
# License: MIT (Kaj Magnus's changes in this file only).


FROM alpine:3.3

# MAINTAINER NGINX Docker Maintainers "docker-maint@nginx.com"

ENV NGINX_VERSION 1.9.14

ENV GPG_KEYS B0F4253373F8F6F510D42178520A9993A1C052F8
ENV CONFIG "\
	--prefix=/etc/nginx \
	--sbin-path=/usr/sbin/nginx \
	--modules-path=/usr/lib/nginx/modules \
	--conf-path=/etc/nginx/nginx.conf \
	--error-log-path=/var/log/nginx/error.log \
	--http-log-path=/var/log/nginx/access.log \
	--pid-path=/var/run/nginx.pid \
	--lock-path=/var/run/nginx.lock \
	--http-client-body-temp-path=/var/cache/nginx/client_temp \
	--http-proxy-temp-path=/var/cache/nginx/proxy_temp \
	--http-fastcgi-temp-path=/var/cache/nginx/fastcgi_temp \
	--http-uwsgi-temp-path=/var/cache/nginx/uwsgi_temp \
	--http-scgi-temp-path=/var/cache/nginx/scgi_temp \
	--user=nginx \
	--group=nginx \
	--with-http_ssl_module \
	--with-http_realip_module \
	# adds text before and after a response
	# --with-http_addition_module \
	# modifies a response by replacing one specified string by another
	# --with-http_sub_module \
	# file management automation via the WebDAV.
	# --with-http_dav_module \
	# streaming Flash
	# --with-http_flv_module \
	--with-http_mp4_module \
	# decompresses gzip, if client doesn't support it
	# --with-http_gunzip_module \
	# sends precompressed files with the '.gz' suffix
	--with-http_gzip_static_module \
	#--with-http_random_index_module \
	# what?
	# --with-http_secure_link_module \
	--with-http_stub_status_module \
	# client authorization based on the result of a subrequest
	# --with-http_auth_request_module \
	# --with-http_xslt_module=dynamic \
	# --with-http_image_filter_module=dynamic \
	# --with-http_geoip_module=dynamic \
	# --with-http_perl_module=dynamic \
	--with-threads \
	--with-stream \
	--with-stream_ssl_module \
	# splits a request into subrequests, each returning a certain range of response -> effective caching of big responses
	# --with-http_slice_module \
	# --with-mail \
	# --with-mail_ssl_module \
	# asynchronous file I/O (AIO) on FreeBSD and Linux
	--with-file-aio \
	--with-http_v2_module \
	--with-ipv6 \
	--add-module=/tmp/nginx-modules/nchan \
	"

# Copy nchan source code
COPY modules /tmp/nginx-modules/

RUN \
	addgroup -S nginx \
	&& adduser -D -S -h /var/cache/nginx -s /sbin/nologin -G nginx nginx \
	&& apk add --no-cache --virtual .build-deps \
		gcc \
		libc-dev \
		make \
		openssl-dev \
		pcre-dev \
		zlib-dev \
		linux-headers \
		curl \
		gnupg \
		# libxslt-dev \
		# some graphics lib, needed for ? http_image_filter_module ?
		# gd-dev \
		# geoip-dev \
		perl-dev \
	&& curl -fSL http://nginx.org/download/nginx-$NGINX_VERSION.tar.gz -o nginx.tar.gz \
	&& curl -fSL http://nginx.org/download/nginx-$NGINX_VERSION.tar.gz.asc  -o nginx.tar.gz.asc \
	&& export GNUPGHOME="$(mktemp -d)" \
	&& gpg --keyserver ha.pool.sks-keyservers.net --recv-keys "$GPG_KEYS" \
	&& gpg --batch --verify nginx.tar.gz.asc nginx.tar.gz \
	&& rm -r "$GNUPGHOME" nginx.tar.gz.asc \
	&& mkdir -p /usr/src \
	&& tar -zxC /usr/src -f nginx.tar.gz \
	&& rm nginx.tar.gz \
	&& cd /usr/src/nginx-$NGINX_VERSION \
	&& ./configure $CONFIG --with-debug \
	&& make \
	&& mv objs/nginx objs/nginx-debug \
	# && mv objs/ngx_http_xslt_filter_module.so objs/ngx_http_xslt_filter_module-debug.so \
	# && mv objs/ngx_http_image_filter_module.so objs/ngx_http_image_filter_module-debug.so \
	# && mv objs/ngx_http_geoip_module.so objs/ngx_http_geoip_module-debug.so \
	# && mv objs/ngx_http_perl_module.so objs/ngx_http_perl_module-debug.so \
	&& ./configure $CONFIG \
	&& make \
	&& make install \
	&& rm -rf /etc/nginx/html/ \
	# apparently this stuff is installed by default, but we don't use it.
	&& rm -f /etc/nginx/fastcgi* \
             /etc/nginx/koi-* \
             /etc/nginx/scgi_params* \
             /etc/nginx/uwsgi_params* \
             /etc/nginx/win-utf \
	&& mkdir /etc/nginx/sites-available \
	         /etc/nginx/sites-enabled \
	# && mkdir -p /usr/share/nginx/html/ \
	# && install -m644 html/index.html /usr/share/nginx/html/ \
	# && install -m644 html/50x.html /usr/share/nginx/html/ \
	&& install -m755 objs/nginx-debug /usr/sbin/nginx-debug \
	# && install -m755 objs/ngx_http_xslt_filter_module-debug.so /usr/lib/nginx/modules/ngx_http_xslt_filter_module-debug.so \
	# && install -m755 objs/ngx_http_image_filter_module-debug.so /usr/lib/nginx/modules/ngx_http_image_filter_module-debug.so \
	# && install -m755 objs/ngx_http_geoip_module-debug.so /usr/lib/nginx/modules/ngx_http_geoip_module-debug.so \
	# && install -m755 objs/ngx_http_perl_module-debug.so /usr/lib/nginx/modules/ngx_http_perl_module-debug.so \
	# && ln -s ../../usr/lib/nginx/modules /etc/nginx/modules \
	&& strip /usr/sbin/nginx* \
	# All modules above commented out.
	# && strip /usr/lib/nginx/modules/*.so \
	&& runDeps="$( \
		scanelf --needed --nobanner /usr/sbin/nginx /usr/lib/nginx/modules/*.so \
			| awk '{ gsub(/,/, "\nso:", $2); print "so:" $2 }' \
			| sort -u \
			| xargs -r apk info --installed \
			| sort -u \
	)" \
	&& apk add --virtual .nginx-rundeps $runDeps \
	&& apk del .build-deps \
	&& rm -rf /usr/src/nginx-$NGINX_VERSION \
	&& apk add --no-cache gettext \
	\
	# forward request and error logs to docker log collector
	&& ln -sf /dev/stdout /var/log/nginx/access.log \
	&& ln -sf /dev/stderr /var/log/nginx/error.log

# Add 'bash' so we can 'docker exec' into the container, + some tools. (wget & less already works)
RUN apk add --no-cache bash tree curl net-tools telnet

COPY nginx.conf /etc/nginx/nginx.conf
COPY vhost.conf /etc/nginx/vhost.conf
COPY 502.html   /opt/nginx/html/502.html

# Don't expose port 81 (the publish-websocket-messages port) — it should be accessible from
# inside the Docker network only, so that only Play Framework (located inside the network)
# can publish events.
EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]

