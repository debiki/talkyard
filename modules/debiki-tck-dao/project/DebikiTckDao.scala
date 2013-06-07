import sbt._
import sbt.Keys._

object DebikiTckDao extends Build {

  lazy val submTckDao = Project("root", file(".")) dependsOn(submCore)
  lazy val submCore = RootProject(file("../debiki-core"))

}

// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
