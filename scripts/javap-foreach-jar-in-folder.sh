#!/bin/bash

# Searches each JAR in the current folder for the specified class.
# Example usage:
# (Which helped me understand why the JVM thinks there's no
# controllers.ReverseAssets.at(directory, file) function)
#
#   dist/debiki-app-play-1.0-SNAPSHOT/lib[master*]$ ../../../scripts/javap-foreach-jar-in-folder.sh controllers.ReverseAssets
#   ------- ch.qos.logback.logback-classic-1.0.7.jar: ----
#   ERROR:Could not find controllers.ReverseAssets
#   ------- ch.qos.logback.logback-core-1.0.7.jar: ----
#   ...
#   ------- com.amazonaws.aws-java-sdk-1.3.4.jar: ----
#   ERROR:Could not find controllers.ReverseAssets
#   ------- debiki-app-play_2.10-1.0-SNAPSHOT.jar: ----
#   Compiled from "routes_reverseRouting.scala"
#   public class controllers.ReverseAssets extends java.lang.Object{
#       public play.api.mvc.Call at(java.lang.String, java.lang.String);
#           public controllers.ReverseAssets();
#   }
#   
#   ------- debiki-core_2.10-0.0.2-SNAPSHOT.jar: ----
#   ERROR:Could not find controllers.ReverseAssets
#   ------- debiki-dao-pgsql_2.10-0.0.2-SNAPSHOT.jar: ----
#   ...
#   ------- rhino.js-1.7R2.jar: ----
#   ERROR:Could not find controllers.ReverseAssets
#   ------- securesocial_2.10-1.0-SNAPSHOT.jar: ----
#   Compiled from "routes_reverseRouting.scala"
#   public class controllers.ReverseAssets extends java.lang.Object{
#       public play.api.mvc.Call at(java.lang.String);
#           public controllers.ReverseAssets();
#   }

for f in *.jar ; do echo "------- $f: ----" ; javap -classpath $f $@ ; done

