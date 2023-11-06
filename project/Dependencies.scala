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

  object Play {
    val json = "com.typesafe.play" %% "play-json" % "2.9.4"

    // Play Framework 2.8.20 tries to use 1.5.1 but we want 1.5.2 because it uses
    // scala-xml v2.1.0, which avoids errors when using sbt 1.4+.
    // But they've messed up the server? Sbt tries to download from:
    //   https://scala-tools.org/repo-releases/com/typesafe/play/sbt-twirl...  but
    // scala-tools.org doesn't have a valid HTTPS cert and shows a "sorry isn't found" page.
    // val twirl = "com.typesafe.play" %% "sbt-twirl" % "1.5.2"
  }

  object Libs {

    // Scala / Java 11 compat, see: https://github.com/eed3si9n/scalaxb/issues/481
    //val jaxbApi = "javax.xml.bind" % "jaxb-api" % "2.3.1"

    // See: https://mvnrepository.com/artifact/org.postgresql/postgresql/
    // Upgr to: 42.2.14?   rm comment?? at  42.6 already
    //   https://github.com/pgjdbc/pgjdbc#maven-central
    //   https://github.com/pgjdbc/pgjdbc/blob/master/CHANGELOG.md
    //   Cool:  cancelQuery()  https://github.com/pgjdbc/pgjdbc/pull/1157
    //          e.g. stop bg queries that turns out weren't needed.
    //   supports Pg 11, 12.
    // Or switch to: https://github.com/impossibl/pgjdbc-ng/
    // supports listener-notify.
    // https://stackoverflow.com/questions/21632243/
    //        how-do-i-get-asynchronous-event-driven-listen-notify-support-in-java-using-a-p
    val postgresqlJbcdClient = "org.postgresql" % "postgresql" % "42.6.0"

    // Database migrations.
    val flywaydb = "org.flywaydb" % "flyway-core" % "5.0.7"   // scala-steward:off

    // HikariCP — "A solid high-performance JDBC connection pool at last"
    // Java 11 needs/can/should use "5.0.1". [java_8_to_11]
    val hikariCp = "com.zaxxer" % "HikariCP" % "5.0.1"

    // ElasticSearch client, in https://mvnrepository.com.
    // When upgrading to next major version, consider improving the mappings at the same
    // time? Change id fields from type integer to type keyword.  [es_kwd] [ty_v1]
    val elasticsearchClient = "org.elasticsearch" % "elasticsearch" % "6.8.23"
    val elasticsearchClientTransport = "org.elasticsearch.client" % "transport" % "6.8.23"

    val guava = "com.google.guava" % "guava" % "32.1.2-jre"

    val rediscala = "com.github.etaty" %% "rediscala" % "1.9.0"

    val apacheCommonsEmail = "org.apache.commons" % "commons-email" % "1.5"
    val apacheCommonsLang3 = "org.apache.commons" % "commons-lang3" % "3.13.0"

    // Does v1.25 recognize .woff and .woff2 file extensions? Then can remove
    // extra checks in module ty-core. [5AKR20]
    val apacheTika = "org.apache.tika" % "tika-core" % "2.9.0"

    val jsoup = "org.jsoup" % "jsoup" % "1.16.1"

    val jacksonModuleScala = "com.fasterxml.jackson.module" %% "jackson-module-scala" % "2.15.2"

    // ScribeJava, an OAuth lib, also works for OIDC (OpenID Connect).
    // ScribeJava is listed by Microsoft as compatible with Azure,
    // as of 2020-12-06 — so it's a somewhat well known lib.
    // (MS tested ScribeJava v3.2, most recent is v8.0.0, oh well.)
    // https://docs.microsoft.com/en-us/azure/active-directory/develop/reference-v2-libraries#compatible-client-libraries
    //
    // VENDOR_THIS — it'd be good to Maven-build via Makefile?
    val scribeJava = "com.github.scribejava" % "scribejava-apis" % "8.3.3"


    // ----- Logging

    // Logback 1.3 (and 1.2?) requires Java 8 at runtime,  1.4 Java 11.  [java_8_to_11]

    // Fluentd better understands json logs.
    // https://mvnrepository.com/artifact/ch.qos.logback/logback-classic

    /*
    // This:  [java_8_to_11]
    val logbackClassic = "ch.qos.logback" % "logback-classic" % "1.2.11"  // switch to "1.3.1" soon
    // and Java 11, results in:
    app_1      | SLF4J: No SLF4J providers were found.
    app_1      | SLF4J: Defaulting to no-operation (NOP) logger implementation
    app_1      | SLF4J: See http://www.slf4j.org/codes.html#noProviders for further details.
    app_1      | SLF4J: Class path contains SLF4J bindings targeting slf4j-api versions prior to 1.8.
    app_1      | SLF4J: Ignoring binding found at [jar:file:/home/owner/.cache/coursier/v1/https/repo1.maven.org/maven2/ch/qos/logback/logback-classic/1.2.11/logback-classic-1.2.11.jar!/org/slf4j/impl/StaticLoggerBinder.class]
    app_1      | SLF4J: See http://www.slf4j.org/codes.html#ignoredBindings for an explanation.
    */
    val logbackClassic = "ch.qos.logback" % "logback-classic" % "1.3.11"

    // https://mvnrepository.com/artifact/ch.qos.logback/logback-core
    // 1.3.x is for Java EE, 1.4.x is for Jakarta (which I don't think we use), otherwise identical.
    val logbackCore = "ch.qos.logback" % "logback-core" % "1.3.11"

    // Docs: https://github.com/logstash/logstash-logback-encoder/tree/logstash-logback-encoder-4.9
    val logstashLogbackEncoder = "net.logstash.logback" % "logstash-logback-encoder" % "7.4"
    //"org.kurochan" %% "logback-stackdriver-logging" % "0.0.1",


    // ----- Metrics, tracing

    val metricsCore = "io.dropwizard.metrics" % "metrics-core" % "4.2.22"

    // Deprecated. SHOULD migrate to OpenTelemetry, they say, https://opentelemetry.io/.
    // 1.8.1 exists now.
    val jaegertracing = "io.jaegertracing" % "jaeger-client" % "0.35.5"   // scala-steward:off

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
    val auth0JavaJwt = "com.auth0" % "java-jwt" % "4.4.0"


    // ----- PASETO tokens

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


    // ----- Test

    val scalactic = "org.scalactic" %% "scalactic" % "3.2.17"
    val scalaTest = "org.scalatest" %% "scalatest" % "3.2.17" % "test"
    val scalaTestPlusPlay = "org.scalatestplus.play" %% "scalatestplus-play" % "5.1.0" % Test

    // Don't use, migrate to ScalaTest instead, some day.
    val specs2 = "org.specs2" %% "specs2-core" % "3.10.0" % "test"  // scala-steward:off
  }

}
