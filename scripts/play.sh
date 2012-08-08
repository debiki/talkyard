#!/bin/bash

# Have Brunch (a NodeJS project) compile and bundle scripts and styles
# from client/ to Play's public/ dir.
brunch watch -c conf/nodejs-brunch-config.ls &

/mnt/data/dev/play/github/play $@

