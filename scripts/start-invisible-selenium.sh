#!/bin/bash

xvfb-run -s '-screen 0 1280x1024x8' node_modules/selenium-standalone/bin/selenium-standalone start

