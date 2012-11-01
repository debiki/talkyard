name := "debiki-tck-dao"

organization := "com.debiki"

version := "0.0.2-SNAPSHOT"

scalaVersion := "2.10.0-RC1"

libraryDependencies ++= Seq(
  "junit" % "junit" % "4.7",
  //"org.specs2" %% "specs2" % "1.12.2"  —> unresolved dependency: //"org.specs2#specs2_2.10;1.12.2: not found"
  "org.specs2" % "specs2_2.10.0-RC1" % "1.12.2"
)

// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
