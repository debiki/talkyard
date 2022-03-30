#!/bin/sh
set -e

# So the deno user can cache Typescript files.
chmod -R ugo+rw /deno-dir

# Copied from: https://github.com/denoland/deno_docker/blob/main/_entry.sh
# License: MIT, see ./LICENSE.

#
#if [ "$1" != "${1#-}" ]; then
#    # if the first argument is an option like `--help` or `-h`
#    exec deno "$@"
#fi
#
#case "$1" in
#    bench | bundle | cache | compile | completions | coverage | doc | eval | fmt | help | info | install | lint | lsp | repl | run | task | test | types | uninstall | upgrade | vendor )
#    # if the first argument is a known deno command
#    exec deno "$@";;
#esac


# Hmm, runs as root anyway:  [deno_user]
#exec su -c "deno cache deps.ts" deno
exec su -c "deno cache main.ts" deno

exec su -c "$@" deno