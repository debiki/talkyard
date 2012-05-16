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
    "com.amazonaws" % "aws-java-sdk" % "1.3.4",
    "com.google.guava" % "guava" % "10.0.1"
  )

  val main = PlayProject(appName, appVersion, appDependencies, mainLang = SCALA
    ).settings(
      mainSettings: _*
    ).dependsOn(
      debikiCore, debikiDaoPgsql
    )


  def mainSettings = List(
    compileRhinoTask := { compileRhinoImpl() },
    // SBT ignores this:
    fullClasspath in Compile +=
       Attributed.blank(file(rhinoClassDir)),
    Keys.compile in Compile <<=
       (Keys.compile in Compile).dependsOn(compileRhinoTask))

  // Cannot use, because SBT ignores above classpath elem addition:
  //val rhinoClassDir = "target/scala-2.9.1/compiledjs/classes/"
  // Instead:
  val rhinoClassDir = "target/scala-2.9.1/classes/"

  def compileRhinoTask = TaskKey[Unit]("compile-js",
    "Invokes Rhino to compile Javascript to Java bytecode")


  def compileRhinoImpl() {
    val jsSourceDir = "modules/debiki-core/src/main/resources/toserve/js/"

    def compileJavaInterfaceCmd(interfaceFileName: String): String =
       "javac app/compiledjs/"+ interfaceFileName +" -d "+ rhinoClassDir

    // Hmm there is a Rhino JAR herer:
    // "org.mozilla" % "rhino" % "1.7R3"
    // http://repo1.maven.org/maven2/org/mozilla/rhino/1.7R3/
    // according to e.g. mvnrepository.com/artifact/org.mozilla/rhino/1.7R3
    // And the Play SBT Plugin already uses Rhino 1.7R2, see:
    // play-2-github-repo/framework/src/sbt-plugin/src/main/scala/
    //    coffeescript/CoffeescriptCompiler.scala
    // And this causes no compilation error:
    {
      import org.mozilla.javascript._
      import org.mozilla.javascript.tools.shell._
      val test = play.core.coffeescript.CoffeescriptCompiler
      val test2 = play.core.coffeescript.CoffeescriptCompiler
    }
    // So I don't need to start an external Java process. Well, do that
    // for now anyway, easier.

    def compileJsCmd(jsFileName: String, javaInterface: String,
          generatedClassName: String): String = {
      // No quotes around classpath!
      // I have no idea why, but this: (with quotes)
      //  java -cp 'bin/rhino1_7R3-js.jar:target/scala-2.9.1/classes/'
      // results in: NoClassDefFoundError: org/mozilla/javascript/tools/jsc/Main
      // whereas this works: (no quotes)
      //  java -cp bin/rhino1_7R3-js.jar:target/scala-2.9.1/classes/
      // This is when invoking `java` via SBT -- if I copy paste the command
      // into the Bash shell, it works just fine. Weird.
      "java -cp lib/rhino1_7R3-js.jar:"+ rhinoClassDir +
      " org.mozilla.javascript.tools.jsc.Main"+
      " -opt 9"+
      " -implements "+ javaInterface +
      " -package compiledjs"+
      " -d "+ rhinoClassDir +
      " -o "+ generatedClassName +
      " "+ jsSourceDir + jsFileName
    }

    "echo Compiling HtmlSanitizerJs.java..."!

    compileJavaInterfaceCmd("HtmlSanitizerJs.java")!

    "echo Compiling html-sanitizer-minified.js..."!

    compileJsCmd("html-sanitizer-minified.js",
       javaInterface = "compiledjs.HtmlSanitizerJs",
       generatedClassName = "HtmlSanitizerJsImpl")!

    "echo Compiling ShowdownJs.java..."!

    compileJavaInterfaceCmd("ShowdownJs.java")!

    "echo Compiling showdown.js..."!

    compileJsCmd("wmd/showdown.js",
      javaInterface = "compiledjs.ShowdownJs",
      generatedClassName = "ShowdownJsImpl")!
  }

  // Show unchecked and deprecated warnings, in this project and all
  // its modules.
  // scalacOptions in ThisBuild ++= Seq("-deprecation")

}

