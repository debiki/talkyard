name := "ty-dao-rdb"

organization := "com.debiki"

version := "0.0.2-SNAPSHOT"

libraryDependencies ++= Seq(
  Dependencies.Play.json,
  Dependencies.Libs.postgresqlJbcdClient,
  Dependencies.Libs.flywaydb)

