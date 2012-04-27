name := "debiki-core"

organization := "com.debiki"

version := "0.0.2-SNAPSHOT"

scalaVersion := "2.9.1"

resolvers += "Scala-Tools Maven2 Repository" at "http://scala-tools.org/repo-releases"

libraryDependencies ++= Seq(
  "org.scala-lang" % "scala-library" % "2.9.1",
  "org.yaml" % "snakeyaml" % "1.6",
  "com.google.guava" % "guava" % "r09",
  "commons-codec" % "commons-codec" % "1.5",
  "net.liftweb" %% "lift-util" % "2.4-M5",
  "junit" % "junit" % "4.7" % "test",
  "org.scala-tools.testing" %% "specs" % "1.6.9" % "test"
)

scalacOptions += "-deprecation"

