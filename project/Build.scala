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
    "com.amazonaws" % "aws-java-sdk" % "1.3.4"
  )

  val main = PlayProject(appName, appVersion, appDependencies, mainLang = SCALA
    ).settings(
      // Add your own project settings here
    ).dependsOn(
      debikiCore, debikiDaoPgsql
    )

  // Show unchecked and deprecated warnings, in this project and all
  // its modules.
  // scalacOptions in ThisBuild ++= Seq("-deprecation")

}
