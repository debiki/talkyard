#!/bin/bash

unzip dist/debiki-app-play-1.0-SNAPSHOT.zip -d dist/ ; chmod u+x dist/debiki-app-play-1.0-SNAPSHOT/start ; dist/debiki-app-play-1.0-SNAPSHOT/start   -Dlogger.application=TRACE   -Dhttp.port=9000   -Xdebug -Xrunjdwp:transport=dt_socket,address=9999,server=y,suspend=n
