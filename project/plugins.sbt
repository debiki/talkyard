// Comment to get more information during initialization
logLevel := Level.Warn

// The Typesafe repository
resolvers += "Typesafe repository" at "http://repo.typesafe.com/typesafe/releases/"

// Not needed when using Play — but needed when using SBT.
resolvers += Resolver.file("Local Repository", file("/mnt/data/dev/play/github2/repository/local"))(Resolver.ivyStylePatterns)

// Play SBT Plugin:
resolvers += Resolver.url("Typesafe Ivy Snapshots", url("http://repo.typesafe.com/typesafe/ivy-snapshots/"))(Resolver.ivyStylePatterns)


// Use the Play sbt plugin for Play projects
addSbtPlugin("play" % "sbt-plugin" % "2.1-SNAPSHOT")
	// Option(System.getProperty("play.version")).getOrElse("2.0"))



// The SBT-Idea plugin, https://github.com/mpeltonen/sbt-idea
// ---------------------------------------------------------------
resolvers += "sbt-idea-repo" at "http://mpeltonen.github.com/maven/"

// libraryDependencies += "com.github.mpeltonen" %% "sbt-idea" % "0.10.0"
addSbtPlugin("com.github.mpeltonen" % "sbt-idea" % "1.1.0-M2-TYPESAFE")

