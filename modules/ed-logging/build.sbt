// This is a separate project, so compiled classes will be available also in
// Play Framework Dev mode, which uses a special classloader.  [7SBMAQ2P]

name := "ed-logging"

organization := "community.ed"

version := "0.0.2"

scalaVersion := "2.12.3"

resolvers += "Scala-Tools Maven2 Repository" at "http://scala-tools.org/repo-releases"

libraryDependencies ++= Seq(
  "org.apache.commons" % "commons-lang3" % "3.7",
  "com.typesafe.play" %% "play-json" % "2.6.9",
  // https://mvnrepository.com/artifact/ch.qos.logback/logback-classic
  "ch.qos.logback" % "logback-classic" % "1.2.2",
  // https://mvnrepository.com/artifact/ch.qos.logback/logback-core
  "ch.qos.logback" % "logback-core" % "1.2.2",
  // Docs: https://github.com/logstash/logstash-logback-encoder/tree/logstash-logback-encoder-4.9
  "net.logstash.logback" % "logstash-logback-encoder" % "4.9")

scalacOptions += "-deprecation"


