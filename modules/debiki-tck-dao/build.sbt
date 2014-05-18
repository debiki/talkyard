name := "debiki-tck-dao"

organization := "com.debiki"

version := "0.0.2-SNAPSHOT"

scalaVersion := "2.10.3"

libraryDependencies ++= Seq(
  "junit" % "junit" % "4.7",
  "org.scalatest" % "scalatest_2.10" % "2.1.5",
  "org.specs2" %% "specs2" % "1.14"  // shouldn't use no more, ScalaTest is better
)

// See: https://groups.google.com/forum/?fromgroups=#!topic/simple-build-tool/bkF1IDZj4L0
ideaPackagePrefix := None

// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
