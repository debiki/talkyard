name := "debiki-tck-dao"

organization := "com.debiki"

version := "0.0.2-SNAPSHOT"

scalaVersion := "2.11.7"

libraryDependencies ++= Seq(
  "junit" % "junit" % "4.7",
  "org.scalatest" %% "scalatest" % "2.2.0",
  "org.specs2" %% "specs2" % "2.3.12"  // shouldn't use no more, ScalaTest is better
)

// See: https://groups.google.com/forum/?fromgroups=#!topic/simple-build-tool/bkF1IDZj4L0
ideaPackagePrefix := None

// Makes `dependency-graph` work.
net.virtualvoid.sbt.graph.Plugin.graphSettings

// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
