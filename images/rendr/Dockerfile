# In the future, this container will render React server side.
# Currently, that's done in the JVM using the Nashorn script engine,
# but Nashorn was removed in Java 17 (we use Java 11 for now).

# See Git branch:  p/m/deno/9
# in that branch, search for e.g.:  'serverReqHandler', 'rendersv.deno.ts'
# to find the more interesting stuff.

# See: https://hub.docker.com/_/debian/tags?name=13
FROM debian:13.3-slim

# Exit on `docker compose stop` = SIGTERM, then sleep and wait
# for an infinity or SIGTERM, whichever comes first.
#
CMD ["sh", "-c", "trap 'exit 0' TERM; sleep infinity & wait"]

