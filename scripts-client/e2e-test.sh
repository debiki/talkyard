#!/bin/bash

BASE_DIR=`dirname $0`

java -jar "$BASE_DIR/../test-client/lib/jstestdriver/JsTestDriver.jar" \
     --config "$BASE_DIR/../conf-client/jsTestDriver-scenario.conf" \
     --basePath "$BASE_DIR/.." \
     --tests all --reset
