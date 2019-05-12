// Comment to get more information during initialization
logLevel := Level.Warn

// The Typesafe repository
resolvers += "Typesafe repository" at "http://repo.typesafe.com/typesafe/releases/"

// Not needed when using Play — but needed when using SBT.
//resolvers += Resolver.file("Local Repository", file("/mnt/data/dev/play/github2/repository/local"))(Resolver.ivyStylePatterns)

// Play SBT Plugin:
//resolvers += Resolver.url("Typesafe Ivy Snapshots", url("http://repo.typesafe.com/typesafe/ivy-snapshots/"))(Resolver.ivyStylePatterns)

resolvers ++= Seq(
  // For Specs2:
  "snapshots" at "http://oss.sonatype.org/content/repositories/snapshots",
  "releases"  at "http://oss.sonatype.org/content/repositories/releases",
  // For SBT BuildInfo:
  Resolver.sbtPluginRepo("releases")) // =  https://repo.scala-sbt.org/scalasbt/sbt-plugin-releases/

// Use the Play sbt plugin for Play projects
addSbtPlugin("com.typesafe.play" % "sbt-plugin" % "2.6.22")    // newest 6x, as of 19-05-12


// Dependency tree, https://github.com/jrudolph/sbt-dependency-graph
// ---------------------------------------------------------------
addSbtPlugin("net.virtual-void" % "sbt-dependency-graph" % "0.9.0")


// Makes e.g. Git SHA1 available to the Scala code at runtime.
// ---------------------------------------------------------------
addSbtPlugin("com.eed3si9n" % "sbt-buildinfo" % "0.8.0")

