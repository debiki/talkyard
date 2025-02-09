name := "ty-model"

organization := "com.debiki"

version := ProjectDirectory.versionFileContents

// Apparently needed for SBT dependencyTree, see plugins.sbt.  [dependencyTree_dependency]
resolvers += "Scala-Tools Maven2 Repository" at "https://scala-tools.org/repo-releases"

libraryDependencies ++= Seq(
  Dependencies.Libs.scalactic,
  Dependencies.Libs.guava,
  Dependencies.Libs.apacheCommonsCodec,
  Dependencies.Libs.apacheCommonsValidator,
  Dependencies.Libs.apacheCommonsEmail,  // needed here for email address validation only
  Dependencies.Libs.apacheTika,
  Dependencies.Libs.owaspEncoder,
  Dependencies.Play.json,
  // COULD move to the server module?  [mv_scrypt_2_srv]
  Dependencies.Libs.lambdaworksScrypt,
  // CLEAN_UP remove Mockito and Spec2. Use only ScalaTest, need to edit some tests.
  Dependencies.Libs.mockito,
  Dependencies.Libs.specs2,
  Dependencies.Libs.scalaTest,
)

compileOrder := CompileOrder.JavaThenScala
