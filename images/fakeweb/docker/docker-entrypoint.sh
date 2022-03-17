#!/bin/sh
set -e

# Copied from: https://github.com/denoland/deno_docker/blob/main/_entry.sh
# License: MIT, see ./LICENSE.

if [ "$1" != "${1#-}" ]; then
    # if the first argument is an option like `--help` or `-h`
    exec deno "$@"
fi

case "$1" in
    bench | bundle | cache | compile | completions | coverage | doc | eval | fmt | help | info | install | lint | lsp | repl | run | task | test | types | uninstall | upgrade | vendor )
    # if the first argument is a known deno command
    exec deno "$@";;
esac

#deno cache deps.ts
deno cache main.ts

exec "$@"