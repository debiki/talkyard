// DON'T EDIT THIS FILE.
// This file is auto generated by sbt-lock 0.8.0.
// https://github.com/tkawachi/sbt-lock/
Compile / dependencyOverrides ++= {
  if (!(ThisBuild / sbtLockHashIsUpToDate).value && sbtLockIgnoreOverridesOnStaleHash.value) {
    Seq.empty
  } else {
    Seq(
      "ch.qos.logback" % "logback-classic" % "1.3.6",
      "ch.qos.logback" % "logback-core" % "1.3.6",
      "com.auth0" % "java-jwt" % "4.4.0",
      "com.carrotsearch" % "hppc" % "0.7.1",
      "com.fasterxml.jackson.core" % "jackson-annotations" % "2.15.1",
      "com.fasterxml.jackson.core" % "jackson-core" % "2.15.1",
      "com.fasterxml.jackson.core" % "jackson-databind" % "2.15.1",
      "com.fasterxml.jackson.dataformat" % "jackson-dataformat-cbor" % "2.11.4",
      "com.fasterxml.jackson.dataformat" % "jackson-dataformat-smile" % "2.8.11",
      "com.fasterxml.jackson.dataformat" % "jackson-dataformat-yaml" % "2.8.11",
      "com.fasterxml.jackson.datatype" % "jackson-datatype-jdk8" % "2.11.4",
      "com.fasterxml.jackson.datatype" % "jackson-datatype-jsr310" % "2.11.4",
      "com.fasterxml.jackson.module" % "jackson-module-parameter-names" % "2.11.4",
      "com.fasterxml.jackson.module" % "jackson-module-scala_2.12" % "2.15.1",
      "com.github.ben-manes.caffeine" % "caffeine" % "2.8.8",
      "com.github.ben-manes.caffeine" % "jcache" % "2.8.8",
      "com.github.etaty" % "rediscala_2.12" % "1.9.0",
      "com.github.jnr" % "jffi" % "1.2.17",
      "com.github.jnr" % "jnr-a64asm" % "1.0.0",
      "com.github.jnr" % "jnr-ffi" % "2.1.9",
      "com.github.jnr" % "jnr-x86asm" % "1.0.2",
      "com.github.scribejava" % "scribejava-apis" % "8.3.3",
      "com.github.scribejava" % "scribejava-core" % "8.3.3",
      "com.github.scribejava" % "scribejava-java8" % "8.3.3",
      "com.github.spullara.mustache.java" % "compiler" % "0.9.3",
      "com.google.code.findbugs" % "jsr305" % "3.0.2",
      "com.google.code.gson" % "gson" % "2.8.8",
      "com.google.errorprone" % "error_prone_annotations" % "2.11.0",
      "com.google.guava" % "failureaccess" % "1.0.1",
      "com.google.guava" % "guava" % "31.1-jre",
      "com.google.guava" % "listenablefuture" % "9999.0-empty-to-avoid-conflict-with-guava",
      "com.google.j2objc" % "j2objc-annotations" % "1.3",
      "com.lambdaworks" % "scrypt" % "1.4.0",
      "com.squareup.okhttp3" % "okhttp" % "3.9.0",
      "com.squareup.okio" % "okio" % "1.13.0",
      "com.sun.mail" % "javax.mail" % "1.5.6",
      "com.tdunning" % "t-digest" % "3.2",
      "com.thoughtworks.paranamer" % "paranamer" % "2.8",
      "com.typesafe" % "config" % "1.4.2",
      "com.typesafe" % "ssl-config-core_2.12" % "0.4.3",
      "com.typesafe.akka" % "akka-actor-typed_2.12" % "2.6.20",
      "com.typesafe.akka" % "akka-actor_2.12" % "2.6.20",
      "com.typesafe.akka" % "akka-http-core_2.12" % "10.1.15",
      "com.typesafe.akka" % "akka-parsing_2.12" % "10.1.15",
      "com.typesafe.akka" % "akka-protobuf-v3_2.12" % "2.6.20",
      "com.typesafe.akka" % "akka-serialization-jackson_2.12" % "2.6.20",
      "com.typesafe.akka" % "akka-slf4j_2.12" % "2.6.20",
      "com.typesafe.akka" % "akka-stream_2.12" % "2.6.20",
      "com.typesafe.play" % "build-link" % "2.8.19",
      "com.typesafe.play" % "cachecontrol_2.12" % "2.0.0",
      "com.typesafe.play" % "filters-helpers_2.12" % "2.8.19",
      "com.typesafe.play" % "play-ahc-ws-standalone_2.12" % "2.1.10",
      "com.typesafe.play" % "play-ahc-ws_2.12" % "2.8.19",
      "com.typesafe.play" % "play-akka-http-server_2.12" % "2.8.19",
      "com.typesafe.play" % "play-cache_2.12" % "2.8.19",
      "com.typesafe.play" % "play-caffeine-cache_2.12" % "2.8.19",
      "com.typesafe.play" % "play-exceptions" % "2.8.19",
      "com.typesafe.play" % "play-functional_2.12" % "2.9.4",
      "com.typesafe.play" % "play-json_2.12" % "2.9.4",
      "com.typesafe.play" % "play-server_2.12" % "2.8.19",
      "com.typesafe.play" % "play-streams_2.12" % "2.8.19",
      "com.typesafe.play" % "play-ws-standalone-json_2.12" % "2.1.10",
      "com.typesafe.play" % "play-ws-standalone-xml_2.12" % "2.1.10",
      "com.typesafe.play" % "play-ws-standalone_2.12" % "2.1.10",
      "com.typesafe.play" % "play-ws_2.12" % "2.8.19",
      "com.typesafe.play" % "play_2.12" % "2.8.19",
      "com.typesafe.play" % "shaded-asynchttpclient" % "2.1.10",
      "com.typesafe.play" % "shaded-oauth" % "2.1.10",
      "com.typesafe.play" % "twirl-api_2.12" % "1.5.1",
      "com.zaxxer" % "HikariCP" % "5.0.1",
      "commons-beanutils" % "commons-beanutils" % "1.9.4",
      "commons-codec" % "commons-codec" % "1.15",
      "commons-collections" % "commons-collections" % "3.2.2",
      "commons-digester" % "commons-digester" % "2.1",
      "commons-io" % "commons-io" % "2.11.0",
      "commons-logging" % "commons-logging" % "1.2",
      "commons-validator" % "commons-validator" % "1.7",
      "dev.paseto" % "jpaseto-api" % "0.7.0",
      "dev.paseto" % "jpaseto-gson" % "0.7.0",
      "dev.paseto" % "jpaseto-impl" % "0.7.0",
      "dev.paseto" % "jpaseto-sodium" % "0.7.0",
      "io.dropwizard.metrics" % "metrics-core" % "4.2.18",
      "io.dropwizard.metrics" % "metrics-healthchecks" % "4.2.9",
      "io.jaegertracing" % "jaeger-client" % "0.35.5",
      "io.jaegertracing" % "jaeger-core" % "0.35.5",
      "io.jaegertracing" % "jaeger-thrift" % "0.35.5",
      "io.jaegertracing" % "jaeger-tracerresolver" % "0.35.5",
      "io.jsonwebtoken" % "jjwt" % "0.9.1",
      "io.netty" % "netty-buffer" % "4.1.32.Final",
      "io.netty" % "netty-codec" % "4.1.32.Final",
      "io.netty" % "netty-codec-http" % "4.1.32.Final",
      "io.netty" % "netty-common" % "4.1.32.Final",
      "io.netty" % "netty-handler" % "4.1.32.Final",
      "io.netty" % "netty-resolver" % "4.1.32.Final",
      "io.netty" % "netty-transport" % "4.1.32.Final",
      "io.opentracing" % "opentracing-api" % "0.32.0",
      "io.opentracing" % "opentracing-noop" % "0.32.0",
      "io.opentracing" % "opentracing-util" % "0.32.0",
      "io.opentracing.contrib" % "opentracing-tracerresolver" % "0.1.6",
      "jakarta.activation" % "jakarta.activation-api" % "1.2.2",
      "jakarta.transaction" % "jakarta.transaction-api" % "1.3.3",
      "jakarta.xml.bind" % "jakarta.xml.bind-api" % "2.3.3",
      "javax.activation" % "activation" % "1.1",
      "javax.cache" % "cache-api" % "1.1.1",
      "javax.inject" % "javax.inject" % "1",
      "joda-time" % "joda-time" % "2.10.10",
      "net.logstash.logback" % "logstash-logback-encoder" % "7.3",
      "net.sf.jopt-simple" % "jopt-simple" % "5.0.2",
      "nl.grons" % "metrics4-scala_2.12" % "4.2.9",
      "nu.validator.htmlparser" % "htmlparser" % "1.4",
      "org.apache.commons" % "commons-email" % "1.5",
      "org.apache.commons" % "commons-lang3" % "3.12.0",
      "org.apache.httpcomponents" % "httpasyncclient" % "4.1.2",
      "org.apache.httpcomponents" % "httpclient" % "4.5.2",
      "org.apache.httpcomponents" % "httpcore" % "4.4.5",
      "org.apache.httpcomponents" % "httpcore-nio" % "4.4.5",
      "org.apache.logging.log4j" % "log4j-api" % "2.17.1",
      "org.apache.lucene" % "lucene-analyzers-common" % "7.7.3",
      "org.apache.lucene" % "lucene-backward-codecs" % "7.7.3",
      "org.apache.lucene" % "lucene-core" % "7.7.3",
      "org.apache.lucene" % "lucene-grouping" % "7.7.3",
      "org.apache.lucene" % "lucene-highlighter" % "7.7.3",
      "org.apache.lucene" % "lucene-join" % "7.7.3",
      "org.apache.lucene" % "lucene-memory" % "7.7.3",
      "org.apache.lucene" % "lucene-misc" % "7.7.3",
      "org.apache.lucene" % "lucene-queries" % "7.7.3",
      "org.apache.lucene" % "lucene-queryparser" % "7.7.3",
      "org.apache.lucene" % "lucene-sandbox" % "7.7.3",
      "org.apache.lucene" % "lucene-spatial" % "7.7.3",
      "org.apache.lucene" % "lucene-spatial-extras" % "7.7.3",
      "org.apache.lucene" % "lucene-spatial3d" % "7.7.3",
      "org.apache.lucene" % "lucene-suggest" % "7.7.3",
      "org.apache.thrift" % "libthrift" % "0.12.0",
      "org.apache.tika" % "tika-core" % "2.8.0",
      "org.apache.tuweni" % "tuweni-bytes" % "0.10.0",
      "org.apache.tuweni" % "tuweni-crypto" % "0.10.0",
      "org.apache.tuweni" % "tuweni-io" % "0.10.0",
      "org.apache.tuweni" % "tuweni-units" % "0.10.0",
      "org.checkerframework" % "checker-qual" % "3.12.0",
      "org.elasticsearch" % "elasticsearch" % "8.8.2",
      "org.elasticsearch" % "elasticsearch-cli" % "6.8.23",
      "org.elasticsearch" % "elasticsearch-core" % "6.8.23",
      "org.elasticsearch" % "elasticsearch-secure-sm" % "6.8.23",
      "org.elasticsearch" % "elasticsearch-ssl-config" % "6.8.23",
      "org.elasticsearch" % "elasticsearch-x-content" % "6.8.23",
      "org.elasticsearch" % "jna" % "5.5.0",
      "org.elasticsearch.client" % "elasticsearch-rest-client" % "6.8.23",
      "org.elasticsearch.client" % "transport" % "6.8.23",
      "org.elasticsearch.plugin" % "lang-mustache-client" % "6.8.23",
      "org.elasticsearch.plugin" % "parent-join-client" % "6.8.23",
      "org.elasticsearch.plugin" % "percolator-client" % "6.8.23",
      "org.elasticsearch.plugin" % "rank-eval-client" % "6.8.23",
      "org.elasticsearch.plugin" % "reindex-client" % "6.8.23",
      "org.elasticsearch.plugin" % "transport-netty4-client" % "6.8.23",
      "org.flywaydb" % "flyway-core" % "5.0.7",
      "org.hdrhistogram" % "HdrHistogram" % "2.1.9",
      "org.jsoup" % "jsoup" % "1.16.1",
      "org.lz4" % "lz4-java" % "1.8.0",
      "org.osgi" % "org.osgi.service.component.annotations" % "1.4.0",
      "org.ow2.asm" % "asm" % "5.0.3",
      "org.ow2.asm" % "asm-analysis" % "5.0.3",
      "org.ow2.asm" % "asm-commons" % "5.0.3",
      "org.ow2.asm" % "asm-tree" % "5.0.3",
      "org.ow2.asm" % "asm-util" % "5.0.3",
      "org.owasp.encoder" % "encoder" % "1.2.3",
      "org.postgresql" % "postgresql" % "42.5.4",
      "org.reactivestreams" % "reactive-streams" % "1.0.3",
      "org.scala-lang.modules" % "scala-java8-compat_2.12" % "0.9.1",
      "org.scala-lang.modules" % "scala-parser-combinators_2.12" % "1.1.2",
      "org.scala-lang.modules" % "scala-xml_2.12" % "1.2.0",
      "org.scala-stm" % "scala-stm_2.12" % "0.9.1",
      "org.scalactic" % "scalactic_2.12" % "3.2.16",
      "org.slf4j" % "jcl-over-slf4j" % "1.7.36",
      "org.slf4j" % "jul-to-slf4j" % "1.7.36",
      "org.slf4j" % "slf4j-api" % "2.0.7",
      "org.yaml" % "snakeyaml" % "1.17"
    )
  }
}
// LIBRARY_DEPENDENCIES_HASH 1d8857cfedb2b632c40fc15210e7161950584144
