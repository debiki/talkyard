#!/bin/bash

BASE_DIR=`dirname $0`
PORT=9877

echo "Starting JsTestDriver Server (http://code.google.com/p/js-test-driver/)"
echo "Please open the following url and capture one or more browsers:"
echo "http://localhost:$PORT"

java -jar "$BASE_DIR/../test-client/lib/jstestdriver/JsTestDriver.jar" \
     --port $PORT \
     --browserTimeout 20000 \
     --config "$BASE_DIR/../conf-client/jsTestDriver-scenario.conf" \
     --basePath "$BASE_DIR/.."
