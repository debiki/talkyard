FROM debian:bullseye-slim@sha256:df172d92d287ec4d4a538e5db8026fcde5f91f5f90061423d69d6148ff05cc47

RUN set -eux  ;\
    apt-get update  ;\
    apt-get install -y --no-install-recommends  \
        # Nice to have:
        curl  \
        tree less net-tools bash  \
        # For 'ps':
        procps  \
        # Telnet, nice for troubleshooting SMTP problems for example.
        telnet  \
        ;\
    rm -rf /var/lib/apt/lists/*  ;

COPY  ./maint-server  ./maint-msg.html   /

EXPOSE 8080

CMD ["/maint-server"]
