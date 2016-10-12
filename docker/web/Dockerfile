# Parts Copyright (c) 2016 Kaj Magnus Lindberg
# License: 2-clause BSD (Kaj Magnus's changes in this file only).
#
# Parts Copyright (C) 2011-2016 Nginx, Inc.
# License: (2-clause BSD)
# All rights reserved.
#
# Redistribution and use in source and binary forms, with or without
# modification, are permitted provided that the following conditions
# are met:
# 1. Redistributions of source code must retain the above copyright
#    notice, this list of conditions and the following disclaimer.
# 2. Redistributions in binary form must reproduce the above copyright
#    notice, this list of conditions and the following disclaimer in the
#    documentation and/or other materials provided with the distribution.
#
# THIS SOFTWARE IS PROVIDED BY THE AUTHOR AND CONTRIBUTORS ``AS IS'' AND
# ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
# IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
# ARE DISCLAIMED.  IN NO EVENT SHALL THE AUTHOR OR CONTRIBUTORS BE LIABLE
# FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
# DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS
# OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
# HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
# LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY
# OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
# SUCH DAMAGE.


FROM alpine:3.4

# MAINTAINER NGINX Docker Maintainers "docker-maint@nginx.com"

ENV NGINX_VERSION 1.11.4

# Do this first, because we need 'make' early, and also it's boring to wait for Nginx
# to download.
RUN \
	addgroup -S nginx \
	&& adduser -D -S -h /var/cache/nginx -s /sbin/nologin -G nginx nginx \
	# '--virtual .build-deps' lets one uninstall all these build dependencies,
	# like so:  'apk del .build-deps' (done at the end of this file)
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
    # Don't include this in the 'apk add' step above, because then libgcc would get
    # uninstalled a bit below by 'apk del .build-deps'.
    && apk add --no-cache \
		# /opt/luajit/lib/libluajit-5.1.so.2 needs shared lib libgcc_s.so.1
		libgcc \
	&& curl -fSL http://nginx.org/download/nginx-$NGINX_VERSION.tar.gz -o nginx.tar.gz \
	&& curl -fSL http://nginx.org/download/nginx-$NGINX_VERSION.tar.gz.asc  -o nginx.tar.gz.asc

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
	# --with-stream_realip_module \
	# --with-stream_geoip_module=dynamic \
	# splits a request into subrequests, each returning a certain range of response -> effective caching of big responses
	# --with-http_slice_module \
	# --with-mail \
	# --with-mail_ssl_module \
	# asynchronous file I/O (AIO) on FreeBSD and Linux
	--with-file-aio \
	--with-http_v2_module \
	--with-ipv6 \
	# won't ever need to show any auto index? If adding it back, add 'autoindex off' here: [5KUP293]
	--without-http_autoindex_module \
	# skip server-side-includes module
	--without-http_ssi_module \
	# LuaJIT wants this;
	--with-ld-opt="-Wl,-rpath,/opt/luajit/lib" \
	# LuaJIT needs the devel kit.
	--add-module=/tmp/nginx-modules/ngx_devel_kit \
	--add-module=/tmp/nginx-modules/lua-nginx-module \
	--add-module=/tmp/nginx-modules/nchan \
	"

# Copy nchan source code
COPY modules /tmp/nginx-modules/

# Build LuaJIT
RUN cd /tmp/nginx-modules/luajit && \
    make PREFIX=/opt/luajit && \
    make install PREFIX=/opt/luajit

# Tell nginx's build system where to find LuaJIT 2.1:
ENV LUAJIT_LIB /opt/luajit/lib
ENV LUAJIT_INC /opt/luajit/include/luajit-2.1

RUN \
	export GNUPGHOME="$(mktemp -d)" \
	&& gpg --keyserver ha.pool.sks-keyservers.net --recv-keys "$GPG_KEYS" \
	&& gpg --batch --verify nginx.tar.gz.asc nginx.tar.gz \
	&& rm -r "$GNUPGHOME" nginx.tar.gz.asc \
	&& mkdir -p /usr/src \
	&& tar -zxC /usr/src -f nginx.tar.gz \
	&& rm nginx.tar.gz \
	&& cd /usr/src/nginx-$NGINX_VERSION \
	&& ./configure $CONFIG --with-debug \
	&& make -j$(getconf _NPROCESSORS_ONLN) \
	&& mv objs/nginx objs/nginx-debug \
	# && mv objs/ngx_http_xslt_filter_module.so objs/ngx_http_xslt_filter_module-debug.so \
	# && mv objs/ngx_http_image_filter_module.so objs/ngx_http_image_filter_module-debug.so \
	# && mv objs/ngx_http_geoip_module.so objs/ngx_http_geoip_module-debug.so \
	# && mv objs/ngx_http_perl_module.so objs/ngx_http_perl_module-debug.so \
	# && mv objs/ngx_stream_geoip_module.so objs/ngx_stream_geoip_module-debug.so \
	&& ./configure $CONFIG \
	&& make -j$(getconf _NPROCESSORS_ONLN) \
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
	# && install -m755 objs/ngx_stream_geoip_module-debug.so /usr/lib/nginx/modules/ngx_stream_geoip_module-debug.so \
	# && ln -s ../../usr/lib/nginx/modules /etc/nginx/modules \
	&& strip /usr/sbin/nginx* \
	# All modules above commented out.
	# && strip /usr/lib/nginx/modules/*.so \
	&& rm -rf /usr/src/nginx-$NGINX_VERSION \
	# Bring in gettext so we can get `envsubst`, then throw
	# the rest away. To do this, we need to install `gettext`
	# then move `envsubst` out of the way so `gettext` can
	# be deleted completely, then move `envsubst` back.
	&& apk add --no-cache --virtual .gettext gettext \
	&& mv /usr/bin/envsubst /tmp/ \
	\
	&& runDeps="$( \
		scanelf --needed --nobanner /usr/sbin/nginx /usr/lib/nginx/modules/*.so /tmp/envsubst \
			| awk '{ gsub(/,/, "\nso:", $2); print "so:" $2 }' \
			| sort -u \
			| xargs -r apk info --installed \
			| sort -u \
	)" \
	&& apk add --no-cache --virtual .nginx-rundeps $runDeps \
	&& apk del .build-deps \
	&& apk del .gettext \
	&& mv /tmp/envsubst /usr/local/bin/ \
	\
	# forward request and error logs to docker log collector
	&& ln -sf /dev/stdout /var/log/nginx/access.log \
	&& ln -sf /dev/stderr /var/log/nginx/error.log


RUN rm -fr /tmp/nginx-modules/

COPY lua-packages /opt/lua-packages/


# Add 'bash' so we can 'docker exec' into the container, + some tools. (wget & less already works)
RUN apk add --no-cache bash tree curl net-tools

COPY 502.html             /opt/nginx/html/502.html
COPY 503.html             /opt/nginx/html/503.html
COPY default-site         /etc/nginx/default-site/
# old, remove once I've edited edm & edc
COPY server-listen.conf   /etc/nginx/listen.conf
COPY server-listen.conf   /etc/nginx/
# old, remove once I've edited edm & edc
COPY server-ssl.conf      /etc/nginx/ssl-hardening.conf
COPY server-ssl.conf      /etc/nginx/
COPY http-limits.conf     /etc/nginx/
COPY server-limits.conf   /etc/nginx/
# old, remove once I've edited edm & edc
COPY server.conf          /etc/nginx/vhost.conf
COPY server.conf          /etc/nginx/
COPY nginx.conf           /etc/nginx/

# Frequently edited, so do last.
COPY ed-lua /opt/ed/lua/


# Don't expose port 81 (the publish-websocket-messages port) — it should be accessible from
# inside the Docker network only, so that only Play Framework (located inside the network)
# can publish events.
EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]

