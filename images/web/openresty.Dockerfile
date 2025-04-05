# See: https://openresty.org/en/installation.html
# Also see:
# https://github.com/openresty/docker-openresty/blob/master/alpine/Dockerfile
# saved in ./docs/
# And a Debian 10 apt-get based Dockerfile (that works/worked with Ty)
# here: ./old/Dockerfile.buster-apt-get-old

# COULD_OPTIMIZE smaller image: Copy just what's needed from openresty_build
# (and would need to 'apk add' some things too, to the final image).

FROM alpine:3.21.3 AS openresty_build


# '--virtual .build_deps' lets one uninstall all these build dependencies,
# like so:  'apk del .build_deps' (done later in this file)
#
RUN apk add --no-cache --virtual .build_deps \
        build-base \
        coreutils \
        # Library for the dynamic creation of images by programmers
        # Needed for http_image_filter_module?
        #gd-dev \
        # Looks up countries by IP addresses.
        # See: 	http://www.maxmind.com/app/ip-location
        geoip-dev \
        linux-headers \
        make \
        perl-dev \
        readline-dev \
        openssl3-dev \
        pcre2-dev \
        zlib-dev \
        # Installs /usr/bin/envsubst
        gettext

# These we want in the final image.
#
RUN apk add --no-cache \
        curl \
        #gd \
        geoip \
        libgcc \
        #libxslt \
        # OpenSSL needed for generating LetsEncrypt private key.
        openssl \
        # opm (OpenResty package manager) uses Perl.
        perl \
        tzdata \
        zlib \
        #
        # Add 'bash' so we can 'docker exec' into the container, + some tools
        # (wget & less already works).  And gdb, for backtracing core dumps. [NGXCORED]
        bash tree net-tools gdb \
        # Telnet, nice for troubleshooting.
        busybox-extras


COPY openresty/source /tmp/openresty-source


# OpenResty's default --prefix is: '/usr/local/openresty'.

ARG CONFIG="\
  --conf-path=/etc/nginx/nginx.conf \
  \
  --sbin-path=/usr/sbin/nginx \
  --modules-path=/usr/lib/nginx/modules \
  \
  --error-log-path=/var/log/nginx/error.log \
  --http-log-path=/var/log/nginx/access.log \
  \
  --pid-path=/var/run/nginx.pid \
  --lock-path=/var/run/nginx.lock \
  \
  --http-client-body-temp-path=/var/cache/nginx/client_temp \
  --http-proxy-temp-path=/var/cache/nginx/proxy_temp \
  # Not using these:
  #--http-fastcgi-temp-path=/var/cache/nginx/fastcgi_temp \
  #--http-uwsgi-temp-path=/var/cache/nginx/uwsgi_temp \
  #--http-scgi-temp-path=/var/cache/nginx/scgi_temp \
  \
  --user=nginx \
  --group=nginx \
  \
  \
  # Enable modules:
  #
  # Modules list:
  # https://docs.nginx.com/nginx/admin-guide/installing-nginx/installing-nginx-open-source/#modules_default
  #
  # Modules source code:
  # https://trac.nginx.org/nginx/browser/nginx/src/http/modules/
  \
  # --with-http_addition_module \
  --with-http_auth_request_module \
  # --with-http_dav_module \
  # --with-http_geoip_module=dynamic \
  # --with-http_gunzip_module \
  --with-http_gzip_static_module \
  # --with-http_image_filter_module=dynamic \
  --with-http_mp4_module \
  # --with-http_random_index_module \
  --with-http_realip_module \
  # Can check authenticity of requested links, access control, limit link lifetime.
  # --with-http_secure_link_module \
  # --with-http_slice_module \
  --with-http_ssl_module \
  # Basic Nginx status info.
  --with-http_stub_status_module \
  # --with-http_sub_module \
  \
  # HTTP2 doesn't work with Lua scripts that call ngx.location.capture/_multi(..),
  # there'd be runtime errors. See [63DRN3M75] in ./old/.
  # Or maybe works now with OpenResty?
  --with-http_v2_module \
  \
  # Let's wait? DO_AFTER 2024-07-01:  or in [ty_v1]
  # --with-http_v3_module \
  \
  # --with-ipv6 \
  # --with-mail \
  # --with-mail_ssl_module \
  \
  \
  # JIT compilation of regular expressions.
  #
  # Apparently the jit flag gets auto enabled, in this file:
  # ./openresty/source/bundle/nginx-1.19.3/auto/lib/pcre/conf
  # — 'nginx -V' showed it, although at the time not incl here.
  # And:
  # > even if you don't pass [ --with-pcre-jit ], the NGINX
  # > configure scripts are smart enough to detect and enable it automatically
  # https://github.com/openresty/openresty/issues/62#issuecomment-514360656
  # But explicit is better, so we enable the flag below.
  #
  # For how to download from ftp.pcre.org and build a specific version,
  # see: ./docs/Dockerfile.openresty-alpine-official
  # Currently, 2020-12, `apk info pcre-dev` shows that pcre-dev-8.44-r0
  # is being used.
  --with-pcre-jit \
  \
  # Apparently this is a pcre build flag, not an Nginx flag: --enable-jit
  \
  # Apparently only needed if building pcre from sources:
  # --with-pcre(=/path/to/pcre/lib)
  # (but we instead do:  apk add pcre-dev)
  \
  \
  # Enables TCP and UDP proxy functionality.
  --with-stream \
  --with-stream_ssl_module \
  # preread = For SNI I think.
  # --with-stream_ssl_preread_module \
  # --with-stream_realip_module \
  # --with-stream_geoip_module=dynamic \
  \
  # asynchronous file I/O (AIO) on FreeBSD and Linux
  # --with-file-aio   — deprecated, as of Resty 1.27
  \
  # Thread pools.
  --with-threads \
  \
  \
  # Disable modules: (Nginx and Lua)
  \
  # Disabled by https://github.com/openresty/docker-openresty/blob/master/alpine/Dockerfile:
  --without-http_rds_json_module \
  --without-http_rds_csv_module \
  --without-lua_rds_parser \
  --without-mail_pop3_module \
  --without-mail_imap_module \
  --without-mail_smtp_module \
  \
  # Is needed for 'charset utf-8;', see nginx.conf.
  #--without-http_charset_module \
  \
  # No auto index. If ever enabling, add 'autoindex off' here: [5KUP293]
  --without-http_autoindex_module \
  \
  # No server-side-includes.
  --without-http_ssi_module \
  \
  # No FastCGI or CGI.
  --without-http_fastcgi_module \
  --without-http_scgi_module \
  \
  # No Python (instead, the JVM and http_proxy_module).
  # 'WSGI' means Web Server Gateway Interface, and is a calling
  # convention for forwarding requests to an app server named 'uwsgi'
  # for Python apps?
  --without-http_uwsgi_module \
  \
  # No Memcached (instead, Redis).
  --without-http_memcached_module \
  --without-lua_resty_memcached \
  \
  # No Mysql (instead, Postgres).
  --without-lua_resty_mysql \
  "

RUN \
  addgroup -S nginx \
  && adduser -D -S -h /var/cache/nginx -s /sbin/nologin -G nginx nginx \
  \
  && cd /tmp/openresty-source \
  \
  # Debug build.
  # See: ./old/Dockerfile.nginx-old
  #&& ./configure $CONFIG \
  #    # Enables debug log messages: (otherwise they won't get logged at all, never?)
  #    --with-debug \
  #    # So can backtrace core dumps: [NGXCORED]
  #    --with-cc-opt='-O0 -ggdb3 -fvar-tracking-assignments' \
  #&& make -j$(getconf _NPROCESSORS_ONLN) \
  # But is this the correct path, now with OpenResty?
  # && mv objs/nginx objs/nginx-debug \
  # && mv objs/ngx_http_image_filter_module.so objs/ngx_http_image_filter_module-debug.so \
  # && mv objs/ngx_http_geoip_module.so objs/ngx_http_geoip_module-debug.so \
  \
  # Prod build.
  && ./configure $CONFIG \
        # Incl debug symbols in prod builds (but not -O0).  [NGXCORED]
        --with-cc-opt='-ggdb' \
  && make -j$(getconf _NPROCESSORS_ONLN) \
  && make install \
  \
  # apparently this stuff is installed by default, but we don't use it
  # — although the FastCGI etc modules were excluded.
  && rm -f /etc/nginx/fastcgi* \
           /etc/nginx/koi-* \
           /etc/nginx/scgi_params* \
           /etc/nginx/uwsgi_params* \
           /etc/nginx/win-utf \
  \
  && mkdir /etc/nginx/sites-available \
           /etc/nginx/sites-enabled \
  # && install -m755 objs/nginx-debug /usr/sbin/nginx-debug \
  # && install -m755 objs/ngx_http_image_filter_module-debug.so /usr/lib/nginx/modules/ngx_http_image_filter_module-debug.so \
  # && install -m755 objs/ngx_http_geoip_module-debug.so /usr/lib/nginx/modules/ngx_http_geoip_module-debug.so \
  # && install -m755 objs/ngx_stream_geoip_module-debug.so /usr/lib/nginx/modules/ngx_stream_geoip_module-debug.so \
  # && ln -s ../../usr/lib/nginx/modules /etc/nginx/modules \
  \
  # Don't, then wouldn't be able to backtrace core dumps.  [NGXCORED]
  #&& strip /usr/sbin/nginx* \
  \
  # All modules above commented out. And want to keep debug symbols, anyway.
  # Copy, so won't get deleted when cleaning up build_deps.
  # (Was installed via package gettext.)
  && mv /usr/bin/envsubst /tmp/ \
  \
  # Runtime dependencies
  && runDeps="$( \
    scanelf --needed --nobanner --format '%n#p' \
            /usr/sbin/nginx \
            /usr/lib/nginx/modules/*.so \
            /tmp/envsubst \
      | tr ',' '\n' \
      | sort -u \
      | awk 'system("[ -e /usr/local/lib/" $1 " ]") == 0 { next } { print "so:" $1 }' \
  )" \
  && apk add --no-cache --virtual .nginx_rundeps $runDeps \
  \
  && apk del .build_deps \
  \
  # Move back
  && mv /tmp/envsubst /usr/local/bin/ \
  \
  # Or not needed? .pid and .lock directly in /var/run/.
  && mkdir -p /var/run/openresty \
  \
  # Bring in tzdata so users could set the timezones through the environment
  # variables
  && apk add --no-cache tzdata \
  \
  # Forward request and error logs to docker log collector.
  # Typically something is Docker-mounted at /var/log/(nginx/), but if not,
  # maybe better create that directory:
  && mkdir -p /var/log/nginx \
  && ln -sf /dev/stdout /var/log/nginx/access.log \
  && ln -sf /dev/stderr /var/log/nginx/error.log \
  && echo



# Add additional binaries into PATH: luajit, openresty resty, opm
#
ENV PATH=$PATH:/usr/local/openresty/luajit/bin:/usr/local/openresty/bin

# But, empty: /usr/local/openresty/nginx/sbin/  (nginx in /usr/sbin/ instead)



# Fonts
# ===================================
#
# Barely ever changes. (Is about 1.6 M and takes some seconds to copy,
# so nice to copy before other smaller things further below.)
#
# (Can generate a list of font files to copy like so:
#   cd images/web/  # this dir
#   ls -1 node_modules/fontsource-open-sans/files/open-sans-????*-{300,400,600}*.woff*
# Is there no way to change the dir in the host file system?)

# Copy .css font bundle(s).
COPY fonts /opt/talkyard/fonts

# Copy .woff and woff2.
# This shell like expansion won't work:  ...{300,400,600}...
# Instead:
COPY \
    # This: '????*' excludes the "-all-" bundles (all real language names
    # are >= 4 letters but "all" is just 3).
    # Sync font sizes with gulpfile.js css file list. [sync_fonts]
    node_modules/fontsource-open-sans/files/open-sans-????*-300-*.woff* \
    node_modules/fontsource-open-sans/files/open-sans-????*-400-*.woff* \
    node_modules/fontsource-open-sans/files/open-sans-????*-600-*.woff* \
    # Sync 'open-sans-vN' with Makefile and gulpfile.js. [sync_fonts]
    /opt/talkyard/fonts/open-sans-v2/files/



# Install Lua packages
# ===================================


# Auto HTTPS
# ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

# Could use opm, Openresty Package Manager:
#   RUN opm install fffonion/lua-resty-acme
# I did that, and then copied the files that then got installed (I found out which,
# by running  tree  before and after, and then  diffing) to:
# ./openresty-pkgs/usr-local-openresty-site — and now we can just COPY them to inside
# the image, no need to run 'opm install ...' or do any outgoing netw requests.
# However, can do that anyway from time to time, to upgrade lua-resty-acme and
# dependencies.

# (Or can use --cwd:  (but why? 'opm install ...' is equally simple, isn't it)
# `while read dep; do opm --cwd get "$dep"; done < requirements.opm`
# https://github.com/un-def/tinystash#lua-packages )

COPY openresty-pkgs/usr-local-openresty-site  /usr/local/openresty/site

# (Maybe need to use a specific OpenSSL version?
# > OpenResty's OpenSSL library version must be compatible with your
# > opm and LuaRocks packages' version.
# https://github.com/openresty/docker-openresty#tips--pitfalls
# But apparently we use an ok version already?
#   $ d/c exec web bash
#   # apk update
#   # apk info openssl-dev
#   ...
#   openssl-dev-1.1.1i-r0 webpage:
#   https://www.openssl.org/
#   openssl-dev-1.1.1i-r0 installed size:
#   1634304
#
# 1.1.1i is the latest version as of 2020-12, https://www.openssl.org:
# > 08-Dec-2020
# > OpenSSL 1.1.1i is now available
#
# The Alpine build file here:  https://github.com/openresty/docker-openresty
# patches to 1.1.1f, and between f and i, you can see here:
# https://www.openssl.org/news/openssl-1.1.1-notes.html  that there's just
# small fixes / changes, looks backw compat. )


# Other Lua pkgs
# ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

# If trying to ./copy/a/directory, Docker instead copies its contents,
# that is:  ./copy/a/directory/*,  so to copy many directories, need to COPY
# them one at a time:
COPY lua-packages/lua-resty-http  /opt/lua-packages/lua-resty-http
COPY lua-packages/inspect.lua     /opt/lua-packages/inspect.lua




# Nginx config
# ===================================


# Remove default files, they're very confusing, if logging in to Nginx
# and looking in /etc/nginx/:
RUN cd /etc/nginx && \
  rm -fr \
      # Keep mime.types though.
      # (Our actual Nginx config will be in nginx.conf.template, which we
      # process with envsubst at startup, and save as nginx.conf.)
      mime.types.default \
      nginx.conf \
      nginx.conf.default \
      \
   # Nice:
   && echo 'alias ll="ls -l"' >> ~/.bashrc \
   && echo 'alias ..="cd .."' >> ~/.bashrc \
   && echo 'alias ...="cd ../.."' >> ~/.bashrc \
   && echo 'alias ....="cd ../../.."' >> ~/.bashrc \
   && echo 'alias .....="cd ../../../.."' >> ~/.bashrc \
   && echo



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

# old, remove, now done in  <talkyard-prod-one>/conf/sites-enabled-manual/talkyard-servers.conf  instead. [ty_v1]
COPY http-redirect-to-https.conf /etc/nginx/

COPY server-limits.conf   /etc/nginx/server-limits.conf.template

# old, remove once I've edited edm & edc   [vy_v1] + search for "old" everywhere here
COPY server-locations.conf /etc/nginx/vhost.conf.template

# old, too, remove, when?
COPY server-locations.conf /etc/nginx/server.conf.template

COPY server-locations.conf /etc/nginx/server-locations.conf.template
COPY nginx.conf           /etc/nginx/nginx.conf.template



# Env vars
# ===================================


COPY run-envsubst-gen-keys.sh /etc/nginx/run-envsubst-gen-keys.sh
RUN  chmod ugo+x              /etc/nginx/run-envsubst-gen-keys.sh

# Sync w vars in  run-envsubst-gen-keys.sh  and  docker-compose-no-limits.yml  [0KW2UY3].
# CLEAN_UP change prefix to TY_  [ty_v1]
#
# ED_NGX_LIMIT_CONN_PER_IP=60 is a lot? But maybe some people connect from
# an office building, same IP addr?
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
    TY_MAX_AGE_DAY="max-age=86400, s-maxage=86400, public" \
    TY_MAX_AGE_HOUR="max-age=3600, s-maxage=3600, public" \
    TY_MAX_AGE_15MIN="max-age=900, s-maxage=900, public"



# Scripts and styles
# ===================================
#
# Frequently edited, so do last.

COPY ty-media /opt/talkyard/ty-media
COPY ty-lua   /opt/talkyard/lua/
COPY assets   /opt/talkyard/assets



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
#  && /etc/nginx/run-envsubst-gen-keys.sh \
#  && nginx-debug


CMD /etc/nginx/run-envsubst-gen-keys.sh && nginx


# Tell Docker to send SIGQUIT instead of default SIGTERM, when stopping this container
# gracefully — then Nginx will drain requests, instead of terminating all immediately.
# See https://github.com/openresty/docker-openresty/blob/master/README.md#tips--pitfalls
#
# But let's wait — what if there's some long running request that makes Nginx then take
# long to restart?  It can be enough to upgrade to OpenResty 1.25 for now.
# DO_AFTER 2024-07-01 try enabling this.
# STOPSIGNAL SIGQUIT

