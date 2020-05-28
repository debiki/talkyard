#!/bin/sh

# Create a LetsEncrypt account key, so LetsEncrypt won't think this is a
# new and different server all the time from the same IP — because that'd
# make LetsEncryt rate limit it more.
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:4096 \
    -out /etc/openresty/letsencrypt-account.key

# Create a cert and key to use, before LetsEncrypt is done generating
# a real cert.
openssl req -newkey rsa:2048 -nodes -keyout /etc/openresty/default-cert.key \
    -x509 -days 365 -out /etc/openresty/default-cert.pem
