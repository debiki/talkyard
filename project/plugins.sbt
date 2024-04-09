// Comment to get more information during initialization
logLevel := Level.Warn

// The Typesafe repository
resolvers += "Typesafe repository" at "https://repo.typesafe.com/typesafe/releases/"

// Not needed when using Play — but needed when using SBT.
//resolvers += Resolver.file("Local Repository", file("/mnt/data/dev/play/github2/repository/local"))(Resolver.ivyStylePatterns)

// Play SBT Plugin:
//resolvers += Resolver.url("Typesafe Ivy Snapshots", url("https://repo.typesafe.com/typesafe/ivy-snapshots/"))(Resolver.ivyStylePatterns)

resolvers ++= Seq(
  // For Specs2:
  "snapshots" at "https://oss.sonatype.org/content/repositories/snapshots",
  "releases"  at "https://oss.sonatype.org/content/repositories/releases",
  // For SBT BuildInfo:
  Resolver.sbtPluginRepo("releases")) // =  https://repo.scala-sbt.org/scalasbt/sbt-plugin-releases/

// Use the Play sbt plugin for Play projects. Can't upgrade to 2.9 until using [scala_2_13].
addSbtPlugin("com.typesafe.play" % "sbt-plugin" % "2.8.21")

// A refactoring and linting tool for Scala
addSbtPlugin("ch.epfl.scala" % "sbt-scalafix" % "0.12.0")
// Can get [scala_2_13] migration help by doing?:
//  scalafixAll dependency:Collection213Upgrade@org.scala-lang.modules:scala-collection-migrations:<version>
// where  <version>  is the scala-collection-migrations version?

// Pin dependencies.
addSbtPlugin("com.github.tkawachi" % "sbt-lock" % "0.8.0")

// Dependency tree, https://github.com/jrudolph/sbt-dependency-graph
// ---------------------------------------------------------------
// Usage:
//   dependencyTree
//   dependencyBrowseGraph  / -Tree
//   whatDependsOn  com.nimbusds  nimbus-jose-jwt
// Plugin now bundled with SBT, so just this:
addDependencyTreePlugin


// Makes e.g. Git SHA1 available to the Scala code at runtime.
// ---------------------------------------------------------------
addSbtPlugin("com.eed3si9n" % "sbt-buildinfo" % "0.12.0")

// Picks scala-xml 2.1 over 1.1 — otherwise there the below version conflict error
// (when just loading the project) with Scala 2.12.18 or 2.12.19 because they use
// scala-xml 2.x but Play and SBT use 1.x.
//
// 2.1 and 1.x are binary compatible, sort of, so this is ok, see e.g.
// https://github.com/sbt/sbt/issues/6997  and  https://github.com/scala/bug/issues/12632
// search for "libraryDependencySchemes".
//
// The version conflict error:
//
//    java.lang.RuntimeException: found version conflict(s) in library dependencies;
//         some are suspected to be binary incompatible:
//  	* org.scala-lang.modules:scala-xml_2.12:2.1.0 (early-semver) is selected over {1.2.0, 1.1.1}
//  	    +- org.scala-lang:scala-compiler:2.12.18              (depends on 2.1.0)
//  	    +- com.typesafe.sbt:sbt-native-packager:1.5.2 (scalaVersion=2.12, sbtVersion=1.0) (depends on 1.1.1)
//  	    +- com.typesafe.play:twirl-api_2.12:1.5.1             (depends on 1.2.0)
//
ThisBuild / libraryDependencySchemes +=
    "org.scala-lang.modules" %% "scala-xml" % VersionScheme.Always

