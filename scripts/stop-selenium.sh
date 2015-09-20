#!/bin/bash

selenium_pid=`ps aux | grep 'java -jar downloads/selenium-server-standalone.jar' | grep -v grep | awk '{print $2}'`
if [ -n "$selenium_pid" ]; then
  echo "Selenium is running, process id $selenium_pid, stopping it..."
  kill $selenium_pid
fi

