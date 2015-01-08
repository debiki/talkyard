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

import com.debiki.core.DebikiException
import com.debiki.core.Prelude._
import java.{io => jio, util => ju, lang => jl}
import org.yaml.{snakeyaml => y}
import scala.collection.{mutable => mut}
import y.{constructor => yc, nodes => yn}


object DebikiYaml {

  def parseYamlToMap(yamlText: String): Map[String, Any] = {
    val yaml: y.Yaml = new y.Yaml(new y.constructor.SafeConstructor)

    val yamlObj =
      try { yaml.load(yamlText) }
      catch {
        case ex: org.yaml.snakeyaml.composer.ComposerException =>
          // This hapens e.g. if there's any "\n---\n" in the `yamlText`, which
          // means another Yaml doc follows — `yaml.load` expects only one doc.
          throw DebikiException(
            "DwE04DB3", o"""Bad config file: More than one Yaml document
              (remove any line containing only "---", please)""")
        case ex: Exception =>
          // (`ex.getMessage` ends with "...\n^" to show where on the line the
          // error happened, and appending `classNameOf(ex)` directly results
          // in a nicely formatted message.)
          throw DebikiException(
            "DwE08Nf2", s"Bad config file: ${ex.getMessage} ${classNameOf(ex)}")
      }

    val javaMap: ju.Map[String, Any] =
      try { yamlObj.asInstanceOf[ju.Map[String, Any]] }
      catch {
        case ex: jl.ClassCastException =>
          throw DebikiException(
            "DwE4BA3", "Bad config file: The config file is not a Yaml map")
      }

    if (javaMap eq null)
      return Map.empty

    import scala.collection.JavaConversions._
    val scalaMap: Map[String, Any] = javaMap.toMap
    scalaMap
  }

}

