// Comment to get more information during initialization
logLevel := Level.Warn

// The Typesafe repository
resolvers += "Typesafe repository" at "http://repo.typesafe.com/typesafe/releases/"

// Use the Play sbt plugin for Play projects
addSbtPlugin("play" % "sbt-plugin" % "2.1-SNAPSHOT")


// The SBT-Idea plugin, https://github.com/mpeltonen/sbt-idea
// ---------------------------------------------------------------
resolvers += "sbt-idea-repo" at "http://mpeltonen.github.com/maven/"

// libraryDependencies += "com.github.mpeltonen" %% "sbt-idea" % "0.10.0"
addSbtPlugin("com.github.mpeltonen" % "sbt-idea" % "1.0.0")

