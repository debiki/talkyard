/**
 * Copyright (C) 2014 Kaj Magnus Lindberg (born 1979)
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
import debiki._
import java.{util => ju, io => jio}
import javax.{script => js}



object ReactRenderer {

  def testRender(): String = {

    // Pass 'null' to force the correct class loader. Without passing any param,
    // the "nashorn" JavaScript engine is not found by the `ScriptEngineManager`.
    // See: https://github.com/playframework/playframework/issues/2532
    val engine = new js.ScriptEngineManager(null).getEngineByName("nashorn")

    // React expects `window` or `global` to exist. Create a `global` pointing
    // to Nashorn's context to give React a place to define its global namespace.
    engine.eval("var global = this;")

    // PERFORMANCE SHOULD cache and reuse the engine once it has compiled React and renderer.js?
    engine.eval(new jio.FileReader("public/res/react-with-addons.js"))
    engine.eval("""
        |var exports = {};
        |var console = {
        |  trace: function() {},
        |  debug: function() {},
        |  log: function() {},
        |  warn: function() {},
        |  error: function() {}
        |};
        |""".stripMargin)
    engine.eval(new jio.FileReader("public/res/renderer.js"))
    //val titleBodyComments = engine.eval("renderTitleBodyCommentsToString();")
    //titleBodyComments.toString
    "dummy"
  }

}
