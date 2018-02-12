/**
 * Copyright (c) 2012-2016 Kaj Magnus Lindberg
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import sbt._
import Keys._
import sbtbuildinfo._

// COULD port to .sbt file instead. Build.scala = deprecated. Migration docs here:
// http://www.scala-sbt.org/0.13/docs/Migrating-from-sbt-012x.html#Migrating+from+the+Build+trait

object ApplicationBuild extends Build {

  val versionFileContents = {
    val source = scala.io.Source.fromFile("version.txt")
    try source.mkString.trim
    finally source.close()
  }

  val appName = "talkyard-server"
  val appVersion = {
    // Change from WIP (work-in-progress) to SNAPSHOT, suitable for the Java/Scala world.
    versionFileContents.replaceAllLiterally("WIP", "SNAPSHOT")
  }

  // Stuff shared between <repo-root>/app/ and <repo-root>/modules/ed-dao-rdb.
  lazy val edCore =
    Project("ed-core", file("modules/ed-core"))

  // ed = EffectiveDiscussions, dao = Database Access Object, rdb = Relational DataBase (PostgreSQL)
  lazy val edDaoRdb =
    (Project("ed-dao-rdb", file("modules/ed-dao-rdb"))
    dependsOn edCore)

  // In dev mode, dynamically compiled classes are not available when Logback starts,  [7SBMAQ2P]
  // unless they're compiled first, in a separate step in another project. So place the Logback
  // stuff (custom Logback layout) in this separate project — and you need to do publish-local in it.
  lazy val edLogging =
    Project("ed-logging", file("modules/ed-logging"))


  val appDependencies = Seq(
    play.sbt.PlayImport.ws,
    // Gzip filter.
    play.sbt.Play.autoImport.filters,
    "com.typesafe.play" %% "play-json" % "2.6.8",
    // OpenAuth and OpenID etc Authentication.
    "com.mohiva" %% "play-silhouette" % "5.0.0",
    "com.mohiva" %% "play-silhouette-crypto-jca" % "5.0.0",
    // ? "com.mohiva" %% "play-silhouette-password-bcrypt" % "4.0.0",
    // PostgreSQL JDBC client driver
    // see: http://mvnrepository.com/artifact/org.postgresql/postgresql/
    "org.postgresql" % "postgresql" % "9.4.1208",  // there's no 9.5 right now
    // HikariCP — "A solid high-performance JDBC connection pool at last"
    "com.zaxxer" % "HikariCP" % "2.5.1",
    // We use both an in-the-JVM-memory cache, and Redis:
    "com.github.ben-manes.caffeine" % "caffeine" % "2.2.6",
    "com.github.etaty" %% "rediscala" % "1.8.0",
    // Search engine, in https://mvnrepository.com.
    "org.elasticsearch" % "elasticsearch" % "6.1.0",
    "org.elasticsearch.client" % "transport" % "6.1.0",
    // ElasticSearch needs log4j
    "log4j" % "log4j" % "1.2.17",
    "org.apache.commons" % "commons-email" % "1.4",
    "com.google.guava" % "guava" % "19.0",
    "org.jsoup" % "jsoup" % "1.9.2",
    // Fluentd better understands json logs.
    // https://mvnrepository.com/artifact/ch.qos.logback/logback-classic
    "ch.qos.logback" % "logback-classic" % "1.2.2",
    // https://mvnrepository.com/artifact/ch.qos.logback/logback-core
    "ch.qos.logback" % "logback-core" % "1.2.2",
    // Docs: https://github.com/logstash/logstash-logback-encoder/tree/logstash-logback-encoder-4.9
    "net.logstash.logback" % "logstash-logback-encoder" % "4.9",
    //"org.kurochan" %% "logback-stackdriver-logging" % "0.0.1",
    "community.ed" %% "ed-logging" % "0.0.2",
    // java.nio.file.Files.probeContentType doesn't work in Alpine Linux + JRE 8, so use
    // Tika instead. It'll be useful anyway later if indexing PDF or MS Word docs.
    "org.apache.tika" % "tika-core" % "1.13",
    "io.dropwizard.metrics" % "metrics-core" % "3.2.2",
    "nl.grons" %% "metrics-scala" % "3.5.9_a2.4",
    // JSR 305 is requried by Guava, at build time only (so specify "provided"
    // so it won't be included in the JAR), or there's this weird error: """
    //   class file '...guava-13.0.1.jar(.../LocalCache.class)' is broken
    //   [error] (class java.lang.RuntimeException/bad constant pool tag 9 at byte 125)
    //   [warn] Class javax.annotation.CheckReturnValue not found ..."""
    // See: http://code.google.com/p/guava-libraries/issues/detail?id=776
    // and: http://stackoverflow.com/questions/10007994/
    //              why-do-i-need-jsr305-to-use-guava-in-scala
    "com.google.code.findbugs" % "jsr305" % "1.3.9" % "provided",
    "org.mockito" % "mockito-all" % "1.9.0" % "test", // I use Mockito with Specs2...
    "org.scalatest" %% "scalatest" % "3.0.1" % "test", // but prefer ScalaTest
    "org.scalatestplus.play" %% "scalatestplus-play" % "3.1.0" % Test)


  val main = Project(appName, file(".")).enablePlugins(play.sbt.Play, BuildInfoPlugin)
    .settings(mainSettings: _*)
    .dependsOn(
      edCore % "test->test;compile->compile",
      edDaoRdb)
    .aggregate(
      edLogging,
      edCore)


  def mainSettings = List(
    version := appVersion,
    libraryDependencies ++= appDependencies,
    scalaVersion := "2.12.3",

    // Place tests in ./tests/app/ instead of ./test/, because there're other tests in
    // ./tests/, namely security/ and e2e/, and having both ./test/ and ./tests/ seems confusing.
    scalaSource in Test := { (baseDirectory in Test)(_ / "tests" / "app") }.value,

    // Silhouette needs com.atlassian.jwt:jwt-core and jwt-api, but there's a problem:
    // """the problem is that the jwt-lib is hosted on bintray.com and then mirrored to
    // the typesafe.com repository. It seems that the typesafe repository uses a redirect
    // which sbt doesn't understand""" (says akkie = Christian Kaps the Silhouette author)
    // with a solution:
    //   https://github.com/mohiva/play-silhouette-seed/issues/20#issuecomment-75367376
    // namely to add the Atlassian repo before the Typesafe repo:
    resolvers :=
      ("Atlassian Releases" at "https://maven.atlassian.com/public/") +:
        Keys.resolvers.value,

    // This is the default. But keep anyway, because if needed later, then won't have to try to
    // find out in which packages the stuff is located.
    //play.sbt.routes.RoutesCompiler.autoImport.routesGenerator :=
    //  play.routes.compiler.InjectedRoutesGenerator,

    BuildInfoKeys.buildInfoPackage := "generatedcode",
    BuildInfoKeys.buildInfoOptions += BuildInfoOption.BuildTime,
    BuildInfoKeys.buildInfoKeys := Seq[BuildInfoKey](
      name,
      version,
      scalaVersion,
      sbtVersion,
      BuildInfoKey.action("dockerTag") {
        // Also in release.sh: [8GKB4W2]
        versionFileContents + '-' + "git rev-parse --short HEAD".!!.trim
      },
      BuildInfoKey.action("gitRevision") {
        "git rev-parse HEAD".!!.trim
      },
      BuildInfoKey.action("gitBranch") {
        "git rev-parse --abbrev-ref HEAD".!!.trim
      },
      BuildInfoKey.action("gitStatus") {
        "git status".!!.trim
      }),

    // Disable ScalaDoc generation, it breaks seemingly because I'm compiling some Javascript
    // files to Java, and ScalaDoc complains the generated classes don't exist and breaks
    // the `dist` task.
    sources in (Compile, doc) := Seq.empty, // don't generate any docs
    publishArtifact in (Compile, packageDoc) := false,  // don't generate doc JAR

    Keys.fork in Test := false, // or cannot place breakpoints in test suites

    // ScalaTest full stack traces:
    testOptions in Test += Tests.Argument("-oF"),
    // Disable:
    // sbt> test -- -oS

    listJarsTask)

  // This is supposedly needed when using ScalaTest instead of Specs2,
  // see: http://stackoverflow.com/a/10378430/694469, but I haven't
  // activated this, because ScalaTest works fine anyway:
  // `testOptions in Test := Nil`

  // Lists dependencies.
  // See: http://stackoverflow.com/a/6509428/694469
  // ((Could do that before and after upgrading Play Framework, and run a diff,
  // to find changed dependencies, in case terribly weird compilation
  // errors arise, e.g. "not enough arguments for method" or
  // "value getUnchecked is not a member of". Such errors happened when I built
  // debiki-server with the very same version of Play 2.1-SNAPSHOT,
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
