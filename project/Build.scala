import sbt._
import Keys._
import play.Project._

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
    // "com.typesafe" %% "play-plugins-util" % "2.0.1", // notTransitive(),
    "org.mindrot" % "jbcrypt" % "0.3m")

  lazy val secureSocial =
    play.Project("securesocial", appVersion, secureSocialDeps,
        path = file("modules/securesocial")
    ).settings(
      resolvers ++= Seq(
        "jBCrypt Repository" at "http://repo1.maven.org/maven2/org/",
        "Typesafe Repository" at "http://repo.typesafe.com/typesafe/releases/")
    )

  val appDependencies = Seq(
    "com.amazonaws" % "aws-java-sdk" % "1.3.4",
    "com.google.guava" % "guava" % "10.0.1",
    // "com.twitter" %% "ostrich" % "4.10.6",
    "rhino" % "js" % "1.7R2",
    "org.yaml" % "snakeyaml" % "1.11",
    "org.mockito" % "mockito-all" % "1.9.0" % "test"
  )


  // Make `idea with-sources` work in subprojects.
  override def settings =
    super.settings ++ org.sbtidea.SbtIdeaPlugin.ideaSettings

  val main = play.Project(appName, appVersion, appDependencies
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
       (playPackageEverything).dependsOn(combineAndGzipJs),
    listJarsTask)


  // Cannot use, because SBT ignores above classpath elem addition:
  //val rhinoClassDir = "target/scala-2.10/compiledjs/classes/"
  // Instead:
  val rhinoClassDir = "target/scala-2.10/classes/"

  def compileRhinoTask = TaskKey[Unit]("compile-js",
    "Invokes Rhino to compile Javascript to Java bytecode")

  def combineAndGzipJs = TaskKey[Unit]("combine-and-gzip-js",
    "Appengs and gzips much Javascript to one single file")


  // Lists dependencies.
  // See: http://stackoverflow.com/a/6509428/694469
  // ((Could do that before and after upgrading Play Framework, and run a diff,
  // to find changed dependencies, in case terribly weird compilation
  // errors arise, e.g. "not enough arguments for method" or
  // "value getUnchecked is not a member of". Such errors happened when I built
  // debiki-app-play with the very same version of Play 2.1-SNAPSHOT,
  // but dependencies downloaded at different points in time (the more recent
  // dependencies included a newer version of Google Guava.)))
  def listJars = TaskKey[Unit]("list-jars")
  def listJarsTask = listJars <<= (target, fullClasspath in Runtime) map {
        (target, cp) =>
    println("Target path is: "+target)
    println("Full classpath is: "+cp.map(_.data).mkString(":"))
  }


  // Show unchecked and deprecated warnings, in this project and all
  // its modules.
  // scalacOptions in ThisBuild ++= Seq("-deprecation")

}

// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
