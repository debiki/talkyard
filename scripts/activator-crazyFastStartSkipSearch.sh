#!/bin/bash

# Starts the server quickly, without starting ElasticSearch (which takes
# some time).

./activator  -jvm-debug 9999  -DcrazyFastStartSkipSearch=true

