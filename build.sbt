name := "debiki-core"

organization := "com.debiki"

version := "0.0.2-SNAPSHOT"

scalaVersion := "2.9.1"

resolvers += "Scala-Tools Maven2 Repository" at "http://scala-tools.org/repo-releases"

libraryDependencies ++= Seq(
  "org.scala-lang" % "scala-library" % "2.9.1",
  "com.google.guava" % "guava" % "10.0.1",
  "commons-codec" % "commons-codec" % "1.5",
  "nu.validator.htmlparser" % "htmlparser" % "1.2.1",
  "junit" % "junit" % "4.7" % "test",
  "org.scala-tools.testing" %% "specs" % "1.6.9" % "test"
)

scalacOptions += "-deprecation"

