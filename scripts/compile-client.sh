#!/bin/bash

# I've not yet translated all files from CoffeeScript to LiveScript.
# Compile CoffeeScript.
coffee -cw test-client &

# Have Brunch (a NodeJS project) compile and bundle scripts and styles
# from client/ to Play's public/ dir.
brunch watch -c conf-client/nodejs-brunch-config.ls

