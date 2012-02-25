import sbt._
import Keys._
import PlayProject._

object ApplicationBuild extends Build {

  val appName         = "debiki-app-play"
  val appVersion      = "1.0-SNAPSHOT"

  lazy val debikiCore =
    Project("debiki-core", file("modules/debiki-core"))

  lazy val debikiTckDao =
    (Project("debiki-tck-dao", file("modules/debiki-tck-dao"))
    dependsOn(debikiCore ))

  lazy val debikiDaoPgsql =
    (Project("debiki-dao-pgsql", file("modules/debiki-dao-pgsql"))
    dependsOn(debikiCore, debikiTckDao % "test"))

  val appDependencies = Seq(
    "net.liftweb" %% "lift-common" % "2.4-M5",
    "net.liftweb" %% "lift-util" % "2.4-M5"
  )

  val main = PlayProject(appName, appVersion, appDependencies, mainLang = SCALA
    ).settings(
      // Add your own project settings here
    ).dependsOn(
      debikiCore, debikiDaoPgsql
    )

}
