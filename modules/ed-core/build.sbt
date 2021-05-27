name := "ed-core"

organization := "com.debiki"

version := ProjectDirectory.versionFileContents

resolvers += "Scala-Tools Maven2 Repository" at "https://scala-tools.org/repo-releases"

libraryDependencies ++= Seq(
  Dependencies.Libs.scalactic,
  Dependencies.Libs.guava,
  "commons-codec" % "commons-codec" % "1.11",
  "commons-validator" % "commons-validator" % "1.6",
  Dependencies.Libs.apacheCommonsEmail,  // needed here for email address validation only
  Dependencies.Libs.apacheTika,
  "nu.validator.htmlparser" % "htmlparser" % "1.4",
  "org.owasp.encoder" % "encoder" % "1.2.1",
  Dependencies.Play.json,
  "com.lambdaworks" % "scrypt" % "1.4.0", // COULD move to ed-server, see comments in src/main/scala/com/debiki/core/dao-db.scala
  Dependencies.Libs.specs2,
  Dependencies.Libs.scalaTest,
)

scalacOptions += "-deprecation"

