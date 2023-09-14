/**
  * Copyright (c) 2012-2021 Kaj Magnus Lindberg
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

import scala.sys.process._  // "shell command".!! = execute the command, return result
// Imported automatically, but incl here anyway so can click and open in the IDE:
import _root_.sbtbuildinfo.BuildInfoPlugin.autoImport._

// If SBT crashes, enable debug to find out which file it crashes in:
//logLevel := Level.Debug

// Note: In VSCode, the Scala Metals plugin, one needs to run the
// 'Metals: Import Build' task for Metals to notice a Scala version change.
ThisBuild / scalaVersion := "2.12.17"

// Show unchecked and deprecated warnings, in this project and its modules.
// scalacOptions in ThisBuild ++= Seq("-deprecation")


val appName = "talkyard-server"
val appVersion = ProjectDirectory.versionFileContents


// Data structures shared between appsv/server and appsv/rdb.
lazy val tyModel =
  project in file("appsv/model")


// Relational dataBase module (PostgreSQL).
lazy val tyRdb =
  (project in file("appsv/rdb"))
    .dependsOn(tyModel)


val appDependencies = Seq(
  play.sbt.PlayImport.ws,
  // Gzip filter.
  play.sbt.Play.autoImport.filters,
  Dependencies.Play.json,
  //Dependencies.Play.twirl,

  // For some reason, withouth this, an older version gets used which throws
  // an error because some dependencies use jackson 2.13.0 (and the others too,
  // older 2.X evicted), but the older -module-scala wants 2.10 or something.
  Dependencies.Libs.jacksonModuleScala,

  // OAuth2 and OIDC authentication.
  Dependencies.Libs.scribeJava,
  Dependencies.Libs.auth0JavaJwt,
  /*
  // Deprecated:
  "com.mohiva" %% "play-silhouette" % "7.0.0",
  "com.mohiva" %% "play-silhouette-crypto-jca" % "7.0.0",
   */


  Dependencies.Libs.jpasetoApi,
  Dependencies.Libs.jpasetoImpl,
  Dependencies.Libs.jpasetoGson,
  Dependencies.Libs.jpasetoSodium,

  // PostgreSQL JDBC client driver
  // see: https://mvnrepository.com/artifact/org.postgresql/postgresql/
  Dependencies.Libs.postgresqlJbcdClient,
  // Connection pool.
  Dependencies.Libs.hikariCp,

  // We use both an in-the-JVM-memory cache, and Redis:
  caffeine,  // was: "com.github.ben-manes.caffeine" % "caffeine"
  Dependencies.Libs.rediscala,

  // Search engine.
  Dependencies.Libs.elasticsearchClient,
  Dependencies.Libs.elasticsearchClientTransport,

  Dependencies.Libs.apacheCommonsEmail,
  Dependencies.Libs.apacheCommonsLang3,
  Dependencies.Libs.guava,
  Dependencies.Libs.jsoup,

  Dependencies.Libs.logbackClassic,
  Dependencies.Libs.logbackCore,
  Dependencies.Libs.logstashLogbackEncoder,

  // java.nio.file.Files.probeContentType doesn't work in Alpine Linux + JRE 8, so use
  // Tika instead. It'll be useful anyway later if indexing PDF or MS Word docs.
  Dependencies.Libs.apacheTika,

  Dependencies.Libs.metricsCore,
  Dependencies.Libs.jaegertracing,
  Dependencies.Libs.metrics4Scala,

  // JSR 305 is requried by Guava, at build time only (so specify "provided"
  // so it won't be included in the JAR), or there's this weird error: """
  //   class file '...guava-13.0.1.jar(.../LocalCache.class)' is broken
  //   [error] (class java.lang.RuntimeException/bad constant pool tag 9 at byte 125)
  //   [warn] Class javax.annotation.CheckReturnValue not found ..."""
  // See: https://code.google.com/p/guava-libraries/issues/detail?id=776
  // and: https://stackoverflow.com/questions/10007994/
  //              why-do-i-need-jsr305-to-use-guava-in-scala
  "com.google.code.findbugs" % "jsr305" % "3.0.2" % "provided",
  // CLEAN_UP remove Spec2 use only ScalaTest, need to edit some tests.
  "org.mockito" % "mockito-all" % "1.10.19" % "test", // I use Mockito with Specs2...
  Dependencies.Libs.scalaTest,
  Dependencies.Libs.scalaTestPlusPlay)


val main = (project in file("."))
  .enablePlugins(play.sbt.PlayWeb, BuildInfoPlugin)
  // With Play's Logback plugin enabled (it is by default), there's this error:
  // >  java.lang.NoClassDefFoundError: org/slf4j/impl/StaticLoggerBinder
  // and the Ty Play app exits.
  .disablePlugins(play.sbt.PlayLogback)
  .settings(mainSettings: _*)
  .dependsOn(
    tyModel % "test->test;compile->compile",
    tyRdb)
  .aggregate(
    tyModel,
    tyRdb)


def mainSettings = List(
  name := appName,
  version := appVersion,
  libraryDependencies ++= appDependencies,

  // Place tests in ./tests/app/ instead of ./test/, because there're other tests in
  // ./tests/, namely security/ and e2e/, and having both ./test/ and ./tests/ seems confusing.
  // RENAME to ./tests/appsv? (since ./app is now ./appsv)
  Test / scalaSource := { (Test / baseDirectory)(_ / "tests" / "app") }.value,

  // The app server code is in ./appsv, not ./app, because just "app" might
  // as well be Ty's web app (in ./client).
  Compile / scalaSource := { (Test / baseDirectory)(_ / "appsv" / "server") }.value,

  // This compiles language specific email templates in:
  // talkyard.server.emails.transl.nn_NN.
  Compile / TwirlKeys.compileTemplates / sourceDirectories :=
        Seq({ (Compile / baseDirectory)(_ / "appsv" / "server") }.value),

  /*
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
  */

  // This is the default. But keep anyway, because if needed later, then won't have to try to
  // find out in which packages the stuff is located.
  //play.sbt.routes.RoutesCompiler.autoImport.routesGenerator :=
  //  play.routes.compiler.InjectedRoutesGenerator,

  buildInfoPackage := "generatedcode",
  // Don't include the build time — because then Play Framework will reload, whenever [7UJ2Z5]
  // anything in public/ changes. E.g. fixing a typo in a Javascript comment.
  // buildInfoOptions += BuildInfoOption.BuildTime,
  buildInfoKeys := Seq[BuildInfoKey](
    name,
    version,
    scalaVersion,
    sbtVersion,
    BuildInfoKey.action("dockerTag") {
      // Also in release.sh: [8GKB4W2]
      // .!! returns a String with the command output, but .! returns the exit code.
      appVersion + '-' + "git rev-parse --short HEAD".!!.trim
    },
    BuildInfoKey.action("gitRevision") {
      "git rev-parse HEAD".!!.trim
    },
    BuildInfoKey.action("gitBranch") {
      "git rev-parse --abbrev-ref HEAD".!!.trim
    },
    // The last commit date, UTC.
    BuildInfoKey.action("gitLastCommitDateUtc") {
      // Linux only:
      //"env TZ=UTC git show --quiet --date='format-local:%Y-%m-%d %H:%M:%SZ' --format=\"%cd\"".!!.trim
      // Should work on Windows:
      scala.sys.process.Process(
        "git show --quiet --date=format-local:%Y-%m-%dT%H:%M:%SZ --format=\"%cd\"".split(" "),
        None, "TZ" -> "UTC").!!.trim
    }),
    // Don't include, because then Play recompiles and reloads, whenever any [7UJ2Z5]
    // Git file status changes.
    //BuildInfoKey.action("gitStatus") {
    //  "git status".!!.trim
    //}),

  // Disable ScalaDoc generation, it breaks seemingly because I'm compiling some Javascript
  // files to Java, and ScalaDoc complains the generated classes don't exist and breaks
  // the `dist` task.
  Compile / doc / sources := Seq.empty, // don't generate any docs
  Compile / packageDoc / publishArtifact := false,  // don't generate doc JAR

  Test / Keys.fork := false, // or cannot place breakpoints in test suites

  // ScalaTest full stack traces:
  Test / testOptions += Tests.Argument("-oF"))
  // Disable:
  // sbt> test -- -oS

  //listJarsTask)

// This is supposedly needed when using ScalaTest instead of Specs2,
// see: https://stackoverflow.com/a/10378430/694469, but I haven't
// activated this, because ScalaTest works fine anyway:
// `testOptions in Test := Nil`

// Lists dependencies.
// See: https://stackoverflow.com/a/6509428/694469
// ((Could do that before and after upgrading Play Framework, and run a diff,
// to find changed dependencies, in case terribly weird compilation
// errors arise, e.g. "not enough arguments for method" or
// "value getUnchecked is not a member of". Such errors happened when I built
// debiki-server with the very same version of Play 2.1-SNAPSHOT,
// but dependencies downloaded at different points in time (the more recent
// dependencies included a newer version of Google Guava.)))
/*
// Causes deprecation warning:
// The sbt 0.10 style DSL is deprecated: '(k1, k2) map { (x, y) => ... }'
// should now be '{ val x = k1.value; val y = k2.value }'.
// See https://www.scala-sbt.org/0.13/docs/Migrating-from-sbt-012x.html
def listJars = TaskKey[Unit]("list-jars")
def listJarsTask = listJars := (target, fullClasspath in Runtime) map {
  (target, cp) =>
    println("Target path is: "+target)
    println("Full classpath is: "+cp.map(_.data).mkString(":"))
} */

