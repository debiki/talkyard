import sbt._

// The objects here are made available in all build.sbt files,
// that is,  <root>/.build.sbt  and  modules/{ty-core,ty-dao-rdb}/build.sbt.
//
// So can change version numbers of dependencies here, at just one place.


object Dependencies {

  object Play {
    val json = "com.typesafe.play" %% "play-json" % "2.8.1"
  }

  object Libs {
    // See: https://mvnrepository.com/artifact/org.postgresql/postgresql/
    val postgresqlJbcdClient = "org.postgresql" % "postgresql" % "42.2.4"

    // Database migrations.
    val flywaydb = "org.flywaydb" % "flyway-core" % "5.0.7"

    val guava = "com.google.guava" % "guava" % "28.1-jre"

    val apacheCommonsEmail = "org.apache.commons" % "commons-email" % "1.5"
    val apacheTika = "org.apache.tika" % "tika-core" % "1.18"    // for username .ext test, sync w core [5AKR20]

    // OAuth lib, also works for OIDC (OpenID Connect).
    // VENDOR_THIS — it'd be good to Maven-build via Makefile?
    val scribeJava = "com.github.scribejava" % "scribejava-apis" % "6.9.0"
        
    // Not v 3.1.2?
    val scalactic = "org.scalactic" %% "scalactic" % "3.1.1"
    val scalaTest = "org.scalatest" %% "scalatest" % "3.1.1" % "test"
    val scalaTestPlusPlay = "org.scalatestplus.play" %% "scalatestplus-play" % "3.1.2" % Test

    // Don't use, migrate to ScalaTest instead, some day.
    val specs2 = "org.specs2" %% "specs2-core" % "3.9.4" % "test"
  }

}
