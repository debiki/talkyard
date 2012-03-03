// Comment to get more information during initialization
logLevel := Level.Warn

// The Typesafe repository 
resolvers += "Typesafe repository" at "http://repo.typesafe.com/typesafe/releases/"

// Use the Play sbt plugin for Play projects
// addSbtPlugin("play" % "sbt-plugin" % "2.0-RC2")

// But use -SNAPSHOT, because there's no -RC2 in the Typesafe or local repo: (right now, buggy build)
addSbtPlugin("play" % "sbt-plugin" % "2.0-SNAPSHOT")
