import sbt._
import Keys._
import play.Project._
import com.typesafe.sbteclipse.plugin.EclipsePlugin.EclipseKeys

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
    // Append if there's any error like the one mentioned in the `routes` file, search
    // for [593bKWR] in that file, then change to  "... 2.1.0 notTransitive()" below:
    // (Currently that error happens if I add a dependency on
    //    "securesocial" %% "securesocial" % "master-SNAPSHOT",
    // rather than including SecureSocial as a submodule.)
    "com.typesafe" %% "play-plugins-util" % "2.1.0",// notTransitive(),
    "com.typesafe" %% "play-plugins-mailer" % "2.1.0",// notTransitive(),
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
    "com.google.guava" % "guava" % "13.0.1",
    // JSR 305 is requried by Guava, at build time only (so specify "provided"
    // so it won't be included in the JAR), or there's this weird error: """
    //   class file '...guava-13.0.1.jar(.../LocalCache.class)' is broken
    //   [error] (class java.lang.RuntimeException/bad constant pool tag 9 at byte 125)
    //   [warn] Class javax.annotation.CheckReturnValue not found ..."""
    // See: http://code.google.com/p/guava-libraries/issues/detail?id=776
    // and: http://stackoverflow.com/questions/10007994/
    //              why-do-i-need-jsr305-to-use-guava-in-scala
    "com.google.code.findbugs" % "jsr305" % "1.3.9" % "provided",
    // "com.twitter" %% "ostrich" % "4.10.6",
    "rhino" % "js" % "1.7R2",
    "org.yaml" % "snakeyaml" % "1.11",
    "org.mockito" % "mockito-all" % "1.9.0" % "test", // I use Mockito with Specs2...
    "org.scalatest" % "scalatest_2.10" % "2.0.M6-SNAP8" % "test", // but prefer ScalaTest
    "org.scala-lang" % "scala-actors" % "2.10.1" % "test" // needed by ScalaTest
  )


  // Make `idea with-sources` work in subprojects.
  override def settings =
    super.settings ++ org.sbtidea.SbtIdeaPlugin.ideaSettings ++
    // By default, sbteclipse skips parent projects.
    // See the "skipParents" section, here:
    // https://github.com/typesafehub/sbteclipse/wiki/Using-sbteclipse
    Seq(EclipseKeys.skipParents := false, resolvers := Seq())


  val main = play.Project(appName, appVersion, appDependencies
    ).settings(
      mainSettings: _*
    ).dependsOn(
      debikiCore, debikiDaoPgsql, secureSocial
    ).aggregate(
      secureSocial
    )


  def mainSettings = List(
    scalaVersion := "2.10.1",
    compileRhinoTask := { "make compile_javascript"! },
    Keys.fork in Test := false, // or cannot place breakpoints in test suites
    Keys.compile in Compile <<=
       (Keys.compile in Compile).dependsOn(compileRhinoTask),
    unmanagedClasspath in Compile <+= (baseDirectory) map { bd =>
      Attributed.blank(bd / "target/scala-2.10/compiledjs-classes")
    },
    listJarsTask)

  // This is supposedly needed when using ScalaTest instead of Specs2,
  // see: http://stackoverflow.com/a/10378430/694469, but I haven't
  // activated this, because ScalaTest works fine anyway:
  // `testOptions in Test := Nil`

  val rhinoClassDir = "target/scala-2.10/classes/"

  def compileRhinoTask = TaskKey[Unit]("compile-js",
    "Invokes Rhino to compile Javascript to Java bytecode")


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
