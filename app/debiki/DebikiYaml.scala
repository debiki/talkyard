/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */


package debiki

import com.debiki.v0.Prelude._
import org.yaml.{snakeyaml => y}
import y.{constructor => yc, nodes => yn}
import scala.collection.{mutable => mut}
import java.{io => jio, util => ju, lang => jl}


object DebikiYaml {

  def parseYamlToMap(yamlText: String): Map[String, Any] = {
    val yaml: y.Yaml = new y.Yaml(new y.constructor.SafeConstructor)
    val yamlObj = yaml.load(yamlText)
    val javaMap: ju.Map[String, Any] =
      yamlObj.asInstanceOf[ju.Map[String, Any]]

    if (javaMap eq null)
      return Map.empty

    import scala.collection.JavaConversions._
    val scalaMap: Map[String, Any] = javaMap.toMap
    scalaMap
  }

}

