import sbt._

class DebikiTckDao(info: ProjectInfo) extends DefaultProject(info) {

  // Add Maven Local repository for SBT to search for
  val mavenLocal =
    "Local Maven Repository" at "file://"+Path.userHome+"/.m2/repository"

  // Dependencies
  val v = "2.8.1" // scala version
  val d79 = "net.liftweb" % ("lift-common_"+ v) % "2.2"
  val d52 = "net.liftweb" % ("lift-util_"+ v) % "2.2"
  val d95 = "junit" % "junit" % "4.7"
  val d12 = "org.scala-tools.testing" % ("specs_"+ v) % "1.6.6"

  // Sub modules
  lazy val submCore = project(Path.fromFile("../debiki-core"))
}

// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
