Building your own images
=============================

Do this: (`make` is GNU Make)

```
vi version.txt    # type a new vesion number
vi .env           # change DOCKER_REPOSITORY to your own repository
make prod-images  # this runs tests and builds production images
make tag-and-push-latest-images tag=...  # pushes images to your repo
```

You can type `make` to see help about the Makefile targets.

All this has been tested in Ubuntu and Mint Linux only, with Bash. If you're
on Windows, probably you'll need [Cygwin](https://www.cygwin.com)
or [MinGW](http://www.mingw.org)
— but, now year 2022: maybe Linux Subsystem for Windows instead?

<!--
To use the images in your own Docker-Compose installation,
have a look here: https://github.com/debiki/talkyard-prod-swarm
— No, Swarm is becoming abandonware? -->



About the images
-----------------------------

You'll find **Docker image** build files in: <code>./images/<i>image-name</i>/</code>.

Here you can read about the various images in the Talkyard stack:
[about-the-talkyard-images.md](./about-the-talkyard-images.md).



Troubleshooting
-----------------------------

See [tips.md](./tips.md).


vim: list et ts=2 sw=2 tw=0 fo=r
