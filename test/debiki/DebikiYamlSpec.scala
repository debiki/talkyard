/**
 * Copyright (C) 2012 Kaj Magnus Lindberg (born 1979)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

package debiki

import com.debiki.core._
import com.debiki.core.Prelude._
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

    "throw error if there's more than one document" >> {
      DebikiYaml.parseYamlToMap(
        i"""
          |first: document
          |---
          |other: document
        """) must throwAn[DebikiException]
    }

    "throw error for top level Yaml lists" >> {
      DebikiYaml.parseYamlToMap(
        """
          |- List Item A
          |- List Item B
        """.stripMargin) must throwAn[DebikiException]
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


