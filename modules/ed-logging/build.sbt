// This is a separate project, so compiled classes will be available also in
// Play Framework Dev mode, which uses a special classloader.  [7SBMAQ2P]

name := "ed-logging"

organization := "community.ed"

version := "0.0.2"

scalaVersion := "2.12.2"

resolvers += "Scala-Tools Maven2 Repository" at "http://scala-tools.org/repo-releases"

libraryDependencies ++= Seq(
  "org.apache.commons" % "commons-lang3" % "3.5",
  "com.typesafe.play" %% "play-json" % "2.6.2",
  // https://mvnrepository.com/artifact/ch.qos.logback/logback-classic
  "ch.qos.logback" % "logback-classic" % "1.2.2",
  // https://mvnrepository.com/artifact/ch.qos.logback/logback-core
  "ch.qos.logback" % "logback-core" % "1.2.2",
  // Docs: https://github.com/logstash/logstash-logback-encoder/tree/logstash-logback-encoder-4.9
  "net.logstash.logback" % "logstash-logback-encoder" % "4.9")

scalacOptions += "-deprecation"

// See: https://groups.google.com/forum/?fromgroups=#!topic/simple-build-tool/bkF1IDZj4L0
ideaPackagePrefix := None

// Makes `dependency-graph` work.
net.virtualvoid.sbt.graph.DependencyGraphSettings.graphSettings

