#!/bin/bash

# Starts the server quickly, without starting ElasticSearch (which takes
# some time).

./play debug -DcrazyFastStartSkipSearch=true

