import sbt._

// Dependencies Silhouette needs, vendors/silhouette/project/Dependencies.scala
// change later to Ty's deps.

object Dependencies {
  object Library {

    object Play {
      val version = play.core.PlayVersion.current
      val ws = "com.typesafe.play" %% "play-ws" % version
      val cache = "com.typesafe.play" %% "play-cache" % version
      val test = "com.typesafe.play" %% "play-test" % version
      val specs2 = "com.typesafe.play" %% "play-specs2" % version
      val openid = "com.typesafe.play" %% "play-openid" % version
      val jsonJoda = "com.typesafe.play" %% "play-json-joda" % "2.7.4"
    }

    object Specs2 {
      private val version = "4.5.1"
      val core = "org.specs2" %% "specs2-core" % version
      val matcherExtra = "org.specs2" %% "specs2-matcher-extra" % version
      val mock = "org.specs2" %% "specs2-mock" % version
    }

    val jbcrypt = "de.svenkubiak" % "jBCrypt" % "0.4.1"
    val jwtCore = "com.atlassian.jwt" % "jwt-core" % "2.0.5"
    val jwtApi = "com.atlassian.jwt" % "jwt-api" % "2.0.5"
    val scalaGuice = "net.codingwell" %% "scala-guice" % "4.2.5"
    val akkaTestkit = "com.typesafe.akka" %% "akka-testkit" % "2.6.3"
    val casClient = "org.jasig.cas.client" % "cas-client-core" % "3.4.1"
    val casClientSupportSAML = "org.jasig.cas.client" % "cas-client-support-saml" % "3.4.1"
    val apacheCommonLang = "org.apache.commons" % "commons-lang3" % "3.8.1"
    val googleAuth = "com.warrenstrange" % "googleauth" % "1.2.0"
  }
}
