FROM denoland/deno:1.20.1

# Nice to haves:
RUN \
  apt-get update && \
  apt-get install -y \
      tree \
      curl \
      net-tools \
      # Oddly enough, 'ps' not installed:
      procps


# Copied from:  https://github.com/denoland/deno_docker#as-a-dockerfile
# License: MIT, see ./LICENSE.

# The port that your application listens to.
EXPOSE 8090

WORKDIR /app

# Prefer not to run as root.
#USER deno
# — fixing via entrypoint instead. But let's start as root, so can give
# write access to /deno-dir, so deno can cache stuff.
# But `exec su -c .... duno` runs as root anyway, why?  See [deno_user]
# in ./docker-entrypoint.sh .
# Good work-around / solution: Vendor deps, mount read-only. Problem gone,
# & more reproducible builds etc.  [vendor_fakeweb_deno_deps]

# Ty does this in docker-entrypoint.sh instead — so it'll be enough to just
# recreate the container, to pick up any changes. Rather than having to
# rebuild the image:
# ------
## Cache the dependencies as a layer (the following two steps are re-run only when deps.ts is modified).
## Ideally cache deps.ts will download and compile _all_ external files used in main.ts.
#COPY deps.ts .
#RUN deno cache deps.ts
#
## These steps will be re-run upon each file change in your working directory:
#ADD . .
## Compile the main app so that it doesn't need to be compiled each startup/entry.
#RUN deno cache main.ts
# ------


COPY docker-entrypoint.sh .
ENTRYPOINT ["/tini", "--", "docker-entrypoint.sh"]

CMD ["run", "--allow-net", "main.ts"]
