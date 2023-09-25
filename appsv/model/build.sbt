name := "ty-model"

organization := "com.debiki"

version := ProjectDirectory.versionFileContents

resolvers += "Scala-Tools Maven2 Repository" at "https://scala-tools.org/repo-releases"

libraryDependencies ++= Seq(
  Dependencies.Libs.scalactic,
  Dependencies.Libs.guava,
  "commons-codec" % "commons-codec" % "1.16.0",
  "commons-validator" % "commons-validator" % "1.7",
  Dependencies.Libs.apacheCommonsEmail,  // needed here for email address validation only
  Dependencies.Libs.apacheTika,
  "nu.validator.htmlparser" % "htmlparser" % "1.4",
  "org.owasp.encoder" % "encoder" % "1.2.3",
  Dependencies.Play.json,
  "com.lambdaworks" % "scrypt" % "1.4.0", // COULD move to ed-server, see comments in src/main/scala/com/debiki/core/dao-db.scala
  Dependencies.Libs.specs2,
  Dependencies.Libs.scalaTest,
)

scalacOptions += "-deprecation"

compileOrder := CompileOrder.JavaThenScala
