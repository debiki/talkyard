/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package debiki

import com.debiki.v0._
import com.debiki.v0.Prelude._
import org.specs2.mutable._
import java.{util => ju}


class DebikiYamlSpec extends Specification {


  "DebikiYaml.parseYamlToMap" can {

    "parse nothing to nothing" >> {
      DebikiYaml.parseYamlToMap("") must be empty
    }

    "parse a simple String -> String Yaml map to a Scala map" >> {
      val map = DebikiYaml.parseYamlToMap(
        """
          |keyA: "Value A"
          |keyB: "Value B"
        """.stripMargin)
      map.get("keyA") must_== Some("Value A")
      map.get("keyB") must_== Some("Value B")
      map.size must_== 2
    }

    "parse a literal block string" >> {
      val map = DebikiYaml.parseYamlToMap(
        """
          |key: |
          | the value, literally
          | (not folded), on three
          | lines: indeed
          |""".stripMargin)
      map.get("key") must_== Some(
        "the value, literally\n"+
        "(not folded), on three\n"+
        "lines: indeed\n")
    }

    "throw error for top level Yaml lists" >> {
      DebikiYaml.parseYamlToMap(
        """
          |- List Item A
          |- List Item B
        """.stripMargin) must throwAn[RuntimeException]
    }

    "parse a Yaml list to a Scala List, not a Java ArrayList" >> {
      pending
      /* This doesn't work: (becomes an ArrayList)
      val map = DebikiYaml.parseYamlToMap(
        """
          |key: ["ListItem1", "ListItem2"]
        """.stripMargin)
      map.get("key") must_== Some(List("ListItem1", "ListItem2"))
      map.size must_== 1
      */
    }
  }

}


