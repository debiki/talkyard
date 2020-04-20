# Parts Copyright (c) 2016 - 2018 Kaj Magnus Lindberg
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

# Based on:
# https://raw.githubusercontent.com/nginxinc/docker-nginx/master/mainline/alpine/Dockerfile

# In the distant future: Maybe switch to https://github.com/envoyproxy/envoy ?  & Zipkin tracing

FROM alpine:3.9

# [WS] upgr to 1.16.1
ENV NGINX_VERSION 1.15.12

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
		gnupg1 \
		# libxslt-dev \
		# some graphics lib, needed for ? http_image_filter_module ?
		# gd-dev \
		# geoip-dev \
		# Don't include this in the 'apk add' step above, because then libgcc would get
		# uninstalled a bit below by 'apk del .build-deps'.
		&& apk add --no-cache \
			# /opt/luajit/lib/libluajit-5.1.so.2 needs shared lib libgcc_s.so.1
			libgcc \
	&& curl -fSL https://nginx.org/download/nginx-$NGINX_VERSION.tar.gz -o nginx.tar.gz \
	&& curl -fSL https://nginx.org/download/nginx-$NGINX_VERSION.tar.gz.asc  -o nginx.tar.gz.asc

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
	--with-http_auth_request_module \
	# --with-http_xslt_module=dynamic \
	# --with-http_image_filter_module=dynamic \
	# --with-http_geoip_module=dynamic \
	--with-threads \
	--with-stream \
	--with-stream_ssl_module \
	# preread = For SNI I think.
	# --with-stream_ssl_preread_module \
	# --with-stream_realip_module \
	# --with-stream_geoip_module=dynamic \
	# splits a request into subrequests, each returning a certain range of response -> effective caching of big responses
	# --with-http_slice_module \
	# --with-mail \
	# --with-mail_ssl_module \
	# --with-compat \
	# asynchronous file I/O (AIO) on FreeBSD and Linux
	--with-file-aio \
	\
	# HTTP2 doesn't work with Lua scripts that call ngx.location.capture/_multi(..),
	# there'd be runtime errors. See [63DRN3M75] in ./old/.
	--with-http_v2_module \
	\
	# Disable stuff, and add Lua:
	# won't ever need to show any auto index? If adding it back, add 'autoindex off' here: [5KUP293]
	--without-http_autoindex_module \
	# skip server-side-includes module
	--without-http_ssi_module \
	# LuaJIT wants this;
	--with-ld-opt="-Wl,-rpath,/opt/luajit/lib" \
	# LuaJIT needs the devel kit.
	--add-module=/tmp/nginx-modules/ngx_devel_kit \
	--add-module=/tmp/nginx-modules/lua-nginx-module \
	# [WS] DELETE
	--add-module=/tmp/nginx-modules/nchan \
	"

# Copy nchan source code   [WS] DELETE nchan Git repo.
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
	&& found=''; \
	for server in \
		ha.pool.sks-keyservers.net \
		hkp://keyserver.ubuntu.com:80 \
		hkp://p80.pool.sks-keyservers.net:80 \
		pgp.mit.edu \
	; do \
		echo "Fetching GPG key $GPG_KEYS from $server"; \
		gpg --keyserver "$server" --keyserver-options timeout=10 --recv-keys "$GPG_KEYS" && found=yes && break; \
	done; \
	test -z "$found" && echo >&2 "error: failed to fetch GPG key $GPG_KEYS" && exit 1; \
	gpg --batch --verify nginx.tar.gz.asc nginx.tar.gz \
	&& rm -rf "$GNUPGHOME" nginx.tar.gz.asc \
	&& mkdir -p /usr/src \
	&& tar -zxC /usr/src -f nginx.tar.gz \
	&& rm nginx.tar.gz \
	&& cd /usr/src/nginx-$NGINX_VERSION \
	# generate a debug build, will be at /usr/sbin/nginx-debug
	&& ./configure $CONFIG \
	    # Enables debug log messages: (otherwise they won't get logged at all, never?)
	    --with-debug \
	    # So can backtrace core dumps: [NGXCORED]
	    --with-cc-opt='-O0 -ggdb3 -fvar-tracking-assignments' \
	&& make -j$(getconf _NPROCESSORS_ONLN) \
	&& mv objs/nginx objs/nginx-debug \
	# && mv objs/ngx_http_xslt_filter_module.so objs/ngx_http_xslt_filter_module-debug.so \
	# && mv objs/ngx_http_image_filter_module.so objs/ngx_http_image_filter_module-debug.so \
	# && mv objs/ngx_http_geoip_module.so objs/ngx_http_geoip_module-debug.so \
	# && mv objs/ngx_stream_geoip_module.so objs/ngx_stream_geoip_module-debug.so \
	&& ./configure $CONFIG \
	    # Let's incl debug symbols in prod builds too (but not -O0).  [NGXCORED]
	    --with-cc-opt='-ggdb' \
	&& make -j$(getconf _NPROCESSORS_ONLN) \
	&& make install \
	&& rm -rf /etc/nginx/html/ \
	# Skip creating & copying to /etc/nginx/conf.d/ and /usr/share/nginx/html/.
	# && mkdir /etc/nginx/conf.d/ \
	# && mkdir -p /usr/share/nginx/html/ \
	# && install -m644 html/index.html /usr/share/nginx/html/ \
	# && install -m644 html/50x.html /usr/share/nginx/html/ \
	# apparently this stuff is installed by default, but we don't use it.
	&& rm -f /etc/nginx/fastcgi* \
             /etc/nginx/koi-* \
             /etc/nginx/scgi_params* \
             /etc/nginx/uwsgi_params* \
             /etc/nginx/win-utf \
	&& mkdir /etc/nginx/sites-available \
	         /etc/nginx/sites-enabled \
	&& install -m755 objs/nginx-debug /usr/sbin/nginx-debug \
	# && install -m755 objs/ngx_http_xslt_filter_module-debug.so /usr/lib/nginx/modules/ngx_http_xslt_filter_module-debug.so \
	# && install -m755 objs/ngx_http_image_filter_module-debug.so /usr/lib/nginx/modules/ngx_http_image_filter_module-debug.so \
	# && install -m755 objs/ngx_http_geoip_module-debug.so /usr/lib/nginx/modules/ngx_http_geoip_module-debug.so \
	# && install -m755 objs/ngx_stream_geoip_module-debug.so /usr/lib/nginx/modules/ngx_stream_geoip_module-debug.so \
	# && ln -s ../../usr/lib/nginx/modules /etc/nginx/modules \
	\
	# Don't, then wouldn't be able to backtrace core dumps.  [NGXCORED]
	#&& strip /usr/sbin/nginx* \
	\
	# All modules above commented out. And want to keep debug symbols, anyway.
	# && strip /usr/lib/nginx/modules/*.so \
	&& rm -rf /usr/src/nginx-$NGINX_VERSION \
	\
	# Bring in gettext so we can get `envsubst`, then throw
	# the rest away. To do this, we need to install `gettext`
	# then move `envsubst` out of the way so `gettext` can
	# be deleted completely, then move `envsubst` back.
	&& apk add --no-cache --virtual .gettext gettext \
	&& mv /usr/bin/envsubst /tmp/ \
	\
	&& runDeps="$( \
		scanelf --needed --nobanner --format '%n#p' /usr/sbin/nginx /usr/lib/nginx/modules/*.so /tmp/envsubst \
			| tr ',' '\n' \
			| sort -u \
			| awk 'system("[ -e /usr/local/lib/" $1 " ]") == 0 { next } { print "so:" $1 }' \
	)" \
	&& apk add --no-cache --virtual .nginx-rundeps $runDeps \
	&& apk del .build-deps \
	&& apk del .gettext \
	&& mv /tmp/envsubst /usr/local/bin/ \
	\
	# Bring in tzdata so users could set the timezones through the environment
	# variables
	&& apk add --no-cache tzdata \
	\
	# forward request and error logs to docker log collector
	&& ln -sf /dev/stdout /var/log/nginx/access.log \
	&& ln -sf /dev/stderr /var/log/nginx/error.log


RUN rm -fr /tmp/nginx-modules/


COPY lua-packages /opt/lua-packages/


# Add 'bash' so we can 'docker exec' into the container, + some tools. (wget & less already works)
# And gdb, for backtracing core dumps. [NGXCORED]
RUN apk add --no-cache bash tree curl net-tools gdb \
  # Telnet, nice for troubleshooting.
  busybox-extras

# Remove default files, they're very confusing, if logging in to Nginx and looking at /etc/nginx/:
RUN rm -fr \
  # Keep mime.types though.
  mime.types.default \
  nginx.conf \
  nginx.conf.default


COPY ssl-cert-snakeoil.key /etc/nginx/
COPY ssl-cert-snakeoil.pem /etc/nginx/

COPY html                 /opt/nginx/html/

# For development. Another directory gets mounted in prod, see <talkyard-prod-one>/docker-compose.yml.
COPY sites-enabled-manual /etc/nginx/sites-enabled-manual/

# old, remove once I've edited edm & edc
COPY server-listen.conf   /etc/nginx/listen.conf

# old, remove, doesn't specify backlog sice — and may do only once, so rather useless.
COPY server-listen.conf   /etc/nginx/

# old, remove once I've edited edm & edc
COPY server-ssl.conf      /etc/nginx/ssl-hardening.conf

COPY server-ssl.conf      /etc/nginx/
COPY http-limits.conf     /etc/nginx/http-limits.conf.template

# old, remove, now done in  <talkyard-prod-one>/conf/sites-enabled-manual/talkyard-servers.conf  instead.
COPY http-redirect-to-https.conf /etc/nginx/

COPY server-limits.conf   /etc/nginx/server-limits.conf.template

# old, remove once I've edited edm & edc
COPY server-locations.conf /etc/nginx/vhost.conf.template

# old, too, remove, when?
COPY server-locations.conf /etc/nginx/server.conf.template

COPY server-locations.conf /etc/nginx/server-locations.conf.template
COPY nginx.conf           /etc/nginx/nginx.conf.template

COPY run-envsubst.sh  /etc/nginx/run-envsubst.sh
RUN  chmod ugo+x      /etc/nginx/run-envsubst.sh
# Sync this with the variable list in run-envsubst.sh: [0KW2UY3]  CLEANUP change prefix to TY_
# Currently, each tab has its own websocket/long-polling connection — and if 40 connections per ip,
# I sometimes happen to open really many tabs, and requests start failing. Set to >= 60, for now.
# Later, just one single live-update connection per browser [onesocket].
#
# Set the default allowed request body size to something fairly large — 25m (megabytes)
# — so self hosted people can upload Mac Retina screenshots (they're maybe 10 MB) and
# small videos, without having to ask for help at Talkyard.io.
ENV \
    ED_NGX_LIMIT_CONN_PER_IP=60 \
    ED_NGX_LIMIT_CONN_PER_SERVER=10000 \
    ED_NGX_LIMIT_REQ_PER_IP=30 \
    ED_NGX_LIMIT_REQ_PER_IP_BURST=200 \
    ED_NGX_LIMIT_REQ_PER_SERVER=200 \
    ED_NGX_LIMIT_REQ_PER_SERVER_BURST=2000 \
    TY_NGX_LIMIT_REQ_BODY_SIZE=25m \
    ED_NGX_LIMIT_RATE=50k \
    ED_NGX_LIMIT_RATE_AFTER=5m \
    # Wait with setting this to a year (31536000), until things more tested.
		# ('s-maxage = ...' and 'public' are for shared proxies and CDNs)
    TY_MAX_AGE_YEAR="max-age=2592000, s-maxage=2592000, public" \
    TY_MAX_AGE_MONTH="max-age=2592000, s-maxage=2592000, public" \
    TY_MAX_AGE_WEEK="max-age=604800, s-maxage=604800, public" \
    TY_MAX_AGE_DAY="max-age=86400, s-maxage=86400, public"

# Frequently edited, so do last.
COPY ty-media /opt/talkyard/ty-media
COPY ed-lua   /opt/talkyard/lua/
COPY assets   /opt/talkyard/assets


# Don't expose port 81 (the publish-websocket-messages port) — it should be accessible from
# inside the Docker network only, so that only Play Framework (located inside the network)
# can publish events.
EXPOSE 80 443

# Core dumps
# Works without:  chown root:root /tmp/cores  &&  ulimit -c unlimited
# Place this:  kill(getpid(), SIGSEGV);   (from: https://stackoverflow.com/a/1657244/694469 )
# to crash and generate a core dump at some specific location.
# (This also core dumps, but cannot backtrace the dump: `raise(SIGABRT)`)
# Inspect e.g. like so:  # gdb /usr/sbin/nginx-debug /tmp/cores/core.nginx-debug.17
# then type `bt` or `bt f` (backtrace full).
#
# Make the container privileged, in docker-compose.yml for this to work. [NGXCORED] [NGXSEGFBUG]
#CMD chmod 1777 /tmp/cores \
#  && sysctl -w fs.suid_dumpable=2 \
#  && sysctl -p \
#  && echo "/tmp/cores/core.%e.%p" > /proc/sys/kernel/core_pattern \
#  && /etc/nginx/run-envsubst.sh \
#  && nginx-debug

CMD /etc/nginx/run-envsubst.sh && nginx
