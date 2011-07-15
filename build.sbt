name := "debiki-tck-dao"

organization := "com.debiki"

version := "0.0.2-SNAPSHOT"

scalaVersion := "2.8.1"

libraryDependencies ++= Seq(
  "net.liftweb" %% "lift-common" % "2.2",
  "net.liftweb" %% "lift-util" % "2.2",
  "junit" % "junit" % "4.7",
  "org.scala-tools.testing" %% "specs" % "1.6.6"
)

// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
