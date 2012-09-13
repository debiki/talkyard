#!/bin/bash

# I've not yet translated all files from CoffeeScript to LiveScript.
# Compile CoffeeScript.
coffee -c test

# Have Brunch (a NodeJS project) compile and bundle scripts and styles
# from client/ to Play's public/ dir.
brunch build --minify -c conf-client/nodejs-brunch-config-prod.ls

