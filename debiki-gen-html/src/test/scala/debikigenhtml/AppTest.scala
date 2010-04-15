// vim: ts=2 sw=2 et
package debikigenhtml

import org.junit._
import Assert._
import org.yaml.{snakeyaml => y}
import io._

@Test
class AppTest {

  @Test
  def testMain() {
    

  }

  /*
//  @Test
  def testYamlObj() {
    val path =
        "/home/magnus/dev/me-biz/debiki/mock/debiki-gen-html/target/"+
        "test-classes/1-1-1.yaml"
    val yaml = DebikiYaml.newYaml
    val obj = yaml.load(Source.fromPath(path).mkString)
    println(yaml.dump(obj))
  }

//  @Test
  def testOK() {
    val opts = new y.DumperOptions
//    opts.setDefaultFlowStyle(y.DumperOptions.FlowStyle.BLOCK)
    opts.setDefaultScalarStyle(y.DumperOptions.ScalarStyle.LITERAL)
    opts.setLineBreak(y.DumperOptions.LineBreak.UNIX)
    opts.setIndent(1)
    val loader = new y.Loader(new y.constructor.SafeConstructor)
    val yaml = new y.Yaml(loader, new y.Dumper(opts))
    val obj = yaml.load(Source.fromPath(
          "/home/magnus/dev/me-biz/debiki/mock/debiki-gen-html/target/"+
          "test-classes/1-1-1.yaml").mkString)
        match {
          case m: java.util.Map[String, Object] => m
          case x => error("First map missing")
        }
    // "a: 1\nb: 2\nc:\n  - aaa\n  - bbb")
    println(yaml.dump(obj))
	}

  @Test def testNestedStyle2() {
    val options = new y.DumperOptions
    options.setDefaultFlowStyle(y.DumperOptions.FlowStyle.BLOCK)
    val yaml = new y.Yaml(options)
    val document = "  a: 1\n  b:\n    c: 3\n    d: 4\n";
    assertEquals("a: 1\nb:\n  c: 3\n  d: 4\n", yaml.dump(yaml.load(document)))
    println(yaml.dump(yaml.load(document)))
  }
  */
}
