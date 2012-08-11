import sbt._
import Keys._
import PlayProject._

object ApplicationBuild extends Build {

  val appName         = "debiki-app-play"
  val appVersion      = "1.0-SNAPSHOT"

  lazy val debikiCore =
    Project("debiki-core", file("modules/debiki-core"))

  lazy val debikiTckDao =
    (Project("debiki-tck-dao", file("modules/debiki-tck-dao"))
    dependsOn(debikiCore ))

  lazy val debikiDaoPgsql =
    (Project("debiki-dao-pgsql", file("modules/debiki-dao-pgsql"))
    dependsOn(debikiCore, debikiTckDao % "test"))

  lazy val secureSocialDeps = Seq(
    "com.typesafe" %% "play-plugins-util" % "2.0.1",
    "org.mindrot" % "jbcrypt" % "0.3m")

  lazy val secureSocial =
    PlayProject("securesocial", appVersion, secureSocialDeps, mainLang = SCALA,
        path = file("modules/securesocial")
    ).settings(
      resolvers ++= Seq(
        "jBCrypt Repository" at "http://repo1.maven.org/maven2/org/",
        "Typesafe Repository" at "http://repo.typesafe.com/typesafe/releases/")
    )

  val appDependencies = Seq(
    "com.amazonaws" % "aws-java-sdk" % "1.3.4",
    "com.google.guava" % "guava" % "10.0.1",
    "com.twitter" %% "ostrich" % "4.10.6",
    "rhino" % "js" % "1.7R2"
  )

  val main = PlayProject(appName, appVersion, appDependencies, mainLang = SCALA
    ).settings(
      mainSettings: _*
    ).dependsOn(
      debikiCore, debikiDaoPgsql, secureSocial
    ).aggregate(
      secureSocial
    )


  def mainSettings = List(
    compileRhinoTask := { "make compile_javascript"! },
    combineAndGzipJs := {
      "make combine_and_gzip_javascript"!
    },
    combineAndGzipJs <<= combineAndGzipJs.dependsOn(compile in Compile),
    // SBT ignores this line:
    fullClasspath in Compile +=
       Attributed.blank(file(rhinoClassDir)),
    Keys.compile in Compile <<=
       (Keys.compile in Compile).dependsOn(compileRhinoTask),
    playPackageEverything <<=
       (playPackageEverything).dependsOn(combineAndGzipJs))

  // Cannot use, because SBT ignores above classpath elem addition:
  //val rhinoClassDir = "target/scala-2.9.1/compiledjs/classes/"
  // Instead:
  val rhinoClassDir = "target/scala-2.9.1/classes/"

  def compileRhinoTask = TaskKey[Unit]("compile-js",
    "Invokes Rhino to compile Javascript to Java bytecode")

  def combineAndGzipJs = TaskKey[Unit]("combine-and-gzip-js",
    "Appengs and gzips much Javascript to one single file")

  // Show unchecked and deprecated warnings, in this project and all
  // its modules.
  // scalacOptions in ThisBuild ++= Seq("-deprecation")

}

