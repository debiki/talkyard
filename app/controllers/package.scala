/**
 * Copyright (C) 2015 Kaj Magnus Lindberg
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

import com.debiki.core.QuickMessageException
import com.debiki.core.Prelude._
import play.api.Play
import play.api.Play.current
import play.api.libs.json.JsValue


package object controllers {

  // Move it to here soon ... No, move it to io.efdi.server.http package?
  def OkSafeJson(json: JsValue) =
    Utils.OkSafeJson(json)


  /** Better fail fast with a full page error message, if assets have not yet been
    * bundled by 'gulp build' — instead of returning a html page with links to
    * not-yet-created scripts. The latter would result in a blank page, with
    * "invisible" 404 script-not-found errors in the dev console.
    */
  def dieIfAssetsMissingIfDevTest() {
    if (Play.isProd) return

    val serverJavascriptPath = "/public/res/server-bundle.js"
    val clientJavascriptPath = "/public/res/slim-bundle.js"
    val stylesPath = "/public/res/styles-bundle.css"

    val tips = o"""If you ran 'docker-compose up' then this bundle should be
      created automatically, but it might take a minute. You can:""" + i"""
      |  - Wait for a short while, then reload this page. If you use Docker-Compose,
      |    run 'docker-compose logs' to see what's happening.
      |  - Run 'docker-compose restart gulp', if the Gulp container isn't running.
      |  - Run 'gulp watch', if you run Node.js and Gulp directly on your machine.
      """

    def fileName(path: String) = path.takeRightWhile(_ != '/')

    if (getClass.getResourceAsStream(serverJavascriptPath) eq null)
      throw new QuickMessageException(
        s"Javascript bundle not found: ${fileName(serverJavascriptPath)} [EsE6GKW2]\n\n$tips")

    if (getClass.getResourceAsStream(clientJavascriptPath) eq null)
      throw new QuickMessageException(
        s"Javascript bundle not found: ${fileName(clientJavascriptPath)} [EsE6GKW2]\n\n$tips")

    if (getClass.getResourceAsStream(stylesPath) eq null)
      throw new QuickMessageException(
        s"CSS bundle not found: ${fileName(stylesPath)} [EsE2GPU0]\n\n$tips")
  }

}

