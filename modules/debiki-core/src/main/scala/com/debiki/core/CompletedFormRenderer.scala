/**
 * Copyright (c) 2016 Kaj Magnus Lindberg
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

package com.debiki.core

import com.debiki.core.Prelude.classNameOf
import org.scalactic.{Good, Or, Bad, ErrorMessage}
import play.api.libs.json._


object CompletedFormRenderer {


  /** Currently renders the form inputs as key-values Yaml, escaped & wrapped in a ,< pre> tag.
    */
  def renderJsonToSafeHtml(formInputs: String): String Or ErrorMessage = {
    val inputsJson = play.api.libs.json.Json.parse(formInputs) match {
      case array: JsArray => array
      case x => return Bad(s"Not a JSON array: ${classNameOf(x)} [EsE6GK4FY0]")
    }
    renderJsonToSafeHtml(inputsJson)
  }


  def renderJsonToSafeHtml(formInputs: JsArray): String Or ErrorMessage = {
    val stringBuilder = StringBuilder.newBuilder
    for ((jsValue: JsValue) <- formInputs.value) {
      val jsObj = jsValue match {
        case o: JsObject => o
        case x => return Bad(s"Bad JSON: Not a name-value object: ${classNameOf(x)} [EsE5GYK2]")
      }
      var inputName = ""
      var inputValue = ""
      for ((name: String, value: JsValue) <- jsObj.fields) {
        if (name == "name") {
          inputName = value.asInstanceOf[JsString].value.trim
        }
        else if (name == "value") {
          inputValue = value.asInstanceOf[JsString].value.trim
        }
        else if (name == "type") {
          // Ignore for now. Later: render in a nicer way, when we know the type.
        }
        else {
          return Bad(s"Key-value other than 'name' or 'value': '$name' [EsE2KP703]")
        }
      }
      if (inputName.isEmpty) {
        return Bad("No input name [EsE7KU4W0]")
      }
      val twoSpaces = "  "
      val valueIndented = inputValue.split('\n').mkString(twoSpaces, s"\n$twoSpaces", "\n\n")
      stringBuilder.append(inputName).append(": |2\n").append(valueIndented)
    }
    val yamlString = stringBuilder.toString.trim
    val escapedYaml = org.owasp.encoder.Encode.forHtmlContent(yamlString)
    Good(s"<pre>$escapedYaml</pre>")
  }

}


