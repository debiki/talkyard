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
addSbtPlugin("play" % "sbt-plugin" % "2.1.3")


// The SBT-Idea plugin, https://github.com/mpeltonen/sbt-idea
// ---------------------------------------------------------------
resolvers += "sbt-idea-repo" at "http://mpeltonen.github.com/maven/"

// libraryDependencies += "com.github.mpeltonen" %% "sbt-idea" % "0.10.0"
addSbtPlugin("com.github.mpeltonen" % "sbt-idea" % "1.1.0-M2-TYPESAFE")
//addSbtPlugin("com.github.mpeltonen" % "sbt-idea" % "1.1.0")
//addSbtPlugin("com.github.mpeltonen" % "sbt-idea" % "1.5.1")


// Eclipse project files
// ---------------------------------------------------------------
addSbtPlugin("com.typesafe.sbteclipse" % "sbteclipse-plugin" % "2.1.1")
// And see `override def settings =` in Build.scala.
// Generate Eclipse project files like so: `eclipse with-source=true` (in SBT)

