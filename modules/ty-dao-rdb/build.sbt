name := "ty-dao-rdb"

organization := "com.debiki"

version := "0.0.2-SNAPSHOT"

scalaVersion := "2.12.8"

libraryDependencies ++= Seq(
  // PostgreSQL JDBC client driver
  // see: http://mvnrepository.com/artifact/org.postgresql/postgresql/
  "org.postgresql" % "postgresql" % "42.2.4",  // sync with main build.sbt [4AST5M]
  "com.typesafe.play" %% "play-json" % "2.8.1",
  "org.flywaydb" % "flyway-core" % "5.0.7")

