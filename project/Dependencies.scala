import sbt._

// Find dependencies to upgrade: In the sbt shell, run:  dependencyUpdates
// Show deps tree: Run:  dependencyTree

// The objects here are made available in all build.sbt files,
// that is,  <root>/.build.sbt  and  modules/{ty-core,ty-dao-rdb}/build.sbt.
//
// So can change version numbers of dependencies here, at just one place.

object ProjectDirectory {
  val versionFileContents = {
    // [Scala_213] Using(...) { ... }
    val source = scala.io.Source.fromFile("version.txt")
    try source.mkString.trim
    finally source.close()
  }
}

object Dependencies {

  object Tools {
    // SalaFix plugin, https://github.com/scala/scala-collection-compat/releases [scala_2_13]
    // Also comment in: [scalafix_build_setting]?
    //val scalaCollectionCompat =
    //      "org.scala-lang.modules" %% "scala-collection-compat" % "2.13.0"
  }

  object Play {
    val json = "org.playframework" %% "play-json" % "3.0.4"
  }

  object Libs {

    // Scala / Java 11 compat, see: https://github.com/eed3si9n/scalaxb/issues/481
    //val jaxbApi = "javax.xml.bind" % "jaxb-api" % "2.3.1"

    // See: https://mvnrepository.com/artifact/org.postgresql/postgresql/
    //   https://github.com/pgjdbc/pgjdbc#maven-central
    //   https://github.com/pgjdbc/pgjdbc/blob/master/CHANGELOG.md
    //   Cool:  cancelQuery()  https://github.com/pgjdbc/pgjdbc/pull/1157
    //          e.g. stop bg queries that turns out weren't needed.
    //   supports Pg 11, 12.
    // Or switch to: https://github.com/impossibl/pgjdbc-ng/
    // supports listener-notify.
    // https://stackoverflow.com/questions/21632243/
    //        how-do-i-get-asynchronous-event-driven-listen-notify-support-in-java-using-a-p
    val postgresqlJbcdClient = "org.postgresql" % "postgresql" % "42.7.5"

    // Database migrations.
    // Let's stop at 5.x. Avoid v6, they did a total rewrite of the SQL parser,
    // https://www.red-gate.com/blog/flyway-6-0-0-released:
    //    > The SQL parser has been completely rebuilt from the ground up".
    //
    // But also:
    //    > the first production release with support for: PostgreSQL 11 and 12"
    // So, need to do sometimes-risky-upgrades, to get support for the latest PostgreSQL
    // versions?
    //
    // Let's start using Diesel instead? https://docs.diesel.rs  [upgr_pg]
    // As a command line tool, from a Docker container.
    // It's fully open source, incl down migrations (helpful during developent),
    // and more transparent — f.ex. Flyway stores their release notes at their website
    // (instead of GitHub), but some old ones about 5.x have disappeared, I can find only
    // the >= 6.x release notes. But Diesel is fully open source, everything at GitHub.
    // I'm using Diesel in a Typescript + PostgreSQL project, and it works fine.
    val flywaydb = "org.flywaydb" % "flyway-core" % "5.2.4"   // scala-steward:off

    // HikariCP — "A solid high-performance JDBC connection pool at last"
    val hikariCp = "com.zaxxer" % "HikariCP" % "6.3.0"

    // ElasticSearch client, in https://mvnrepository.com.
    // When upgrading to next major version, consider improving the mappings at the same
    // time? Change id fields from type integer to type keyword.  [es_kwd] [ty_v1]
    val elasticsearchClient = "org.elasticsearch" % "elasticsearch" % "9.0.2"
    val elasticsearchClientTransport = "org.elasticsearch.client" % "transport" % "6.8.23"

    val guava = "com.google.guava" % "guava" % "33.4.6-jre"
    val findbugsJsr304 = "com.google.code.findbugs" % "jsr305" % "3.0.2" % "provided"

    val rediscala = "com.github.etaty" %% "rediscala" % "1.9.0"

    // See: https://commons.apache.org/proper/commons-codec/changes.html
    val apacheCommonsCodec = "commons-codec" % "commons-codec" % "1.18.0"

    // See: https://commons.apache.org/proper/commons-validator/changes-report.html
    val apacheCommonsValidator = "commons-validator" % "commons-validator" % "1.9.0"

    // See: https://commons.apache.org/proper/commons-email/changes-report.html
    val apacheCommonsEmail = "org.apache.commons" % "commons-email" % "1.6.0"

    // See: https://commons.apache.org/proper/commons-lang/changes-report.html
    val apacheCommonsLang3 = "org.apache.commons" % "commons-lang3" % "3.17.0"

    // Does v1.25 recognize .woff and .woff2 file extensions? Then can remove
    // extra checks in module ty-core. [5AKR20]
    // Latest version is 3.0.0, let's wait, just some weeks ago.
    // See: https://tika.apache.org
    // Need to upgrade soon, DO_BEFORE 2025-04-01,
    //    see: https://tika.apache.org/3.0.0-BETA/index.html
    val apacheTika = "org.apache.tika" % "tika-core" % "2.9.3"

    // See: https://github.com/OWASP/owasp-java-encoder/releases
    val owaspEncoder = "org.owasp.encoder" % "encoder" % "1.3.1"

    // See: https://github.com/jhy/jsoup/releases
    val jsoup = "org.jsoup" % "jsoup" % "1.19.1"

    // See: https://github.com/FasterXML/jackson-module-scala/tags
    // and: https://mvnrepository.com/artifact/com.fasterxml.jackson.module/jackson-module-scala
    val jacksonModuleScala = "com.fasterxml.jackson.module" %% "jackson-module-scala" % "2.18.3"

    // ScribeJava, an OAuth lib, also works for OIDC (OpenID Connect).
    // ScribeJava is listed by Microsoft as compatible with Azure,
    // as of 2020-12-06 — so it's a somewhat well known lib.
    // (MS tested ScribeJava v3.2, most recent is v8.0.0, oh well.)
    // https://docs.microsoft.com/en-us/azure/active-directory/develop/reference-v2-libraries#compatible-client-libraries
    //
    // See: https://github.com/scribejava/scribejava/releases
    // and: https://mvnrepository.com/artifact/com.github.scribejava/scribejava-core
    // VENDOR_THIS — it'd be good to Maven-build via Makefile?
    val scribeJava = "com.github.scribejava" % "scribejava-apis" % "8.3.3"


    // ----- Logging

    // Logback 1.3 (and 1.2?) requires Java 8 at runtime,  1.4 and 1.5 Java 11.  [java_8_to_11]
    // 1.3.x is for Java EE. 1.4.x and 1.5.x is for Jakarta, doesn't matter?
    // Ty uses none of Java EE and Jakarta. — Seems 1.5 is indeed the one recommended:
    //
    // https://logback.qos.ch/download.html
    // STABLE version (ACTIVELY DEVELOPED)
    // The current actively developed version of logback supporting Jakarta EE
    // (jakarta.* namespace) is 1.5.12. It requires JDK 11 and SLF4J version 2.0.1 at runtime. …
    // Older stable versions (INACTIVE)
    // • Logback version 1.4.14 … supports Jakarta EE … requires … JDK 11. … no loger actively developed.
    // • Logback version 1.3.14 …  supports Java EE (java.*… requires … JDK 8. … no loger actively developed.

    // Fluentd better understands json logs.
    // https://mvnrepository.com/artifact/ch.qos.logback/logback-classic
    val logbackClassic = "ch.qos.logback" % "logback-classic" % "1.5.18"

    // https://mvnrepository.com/artifact/ch.qos.logback/logback-core
    val logbackCore = "ch.qos.logback" % "logback-core" % "1.5.18"

    // See: https://github.com/logfellow/logstash-logback-encoder/releases
    // and: https://mvnrepository.com/artifact/net.logstash.logback/logstash-logback-encoder
    val logstashLogbackEncoder = "net.logstash.logback" % "logstash-logback-encoder" % "8.0"
    //"org.kurochan" %% "logback-stackdriver-logging" % "0.0.1",

    // The ElasticSearch client uses Log4j. log4j-api already included, but not -core.
    // (Versions <= 2.17.0 are vulnerable.)
    //  log4jApi  = "org.apache.logging.log4j" % "log4j-api" % "..."   // not needed
    val log4jCore = "org.apache.logging.log4j" % "log4j-core" % "2.17.2"  // needed


    // ----- Metrics, tracing

    // See: https://github.com/dropwizard/metrics/releases
    // and: https://metrics.dropwizard.io/4.2.0/manual/core.html
    // and: https://mvnrepository.com/artifact/io.dropwizard.metrics/metrics-core
    val metricsCore = "io.dropwizard.metrics" % "metrics-core" % "4.2.30"

    // Deprecated. SHOULD migrate to OpenTelemetry, they say, https://opentelemetry.io/.
    // 1.8.1 exists now.
    val jaegertracing = "io.jaegertracing" % "jaeger-client" % "0.35.5"   // scala-steward:off

    // See: https://mvnrepository.com/artifact/nl.grons/metrics4-scala
    // and: https://github.com/erikvanoosten/metrics-scala/tags
    val metrics4Scala = "nl.grons" %% "metrics4-scala" % "4.2.9"


    // ----- Decoding JWT:s

    // Use which lib? Here's a list: https://jwt.io
    // - There's: https://github.com/jwtk/jjwt by Okta but not easy to find in
    //   the very long readme how to just decode a JWT one got straight
    //   from a trusted server?
    // - And: https://github.com/vert-x3/vertx-auth/tree/master/vertx-auth-jwt
    //   but seems not-so-easy to use and partly depends on Vertx?
    //   https://vertx.io/docs/apidocs/io/vertx/ext/auth/jwt/JWTAuth.html
    //   — very brief Javadoc, and wants a io.vertx.core.Vertx sometimes.
    // - Quarkus (a new Java web framework, on GraalVM) uses  quarkus-oidc,
    //   https://github.com/quarkusio/quarkus-quickstarts
    //   https://github.com/quarkusio/quarkus/blob/cc08b76c58dba74d8a6216cc8f09b09ab7f2fd08/extensions/oidc/runtime/pom.xml
    //   <artifactId>quarkus-oidc</artifactId>
    //   which uses this jwt lib I never saw mentioned anywhere:
    //    https://github.com/smallrye/smallrye-jwt/network/dependents?package_id=UGFja2FnZS0zNDIxNDY3MzA%3D
    //    https://smallrye.io   they mention Quarkus and "Thorntail" and "Open liberty"
    //    Not that much activity: https://groups.google.com/g/smallrye
    //
    // Let's use Java-JWT. It's well-known and its readme has a simple decoding example.
    // Repo: https://github.com/auth0/java-jwt
    // and: https://mvnrepository.com/artifact/com.auth0/java-jwt
    val auth0JavaJwt = "com.auth0" % "java-jwt" % "4.5.0"


    // ----- PASETO tokens

    // See: https://mvnrepository.com/artifact/dev.paseto   for all  dev.paseto.*

    val jpasetoApi = "dev.paseto" % "jpaseto-api" % "0.7.0"  // compile time (default)
    val jpasetoImpl = "dev.paseto" % "jpaseto-impl" % "0.7.0" // % "runtime"

    // Dependency Hell: Cannot use jpaseto-jackson (and we don't need it, fortunately) —
    // it depends on jackson-databind:2.11.2, but other modules require 2.10.*.
    //val jpasetoJackson = "dev.paseto" % "jpaseto-jackson" % "0.6.0" //% "runtime"
    // But Gson works, no conflict:
    val jpasetoGson = "dev.paseto" % "jpaseto-gson" % "0.7.0" //% "runtime"

    // Needed for v2.local. Also needs OS native lib sodium.
    val jpasetoSodium = "dev.paseto" % "jpaseto-sodium" % "0.7.0"

    // Needed for v2.public, in Java 8:
    // But the BouncyCastle docs are not nice to read, plus ads.
    // Upgr to Java 11, so won't need to read.
    //val jpasetoBouncyCastle = "dev.paseto" % "jpaseto-bouncy-castle" % "0.7.0" //% "runtime"
    //val bouncyCastle = "org.bouncycastle" % "bcprov-jdk15to18" % "1.68"

    // For v2.public — cannot get this working though.
    // https://mvnrepository.com/artifact/net.i2p.crypto/eddsa
    // https://github.com/str4d/ed25519-java
    // val edsaCryptoAlg = "net.i2p.crypto" % "eddsa" % "0.3.0"


    // ----- Crypto

    // See: https://github.com/wg/scrypt ?
    // and: https://mvnrepository.com/artifact/com.lambdaworks/scrypt
    val lambdaworksScrypt = "com.lambdaworks" % "scrypt" % "1.4.0"


    // ----- Test

    val scalactic = "org.scalactic" %% "scalactic" % "3.2.19"
    val scalaTest = "org.scalatest" %% "scalatest" % "3.2.19" % "test"

    // See: https://github.com/playframework/scalatestplus-play/releases
    // and: https://mvnrepository.com/artifact/org.scalatestplus.play/scalatestplus-play
    // v6 is for Play 2.9, v7 for Play 3.0.
    val scalaTestPlusPlay = "org.scalatestplus.play" %% "scalatestplus-play" % "6.0.1" % Test

    // Don't use, migrate to ScalaTest instead, some day.
    val specs2 = "org.specs2" %% "specs2-core" % "4.20.9" % "test"
    val mockito = "org.mockito" % "mockito-all" % "1.10.19" % "test"
  }

}
