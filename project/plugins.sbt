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

// Use the Play sbt plugin for Play projects
addSbtPlugin("com.typesafe.play" % "sbt-plugin" % "2.8.20")

// A refactoring and linting tool for Scala
addSbtPlugin("ch.epfl.scala" % "sbt-scalafix" % "0.12.1")

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
addSbtPlugin("com.eed3si9n" % "sbt-buildinfo" % "0.11.0")

