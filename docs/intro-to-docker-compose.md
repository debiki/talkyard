
A brief intro to Docker-Compose
==========================================

You probably need to know how to use the Linux or Mac terminal, and know what
a virtual machine is. Otherwise I'm afraid nothing here will make much sense to you.

Ok, let's start. A container is like a virtual machine running on your computer. Reminds of VMWare
and VirtualBox. However there's no desktop environment, only a Linux terminal prompt. So you
cannot click and point with the mouse.

When you do stuff with Docker, you don't use Linux/Mac commands like `ps aux` and
`kill -9` and `sysctl ...` or `service whatever restart`.

Instead you use Docker-Compose:

    sudo docker-compose ps  # list all running containers. Instead of `ps aux | grep ...`

    sudo docker-compose stop CONTAINER_NAME  # stops that container in a friendly way
    sudo docker-compose kill CONTAINER_NAME  # ... in an unfriendly way. Instead of kill -9

    sudo docker-compose start CONTAINER_NAME  # there's also 'restart'

    # If the container is running already, you can usually login to it, like so:
    sudo docker-compose exec CONTAINER_NAME bash

Note:

- You don't need to install anything on your computer — except for Docker Engine and Docker-Compose.
  Everything will run in Docker containers: PostgreSQL, Nginx, Play Framework, Node.js & gulp.

- However, to run end-to-end tests, you currently need to run Webdriver.io directly on your
  computer — so it'll be able to open real browser windows for the end-to-end tests.
  (More about this in the [end-to-end-tests readme](e2e-tests-readme.md).)

- In addition to `sudo docker-compose ...` there's also `sudo docker ...` but that's
  more low-level.


Crazy containers
-----------------

Sometimes the containers become crazy. For example, if the 'app' container fails to connect
to the 'rdb' (PostgreSQL) container really many times and creates lots of broken connections,
then 'rdb' will stop being cooperative.

Or if you restart the 'app' container but not the 'web' container — then 'web' will no longer
know how to find 'app'.

If they become, or just seem, crazy, you can dispose them:

    sudo docker-compose down  # delete them all
    sudo docker-compose up    # recreates and starts all containers, in a not-crazy state

After this, everything will hopefully be okay again.


Rebuilding images
-----------------

If you make changes to a Dockerfile or a docker-entrypoint.sh, then you need to _rebuild_
the 'image' for that docker container. (The 'image' is the thing that has all code the
container will run.)

    sudo docker-compose stop CONTAINER_NAME
    sudo docker-compose rm CONTAINER_NAME
    sudo docker-compose build CONTAINER_NAME   # <—— look: "build"
    sudo docker-compose up -d CONTAINER_NAME

Example: Rebuilding the 'web' container (it runs Nginx):

    sudo docker-compose stop web
    sudo docker-compose rm web
    sudo docker-compose build web
    sudo docker-compose up -d web


Where're the database files?
-----------------

There's a database container, 'rdb', but what happens if you delete it? (`docker-compose rm rdb`)
Is all database contents gone then?

It won't disappear — because all database files are kept in `./docker/data/rdb/`. That
directory is mounted inside the rdb container. And if that container is deleted, the directory +
files still exist. You can start a new 'rdb' cointainer, and it'll have the same database
contents as the one you deleted.

To really totally whipe out the database, you can:

    sudo docker-compose stop CONTAINER_NAME
    sudo docker-compose rm CONTAINER_NAME
    sudo rm -fr docker/data/rdb
    sudo docker-compose up -d CONTAINER_NAME  # this last step creates an empty database

There're more directories in docker/data/, and inside `docker-compose.yml` the
"volumes: ..." sections tell Docker which directories should be mounted in which containers.

Please note that all this is for the development environment. The production environment
is (or might be) different.


Viewing logs
-----------------

Here's how to view logs:

    sudo docker-compose logs -f          # tails all logs, except for PostgreSQL
    sudo docker-compose logs -f app      # tails only the 'app' container's logs
    sudo ls -hlt docker/data/rdb-logs/   # lists PostgreSQL logs

