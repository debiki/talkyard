// DON'T EDIT THIS FILE.
// This file is auto generated by sbt-lock 0.8.0.
// https://github.com/tkawachi/sbt-lock/
Compile / dependencyOverrides ++= {
  if (!(ThisBuild / sbtLockHashIsUpToDate).value && sbtLockIgnoreOverridesOnStaleHash.value) {
    Seq.empty
  } else {
    Seq(
      "com.fasterxml.jackson.core" % "jackson-annotations" % "2.11.4",
      "com.fasterxml.jackson.core" % "jackson-core" % "2.11.4",
      "com.fasterxml.jackson.core" % "jackson-databind" % "2.11.4",
      "com.fasterxml.jackson.datatype" % "jackson-datatype-jdk8" % "2.11.4",
      "com.fasterxml.jackson.datatype" % "jackson-datatype-jsr310" % "2.11.4",
      "com.google.code.findbugs" % "jsr305" % "3.0.2",
      "com.google.errorprone" % "error_prone_annotations" % "2.18.0",
      "com.google.guava" % "failureaccess" % "1.0.1",
      "com.google.guava" % "guava" % "32.1.2-jre",
      "com.google.guava" % "listenablefuture" % "9999.0-empty-to-avoid-conflict-with-guava",
      "com.google.j2objc" % "j2objc-annotations" % "2.8",
      "com.lambdaworks" % "scrypt" % "1.4.0",
      "com.sun.mail" % "javax.mail" % "1.5.6",
      "com.typesafe.play" % "play-functional_2.12" % "2.9.4",
      "com.typesafe.play" % "play-json_2.12" % "2.10.1",
      "commons-beanutils" % "commons-beanutils" % "1.9.4",
      "commons-codec" % "commons-codec" % "1.16.0",
      "commons-collections" % "commons-collections" % "3.2.2",
      "commons-digester" % "commons-digester" % "2.1",
      "commons-io" % "commons-io" % "2.13.0",
      "commons-logging" % "commons-logging" % "1.2",
      "commons-validator" % "commons-validator" % "1.7",
      "javax.activation" % "activation" % "1.1",
      "nu.validator.htmlparser" % "htmlparser" % "1.4",
      "org.apache.commons" % "commons-email" % "1.5",
      "org.apache.tika" % "tika-core" % "2.9.0",
      "org.checkerframework" % "checker-qual" % "3.33.0",
      "org.owasp.encoder" % "encoder" % "1.2.3",
      "org.scalactic" % "scalactic_2.12" % "3.2.17",
      "org.slf4j" % "slf4j-api" % "2.0.7"
    )
  }
}
// LIBRARY_DEPENDENCIES_HASH 031659805e1e75156e365813e5add1dce1cba76e
