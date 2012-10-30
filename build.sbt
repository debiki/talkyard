name := "debiki-core"

organization := "com.debiki"

version := "0.0.2-SNAPSHOT"

scalaVersion := "2.10.0-RC1"

resolvers += "Scala-Tools Maven2 Repository" at "http://scala-tools.org/repo-releases"

libraryDependencies ++= Seq(
  // "org.scala-lang" % "scala-library" % "2.9.1",
  "com.google.guava" % "guava" % "10.0.1",
  "commons-codec" % "commons-codec" % "1.5",
  "nu.validator.htmlparser" % "htmlparser" % "1.2.1",
  "junit" % "junit" % "4.7" % "test",
  //"org.specs2" %% "specs2" % "1.12.2" % "test"  —> unresolved dependency: //"org.specs2#specs2_2.10;1.12.2: not found"
  "org.specs2" % "specs2_2.10.0-RC1" % "1.12.2" % "test"
)

scalacOptions += "-deprecation"

