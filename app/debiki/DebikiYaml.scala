/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package debiki

import com.debiki.v0.Prelude._
import org.yaml.{snakeyaml => y}
import y.{constructor => yc, nodes => yn}
import scala.collection.{mutable => mut}
import java.{io => jio, util => ju, lang => jl}
import com.debiki.v0.DebikiException


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

