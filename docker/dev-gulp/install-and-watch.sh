#!/bin/bash

if [ ! -f /opt/has-installed ] ; then
  npm install
  bower install
fi

touch /opt/has-installed

gulp watch

