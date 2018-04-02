name := "ed-core"

organization := "com.debiki"

version := "0.0.2-SNAPSHOT"

scalaVersion := "2.12.3"

resolvers += "Scala-Tools Maven2 Repository" at "http://scala-tools.org/repo-releases"

libraryDependencies ++= Seq(
  "org.scalactic" %% "scalactic" % "3.0.1",
  "com.google.guava" % "guava" % "24.1-jre",
  "commons-codec" % "commons-codec" % "1.11",
  "commons-validator" % "commons-validator" % "1.6",
  "nu.validator.htmlparser" % "htmlparser" % "1.4",
  "org.owasp.encoder" % "encoder" % "1.2.1",
  "com.typesafe.play" %% "play-json" % "2.6.9",
  "com.lambdaworks" % "scrypt" % "1.4.0", // COULD move to ed-server, see comments in src/main/scala/com/debiki/core/dao-db.scala
  "junit" % "junit" % "4.7" % "test",
  "org.specs2" %% "specs2-core" % "3.9.4" % "test",
  "org.scalatest" %% "scalatest" % "3.0.1" % "test"
)

scalacOptions += "-deprecation"

