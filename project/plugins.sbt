// scalaVersion := "2.10.1"               // --> "play#sbt-plugin;2.1.0: not found"  no matter what version I specify
// scalaVersion in ThisBuild := "2.10.1"  // --> "play#sbt-plugin;2.1.0: not found"  no matter what version I specify
// But when I added 2.10.1 to Build.scala instead, everything (?) works fine.

// Comment to get more information during initialization
logLevel := Level.Warn

// The Typesafe repository
resolvers += "Typesafe repository" at "http://repo.typesafe.com/typesafe/releases/"

// Not needed when using Play — but needed when using SBT.
//resolvers += Resolver.file("Local Repository", file("/mnt/data/dev/play/github2/repository/local"))(Resolver.ivyStylePatterns)

// Play SBT Plugin:
//resolvers += Resolver.url("Typesafe Ivy Snapshots", url("http://repo.typesafe.com/typesafe/ivy-snapshots/"))(Resolver.ivyStylePatterns)

// For Specs2:
resolvers ++= Seq("snapshots" at "http://oss.sonatype.org/content/repositories/snapshots",
                    "releases"  at "http://oss.sonatype.org/content/repositories/releases")

// Use the Play sbt plugin for Play projects
addSbtPlugin("com.typesafe.play" % "sbt-plugin" % "2.5.9")


// The SBT-Idea plugin, https://github.com/mpeltonen/sbt-idea
// Don't know if this is really needed? Seems to work anyway forn new projects.
// However, to attach Play's own sources, open a Play class for which sources
// are missing, and click "Attach soruces" in the upper right corner in Idea,
// and choose <play-dist-folder>/framework/src/.
// ---------------------------------------------------------------
resolvers += "sbt-idea-repo" at "http://mpeltonen.github.com/maven/"

// libraryDependencies += "com.github.mpeltonen" %% "sbt-idea" % "0.10.0"
//addSbtPlugin("com.github.mpeltonen" % "sbt-idea" % "1.1.0-M2-TYPESAFE")
//addSbtPlugin("com.github.mpeltonen" % "sbt-idea" % "1.1.0")
//addSbtPlugin("com.github.mpeltonen" % "sbt-idea" % "1.5.1")
addSbtPlugin("com.github.mpeltonen" % "sbt-idea" % "1.6.0")


// Dependency tree, https://github.com/jrudolph/sbt-dependency-graph
// ---------------------------------------------------------------
addSbtPlugin("net.virtual-void" % "sbt-dependency-graph" % "0.8.2")


// Makes e.g. Git SHA1 available to the Scala code at runtime.
// ---------------------------------------------------------------
addSbtPlugin("com.eed3si9n" % "sbt-buildinfo" % "0.6.1")

