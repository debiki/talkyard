name := "ty-dao-rdb"

organization := "com.debiki"

version := ProjectDirectory.versionFileContents

libraryDependencies ++= Seq(
  Dependencies.Play.json,
  Dependencies.Libs.postgresqlJbcdClient,
  Dependencies.Libs.flywaydb)

