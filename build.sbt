name := "debiki-core"

organization := "com.debiki"

version := "0.0.2-SNAPSHOT"

scalaVersion := "2.8.1"

resolvers += "Scala-Tools Maven2 Repository" at "http://scala-tools.org/repo-releases"

libraryDependencies ++= Seq(
  "org.scala-lang" % "scala-library" % "2.8.1",
  "org.yaml" % "snakeyaml" % "1.6",
  "com.google.guava" % "guava" % "r09",
  "net.liftweb" %% "lift-common" % "2.2",
  "net.liftweb" %% "lift-util" % "2.2",
  "junit" % "junit" % "4.7" % "test",
  "org.scala-tools.testing" %% "specs" % "1.6.6" % "test"
)
